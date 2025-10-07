import { exec } from "@actions/exec";

export async function runGit(args, options = {}) {
  try {
    await exec("git", args, options);
    return true;
  } catch {
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

export async function getCommitMessage(sha) {
  let output = "";
  try {
    await exec("git", ["log", "-1", "--pretty=%B", sha], {
      listeners: {
        stdout: (data) => {
          output += data.toString();
        },
      },
    });

    // since git includes a trailing newline at the end of the commit message,
    // we need to remove that trailing newline and if there's any more included
    // with the original commit message
    output = output.replace(/\n+$/, "");

    return output
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n");
  } catch (err) {
    return "    (no commit message)";
  }
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
