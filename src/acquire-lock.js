import fs from "fs";
import path from "path";
import * as github from "@actions/github";
import * as core from "@actions/core";
import {
  checkBranchExists,
  runGit,
  buildLockEntry,
  getCommitMessage,
} from "./helpers.js";

export async function acquireLock(lockFile, locksBranch) {
  const maxRetries = 5;
  const retryDelay = 1000;
  let retries = 0;

  while (retries < maxRetries) {
    const exists = await checkBranchExists(locksBranch);
    if (exists) {
      core.info("Branch exists → fetching and switching");
      await runGit(["fetch", "origin", locksBranch]);
      await runGit(["checkout", locksBranch]);
    } else {
      core.info("Branch does not exist → creating orphan branch");
      await runGit(["checkout", "--orphan", locksBranch]);
      await runGit(["rm", "-rf", "."]);
    }

    const lockDir = path.dirname(lockFile);
    await fs.promises.mkdir(lockDir, { recursive: true });

    const { sha, workflow, runId, actor } = github.context;
    const commitMessage = await getCommitMessage(sha);
    const lockEntry = await buildLockEntry({
      sha,
      workflow,
      runId,
      actor,
      commitMessage: commitMessage || "(no commit message)",
    });

    if (!fs.existsSync(lockFile)) {
      fs.writeFileSync(lockFile, lockEntry, "utf-8");
    } else {
      fs.appendFileSync(lockFile, lockEntry, "utf-8");
    }

    await runGit(["add", lockFile]);
    await runGit(["commit", "-m", `Acquired lock from commit ${sha}`]);

    const pushed = await runGit(["push", "origin", locksBranch]).catch(
      () => false
    );
    if (pushed) {
      core.info("Lock acquired successfully!");
      return;
    }

    retries++;
    core.warning(
      `Push failed — another workflow may have modified the lock. Retrying ${retries}/${maxRetries} in ${retryDelay}ms...`
    );

    await new Promise((r) => setTimeout(r, retryDelay));
    await runGit(["fetch", "origin", locksBranch]);
    await runGit(["reset", "--hard", `origin/${locksBranch}`]);
  }

  throw new Error(`Failed to acquire lock after ${maxRetries} attempts`);
}
