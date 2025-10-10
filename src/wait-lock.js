import fs from "fs";
import * as github from "@actions/github";
import * as core from "@actions/core";
import {
  checkBranchExists,
  runGit,
  reorderLockEntries,
  formatLockEntries,
  splitEntries,
  isShallowRepo,
} from "./helpers.js";

export async function waitForLock(
  locksFile,
  locksBranch,
  maxWait,
  sleepInterval,
  strictMode = true
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

    const { sha, payload, ref } = github.context;

    if (strictMode) {
      const [orgName, repoName] = payload.repository.full_name.split("/");
      const branchName = ref.split("/").pop();
      const myRef = `${orgName}/${repoName}/${branchName}`;

      const lockEntries = splitEntries(lockContent);

      let needsStepDown = false;
      let lastAncestorIndex = -1;

      const myIndex = lockEntries.findIndex(
        (e) => e.match(/^commit_sha:\s*(\S+)/m)?.[1] === sha
      );
      if (myIndex === -1) throw new Error("Self entry not found in lock file");

      let fetchedMyRef = false;

      for (let i = myIndex + 1; i < lockEntries.length; i++) {
        const entry = lockEntries[i];
        const entrySHA = entry.match(/^commit_sha:\s*(\S+)/m)?.[1];
        const entryRef = entry.match(/^lockGroup:\s*(\S+)/m)?.[1];

        core.info(`Looping entry index ${i}: SHA=${entrySHA}, REF=${entryRef}`);

        if (entryRef === myRef && entrySHA !== sha) {
          core.info(`Matching same branch ref: ${entryRef}, SHA=${entrySHA}`);

          if (!fetchedMyRef) {
            core.info(`Fetching branch ${branchName} for ancestry check`);
            const isShallow = await isShallowRepo();

            if (isShallow) {
              core.info("Repository is shallow.");
              await runGit(["fetch", "--unshallow", "origin", branchName]);
            } else {
              core.info("Repository already has full history.");
              await runGit(["fetch", "origin", branchName]);
            }

            fetchedMyRef = true;
          }

          const isAncestor = await runGit(
            ["merge-base", "--is-ancestor", entrySHA, sha],
            {},
            true
          );

          if (isAncestor) {
            core.info(
              `Ancestor found! ${entrySHA} is an ancestor of us, ${sha}`
            );
            needsStepDown = true;
            lastAncestorIndex = i;
          }
        }
      }

      if (needsStepDown) {
        core.notice(`Voluntarily stepping down. Reordering...`);

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
