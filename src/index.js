import * as core from "@actions/core";
import * as github from "@actions/github";
import { exec } from "@actions/exec";
import { acquireLock } from "./acquire-lock.js";
import { releaseLock } from "./release-lock.js";
import { waitForLock } from "./wait-lock.js";

async function run() {
  try {
    const branch = github.context.ref.replace("refs/heads/", "");
    const lockDir = core.getInput("locks_dir") || branch.replace(/\//g, "_");
    const lockFile = `${lockDir}/lock.txt`;

    const maxWaitInput = core.getInput("max_wait");
    const maxWait = parseInt(maxWaitInput, 10);
    if (isNaN(maxWait) || maxWait <= 0) {
      throw new Error(`Invalid max_wait value: ${maxWaitInput}`);
    }

    const sleepIntervalInput = core.getInput("sleep_interval");
    const sleepInterval = parseInt(sleepIntervalInput, 10);
    if (isNaN(sleepInterval) || sleepInterval <= 0) {
      throw new Error(`Invalid sleep_interval value: ${sleepInterval}`);
    }

    const locksBranch = core.getInput("locks_branch");

    const actionType = core.getInput("action");
    if (!actionType) throw new Error("Input 'action' is required");

    await exec("git", ["config", "user.name", github.context.actor]);
    await exec("git", [
      "config",
      "user.email",
      `${github.context.actor}@users.noreply.github.com`,
    ]);

    switch (actionType) {
      case "acquire":
        await acquireLock(lockFile, locksBranch);
        break;
      case "release":
        await releaseLock(lockFile, locksBranch);
        break;
      case "wait":
        await waitForLock(lockFile, locksBranch, maxWait, sleepInterval);
        break;
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
