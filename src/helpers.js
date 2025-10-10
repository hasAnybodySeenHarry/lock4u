import { exec } from "@actions/exec";
import * as core from "@actions/core";

export async function configureGit(token, actor) {
  await runGit(["config", "user.name", actor]);
  await runGit(["config", "user.email", `${actor}@users.noreply.github.com`]);

  if (!token) return;

  let originUrl = "";
  await runGit(["remote", "get-url", "origin"], {
    listeners: {
      stdout: (data) => {
        originUrl += data.toString();
      },
    },
  });

  originUrl = originUrl.trim();

  if (originUrl.startsWith("https://")) {
    const urlWithToken = originUrl.replace(
      /^https:\/\//,
      `https://x-access-token:${token}@`
    );
    await runGit(["remote", "set-url", "origin", urlWithToken]);
    core.info("Configured origin remote to use supplied token");
  } else {
    core.warning(
      "Origin is not HTTPS. Supplied token cannot be used for authentication."
    );
  }
}

export async function runGit(args, options = {}, allowNonZero = false) {
  try {
    await exec("git", args, options);
    return true;
  } catch (err) {
    if (allowNonZero) return false;
    console.error(`Git command failed: git ${args.join(" ")}`);
    throw err;
  }
}

export async function checkBranchExists(branch) {
  const args = ["ls-remote", "--exit-code", "--heads", "origin", branch];

  try {
    await exec("git", args);
    return true;
  } catch (err) {
    // if (err.exitCode === 2) {
    //   return false;
    // } else {
    //   console.error(`Git command failed: git ${args.join(" ")}`);
    //   throw err;
    // }
    core.warning(`Failed to check branch existence: ${err}`);
    return false;
  }
}

export async function buildLockEntry({
  sha,
  workflow,
  runId,
  actor,
  lockGroup,
  commitMessage,
}) {
  const timestamp = new Date().toISOString();

  const formattedMessage = commitMessage
    .replace(/\n+$/, "")
    .split("\n")
    .map((line) => `    ${line.trim()}`)
    .join("\n");

  const lockEntry =
    `timestamp: ${timestamp}\n` +
    `commit_sha: ${sha}\n` +
    `workflow: ${workflow}\n` +
    `run_id: ${runId}\n` +
    `actor: ${actor}\n` +
    `lockGroup: ${lockGroup}\n` +
    `commit_message: |\n${formattedMessage}\n---\n`;

  return lockEntry;
}

/**
 * Removes all lock entries for the given commit SHA from the lock content.
 *
 * @param {string} lockContent - The full content of the lock file.
 * @param {string} commitSHA - The commit SHA whose entries should be removed.
 * @returns {string} - Updated lock file content with entries removed.
 */
export function removeLockEntry(lockContent, commitSHA) {
  if (!lockContent.trim()) return lockContent;

  const entries = lockContent.split(/^---$/m);

  const updatedEntries = entries.filter((entry) => {
    const match = entry.match(/^commit_sha:\s*(\S+)/m);
    return !(match && match[1] === commitSHA);
  });

  if (updatedEntries.length === entries.length) {
    return lockContent;
  }

  return (
    updatedEntries.join("---").trim() + (updatedEntries.length > 0 ? "\n" : "")
  );
}

/**
 * Reorder lock entries by removing self entry and inserting it after the last ancestor
 * @param {string[]} lockEntries - Array of lock entries
 * @param {number} myIndex - Index of self entry
 * @param {number} lastAncestorIndex - Index of the last ancestor below self
 * @param {string} self - The lock entry content to insert
 * @returns {string[]} - Updated lock entries
 */
export function reorderLockEntries(
  lockEntries,
  myIndex,
  lastAncestorIndex,
  self
) {
  if (!Array.isArray(lockEntries)) {
    throw new TypeError("lockEntries must be an array");
  }
  if (
    myIndex < 0 ||
    lastAncestorIndex < 0 ||
    lastAncestorIndex >= lockEntries.length ||
    myIndex >= lockEntries.length
  ) {
    throw new RangeError("myIndex out of range");
  }

  if (
    lastAncestorIndex === myIndex || // technically, not a valid request
    lastAncestorIndex < myIndex // we're already behind the last ancestor
  ) {
    return lockEntries;
  }

  const updatedEntries = [...lockEntries];

  updatedEntries.splice(myIndex, 1);

  const lastAncestorNewIndex = lastAncestorIndex - 1;
  const insertionIndex = lastAncestorNewIndex + 1;
  updatedEntries.splice(insertionIndex, 0, self);

  return updatedEntries;
}

/**
 * Join lock entries into a properly formatted lock file string
 * with "---" separators and a trailing newline if non-empty.
 *
 * @param {string[]} entries - Array of lock entry strings
 * @returns {string} - Formatted lock file content
 */
export function formatLockEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new TypeError("entries must be an array");
  }
  return entries.join("\n---\n").trim() + (entries.length > 0 ? "\n" : "");
}
