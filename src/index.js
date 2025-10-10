import * as core from "@actions/core";
import * as github from "@actions/github";
import { acquireLock } from "./actions/acquire-lock.js";
import { releaseLock } from "./actions/release-lock.js";
import { waitForLock } from "./actions/wait-lock.js";
import { configureGit } from "./git.js";
import { INPUTS, ACTIONS } from "./constants.js";

async function run() {
  try {
    const branch = github.context.ref.replace("refs/heads/", "");
    const locksDir =
      core.getInput(INPUTS.LOCKS_DIR) || branch.replace(/\//g, "_");
    const locksFile = `${locksDir}/lock.txt`;

    const maxWaitInput = core.getInput(INPUTS.MAX_WAIT);
    const maxWait = parseInt(maxWaitInput, 10);
    if (isNaN(maxWait) || maxWait <= 0) {
      throw new Error(`Invalid ${INPUTS.MAX_WAIT} value: ${maxWaitInput}`);
    }

    const sleepIntervalInput = core.getInput(INPUTS.SLEEP_INTERVAL);
    const sleepInterval = parseInt(sleepIntervalInput, 10);
    if (isNaN(sleepInterval) || sleepInterval <= 0) {
      throw new Error(
        `Invalid ${INPUTS.SLEEP_INTERVAL} value: ${sleepInterval}`
      );
    }

    const locksBranch = core.getInput(INPUTS.LOCKS_BRANCH);

    const actionType = core.getInput(INPUTS.ACTION);
    if (!actionType) throw new Error(`Input '${INPUTS.ACTION}' is required`);

    const stepDownInput = core.getInput(INPUTS.STEP_DOWN);
    const stepDown = stepDownInput?.toLowerCase() === "true";

    if (stepDown && actionType !== ACTIONS.WAIT) {
      throw new Error(
        `'${INPUTS.STEP_DOWN}' can only be used when action is '${ACTIONS.WAIT}'`
      );
    }

    const token = core.getInput(INPUTS.TOKEN);
    const actor = github.context.actor;
    await configureGit(token, actor);

    switch (actionType) {
      case ACTIONS.ACQUIRE:
        await acquireLock(locksFile, locksBranch);
        break;
      case ACTIONS.RELEASE:
        await releaseLock(locksFile, locksBranch);
        break;
      case ACTIONS.WAIT:
        await waitForLock(
          locksFile,
          locksBranch,
          maxWait,
          sleepInterval,
          stepDown
        );
        break;
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
