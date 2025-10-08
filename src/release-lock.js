import fs from "fs";
import * as github from "@actions/github";
import * as core from "@actions/core";
import { runGit, checkBranchExists } from "./helpers.js";

export async function releaseLock(lockFile, locksBranch) {
  const maxRetries = 5;
  const retryDelay = 1000;
  let retries = 0;

  while (retries < maxRetries) {
    const exists = await checkBranchExists(locksBranch);
    if (!exists) {
      core.notice("Branch does not exist, nothing to release");
      return;
    }

    await runGit(["fetch", "origin", locksBranch]);
    await runGit(["checkout", locksBranch]);
    await runGit(["reset", "--hard", `origin/${locksBranch}`]);

    if (!fs.existsSync(lockFile)) {
      core.notice("No lock file to release");
      return;
    }

    const lockContent = await fs.promises.readFile(lockFile, "utf-8");
    const firstCommitSHAMatch = lockContent.match(/^commit_sha:\s*(\S+)/m);
    const firstCommitSHA = firstCommitSHAMatch ? firstCommitSHAMatch[1] : null;

    const { sha } = github.context;

    if (!firstCommitSHA || firstCommitSHA !== sha) {
      core.notice("Lock is not owned by this commit, nothing to release");
      return;
    }

    const updatedContent = lockContent.replace(/^.*?^---$\n?/ms, "");
    await fs.promises.writeFile(lockFile, updatedContent, "utf-8");

    await runGit(["add", lockFile]);
    await runGit(["commit", "-m", `Released lock from commit ${sha}`]);

    const pushed = await runGit(["push", "origin", locksBranch]).catch(
      () => false
    );
    if (pushed) {
      core.info("Lock released successfully!");
      return;
    }

    core.warning("Push failed — retrying...");
    retries++;

    await new Promise((r) => setTimeout(r, retryDelay));
  }

  throw new Error(`Failed to release lock after ${maxRetries} attempts`);
}
