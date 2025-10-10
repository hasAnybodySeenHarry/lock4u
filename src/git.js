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

export async function isShallowRepo() {
  let output = "";
  await exec("git", ["rev-parse", "--is-shallow-repository"], {
    listeners: {
      stdout: (data) => {
        output += data.toString();
      },
    },
  });
  return output.trim() === "true";
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
    core.warning(`Failed to check branch existence: ${err}`);
    return false;
  }
}

export async function syncBranch(branch) {
  await runGit(["fetch", "origin", branch]);
  await runGit(["checkout", branch]);
  await runGit(["reset", "--hard", `origin/${branch}`]);
}
