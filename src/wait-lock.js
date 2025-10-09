import fs from "fs";
import * as github from "@actions/github";
import * as core from "@actions/core";
import { checkBranchExists, runGit } from "./helpers.js";

export async function waitForLock(
  locksFile,
  locksBranch,
  maxWait,
  sleepInterval
) {
  let elapsed = 0;

  const exists = await checkBranchExists(locksBranch);
  if (!exists) {
    throw new Error(
      "Locks branch does not exist yet. THIS SHOULD NEVER HAPPEN."
    );
  }

  while (elapsed < maxWait) {
    await runGit(["fetch", "origin", locksBranch]);
    await runGit(["reset", "--hard", `origin/${locksBranch}`]);

    const lockContent = await fs.promises.readFile(locksFile, "utf-8");
    const firstCommitSHAMatch = lockContent.match(/^commit_sha:\s*(\S+)/m);
    const firstCommitSHA = firstCommitSHAMatch ? firstCommitSHAMatch[1] : null;

    if (!firstCommitSHA) {
      throw new Error(`Lock file ${locksFile} is missing commit SHA`);
    }

    const { sha } = github.context;

    if (firstCommitSHA === sha) {
      core.info("Lock confirmed! Proceeding...");
      return;
    } else {
      core.notice(
        `Lock held by another workflow (${firstCommitSHA}). Waiting...`
      );
      const delayInMilliSec = sleepInterval * 1000;
      await new Promise((r) => setTimeout(r, delayInMilliSec));
      elapsed += sleepInterval;
    }
  }

  if (elapsed >= maxWait) {
    throw new Error(`Timed out waiting for lock after ${maxWait} seconds`);
  }
}
