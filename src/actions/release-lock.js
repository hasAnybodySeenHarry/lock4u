import fs from "fs";
import * as github from "@actions/github";
import * as core from "@actions/core";
import { removeLockEntry } from "../helpers.js";
import { runGit, checkBranchExists, syncBranch } from "../git.js";

export async function releaseLock(locksFile, locksBranch) {
  const maxRetries = 5;
  const retryDelay = 1000;
  let retries = 0;

  while (retries < maxRetries) {
    const exists = await checkBranchExists(locksBranch);
    if (!exists) {
      core.notice("Branch does not exist, nothing to release");
      return;
    }

    await syncBranch(locksBranch);

    if (!fs.existsSync(locksFile)) {
      core.notice("No lock file to release");
      return;
    }

    const lockContent = await fs.promises.readFile(locksFile, "utf-8");
    const { sha } = github.context;

    const firstCommitSHAMatch = lockContent.match(/^commit_sha:\s*(\S+)/m);
    const firstCommitSHA = firstCommitSHAMatch ? firstCommitSHAMatch[1] : null;
    if (!firstCommitSHA || firstCommitSHA !== sha) {
      core.warning(
        "Lock is not owned by this commit, must have given up queueing"
      );
    }

    const updatedContent = removeLockEntry(lockContent, sha);
    if (updatedContent === lockContent) {
      core.notice(`No lock entry found for commit ${sha}. Nothing to release`);
      return;
    } else {
      await fs.promises.writeFile(locksFile, updatedContent, "utf-8");
      core.info(`Lock entry for commit ${sha} released`);
    }

    await runGit(["add", locksFile]);
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
