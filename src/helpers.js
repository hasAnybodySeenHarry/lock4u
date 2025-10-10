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

  const entries = splitEntries(lockContent);

  const updatedEntries = entries.filter((entry) => {
    const match = entry.match(/^commit_sha:\s*(\S+)/m);
    return !(match && match[1] === commitSHA);
  });

  if (updatedEntries.length === entries.length) {
    return lockContent;
  }

  return formatLockEntries(updatedEntries);
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
  return entries.join("\n---\n").trim() + (entries.length > 0 ? "\n---\n" : "");
}

export function splitEntries(content) {
  return content
    .split(/^\s*---\s*$/m)
    .map((e) => e.trim())
    .filter(Boolean);
}
