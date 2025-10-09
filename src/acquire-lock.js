import fs from "fs";
import path from "path";
import * as github from "@actions/github";
import * as core from "@actions/core";
import { checkBranchExists, runGit, buildLockEntry } from "./helpers.js";

export async function acquireLock(locksFile, locksBranch) {
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

    const locksDir = path.dirname(locksFile);
    await fs.promises.mkdir(locksDir, { recursive: true });

    const { sha, workflow, runId, actor, ref_name, payload, repository } =
      github.context;

    const [orgName, repoName] = repository.split("/");
    const ref = `${orgName}/${repoName}/${ref_name}`;

    const commitMessage = payload.head_commit?.message || "(no commit message)";

    const lockEntry = await buildLockEntry({
      sha,
      workflow,
      runId,
      actor,
      ref,
      commitMessage,
    });

    if (!fs.existsSync(locksFile)) {
      fs.writeFileSync(locksFile, lockEntry, "utf-8");
    } else {
      fs.appendFileSync(locksFile, lockEntry, "utf-8");
    }

    await runGit(["add", locksFile]);
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
