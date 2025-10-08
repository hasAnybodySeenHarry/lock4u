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

export async function runGit(args, options = {}) {
  try {
    await exec("git", args, options);
    return true;
  } catch (err) {
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
    if (err.exitCode === 2) {
      return false;
    } else {
      console.error(`Git command failed: git ${args.join(" ")}`);
      throw err;
    }
  }
}

export function getCommitMessage(message) {
  return message
    .replace(/\n+$/, "")
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

export async function buildLockEntry({
  sha,
  workflow,
  runId,
  actor,
  commitMessage,
}) {
  const timestamp = new Date().toISOString();
  const formattedMessage = commitMessage
    .split("\n")
    .map((line) => `    ${line.trim()}`)
    .join("\n");

  const lockEntry =
    `timestamp: ${timestamp}\n` +
    `commit_sha: ${sha}\n` +
    `workflow: ${workflow}\n` +
    `run_id: ${runId}\n` +
    `actor: ${actor}\n` +
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
