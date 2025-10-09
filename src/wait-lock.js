import fs from "fs";
import * as github from "@actions/github";
import * as core from "@actions/core";
import {
  checkBranchExists,
  runGit,
  reorderLockEntries,
  formatLockEntries,
} from "./helpers.js";

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
    const headSHAMatch = lockContent.match(/^commit_sha:\s*(\S+)/m);
    const headSHA = headSHAMatch ? headSHAMatch[1] : null;

    if (!headSHA) {
      throw new Error(`Lock file ${locksFile} is missing commit SHA`);
    }

    const { sha, repository, ref_name } = github.context;

    const [orgName, repoName] = repository.split("/");
    const myRef = `${orgName}/${repoName}/${ref_name}`;

    const lockEntries = lockContent
      .split(/^---$/m)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    let needsStepDown = false;
    let lastAncestorIndex = -1;

    const myIndex = lockEntries.findIndex(
      (e) => e.match(/^commit_sha:\s*(\S+)/m)?.[1] === sha
    );
    if (myIndex === -1) throw new Error("Self entry not found in lock file");

    for (let i = myIndex + 1; i < lockEntries.length; i++) {
      const entry = lockEntries[i];
      const entrySHA = entry.match(/^commit_sha:\s*(\S+)/m)?.[1];
      const entryRef = entry.match(/^ref:\s*(\S+)/m)?.[1];

      if (entryRef === myRef && entrySHA !== sha) {
        const isAncestor = await runGit(
          ["merge-base", "--is-ancestor", entrySHA, sha],
          {},
          true
        );

        if (isAncestor) {
          needsStepDown = true;
          lastAncestorIndex = i;
        }
      }
    }

    if (needsStepDown) {
      core.notice(
        `Voluntarily stepping down: found ancestor commit below us. Reordering...`
      );

      const self = lockEntries[myIndex];

      const updatedEntries = reorderLockEntries(
        lockEntries,
        myIndex,
        lastAncestorIndex,
        self
      );
      const updatedContent = formatLockEntries(updatedEntries);

      await fs.promises.writeFile(locksFile, updatedContent, "utf-8");

      await runGit(["add", locksFile]);
      await runGit(["commit", "-m", `Voluntary step-down for ${sha}`]);

      const pushed = await runGit(["push", "origin", locksBranch]).catch(
        () => false
      );

      if (pushed) {
        core.notice("Step-down complete, retrying wait loop...");
      } else {
        core.warning("Step-down complete, retrying wait loop...");
      }

      const delayInMilliSec = sleepInterval * 1000;
      await new Promise((r) => setTimeout(r, delayInMilliSec));
      elapsed += sleepInterval;
      continue; // retry loop
    }

    if (headSHA === sha) {
      core.info("Lock confirmed! Proceeding...");
      return;
    } else {
      core.notice(`Lock held by another workflow (${headSHA}). Waiting...`);
      const delayInMilliSec = sleepInterval * 1000;
      await new Promise((r) => setTimeout(r, delayInMilliSec));
      elapsed += sleepInterval;
    }
  }

  if (elapsed >= maxWait) {
    throw new Error(`Timed out waiting for lock after ${maxWait} seconds`);
  }
}
