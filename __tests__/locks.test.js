/* eslint-disable no-undef */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildLockEntry,
  removeLockEntry,
  reorderLockEntries,
} from "../src/helpers.js";

describe("Lock Actions", () => {});

describe("Lock Entry Builder", () => {
  test("buildLockEntry formats two entries correctly", async () => {
    const entry1 = await buildLockEntry({
      sha: "abc123",
      workflow: "Service CI",
      runId: 42,
      actor: "hasAnybodySeenHarry",
      commitMessage: "fix(auth): validate JWT tokens correctly (#JIRA-1234)",
    });

    const entry2 = await buildLockEntry({
      sha: "def456",
      workflow: "Service CD",
      runId: 43,
      actor: "enoki",
      commitMessage: "feat(ui): add loading spinner (#JIRA-5678)",
    });

    expect(entry1).toContain("commit_sha: abc123");
    expect(entry1).toContain("workflow: Service CI");
    expect(entry1).toContain("run_id: 42");
    expect(entry1).toContain("actor: hasAnybodySeenHarry");
    expect(entry1).toContain("commit_message: |");
    expect(entry1).toContain(
      "    fix(auth): validate JWT tokens correctly (#JIRA-1234)"
    );
    expect(entry1).toMatch(/timestamp: .*Z/);
    expect(entry1.endsWith("---\n")).toBe(true);

    expect(entry2).toContain("commit_sha: def456");
    expect(entry2).toContain("workflow: Service CD");
    expect(entry2).toContain("run_id: 43");
    expect(entry2).toContain("actor: enoki");
    expect(entry2).toContain("commit_message: |");
    expect(entry2).toContain("    feat(ui): add loading spinner (#JIRA-5678)");
    expect(entry2).toMatch(/timestamp: .*Z/);
    expect(entry2.endsWith("---\n")).toBe(true);

    const combined = entry1 + entry2;
    expect(combined).toContain("abc123");
    expect(combined).toContain("def456");
  });
});

describe("Removing Lock Entry", () => {
  let lockContent;

  beforeAll(async () => {
    const lockFilePath = path.resolve(
      __dirname,
      "../__tests__",
      "test-lock.txt"
    );
    lockContent = await fs.promises.readFile(lockFilePath, "utf-8");
  });

  it("removes the top entry", () => {
    const shaToRemove = "c36f3d5cbdb8614d43f6f6f739facad93f1fe977";
    const updated = removeLockEntry(lockContent, shaToRemove);

    expect(updated).not.toContain(shaToRemove);

    const entries = splitEntries(updated);
    expect(entries.length).toBe(4);

    expect(updated.trim().startsWith("timestamp: 2025-10-08T13:17:24")).toBe(
      true
    );
  });

  it("removes a middle entry", () => {
    const shaToRemove = "6a3c230fb7b5f6a887bbf600db3be04db649ec8f";
    const updated = removeLockEntry(lockContent, shaToRemove);

    expect(updated).not.toContain(shaToRemove);

    const entries = splitEntries(updated);
    expect(entries.length).toBe(4);

    expect(updated.trim().startsWith("timestamp: 2025-10-08T13:17:20")).toBe(
      true
    );

    expect(updated.includes("b62234514aa554f5f4b59bb1a6c81887277a5731")).toBe(
      true
    );
  });

  it("removes the bottom entry", () => {
    const shaToRemove = "b62234514aa554f5f4b59bb1a6c81887277a5731";
    const updated = removeLockEntry(lockContent, shaToRemove);

    expect(updated).not.toContain(shaToRemove);

    const entries = splitEntries(updated);
    expect(entries.length).toBe(4);

    expect(updated.includes("c36f3d5cbdb8614d43f6f6f739facad93f1fe977")).toBe(
      true
    );

    expect(updated.includes("6a3c230fb7b5f6a887bbf600db3be04db649ec8f")).toBe(
      true
    );
  });

  it("returns the same content if SHA is not found", () => {
    const shaToRemove = "nonexistentSHA";
    const updated = removeLockEntry(lockContent, shaToRemove);

    expect(updated).toBe(lockContent);
  });

  it("removes all matching entries if duplicates exist", () => {
    const shaToRemove = "3cf5a9a58c8617e59cdd3d1dbe36b0c5aaf83a94";
    const updated = removeLockEntry(lockContent, shaToRemove);

    expect(updated).not.toContain("3cf5a9a58c8617e59cdd3d1dbe36b0c5aaf83a94");

    const entries = splitEntries(updated);
    expect(entries.length).toBe(3);
  });
});

describe("Reorder Lock Entries", () => {
  let lockContent;
  let lockEntries;

  beforeAll(async () => {
    const lockFilePath = path.resolve(__dirname, "test-lock.txt");
    lockContent = await fs.promises.readFile(lockFilePath, "utf-8");
    lockEntries = splitEntries(lockContent);
  });

  it("should move self entry after the last ancestor", () => {
    const myIndex = 0;
    const self = lockEntries[myIndex];

    const lastAncestorIndex = 1;
    const lastAncestor = lockEntries[lastAncestorIndex];

    const updatedEntries = reorderLockEntries(
      lockEntries,
      myIndex,
      lastAncestorIndex,
      self
    );

    expect(updatedEntries[lastAncestorIndex]).toBe(self);
    expect(updatedEntries[lastAncestorIndex - 1]).toBe(lastAncestor);
    expect(updatedEntries.indexOf(self)).not.toBe(myIndex);
    lockEntries.forEach((entry) => {
      expect(updatedEntries).toContain(entry);
    });
  });

  it("should receive the same content back", () => {
    const myIndex = 1;
    const self = lockEntries[myIndex];

    const lastAncestorIndex = 0;
    const lastAncestor = lockEntries[lastAncestorIndex];

    const updatedEntries = reorderLockEntries(
      lockEntries,
      myIndex,
      lastAncestorIndex,
      self
    );

    expect(updatedEntries[myIndex]).toBe(self);
    expect(updatedEntries[lastAncestorIndex]).toBe(lastAncestor);
    lockEntries.forEach((entry) => {
      expect(updatedEntries).toContain(entry);
    });
  });
});

function splitEntries(content) {
  return content
    .split(/^\s*---\s*$/m)
    .map((e) => e.trim())
    .filter(Boolean);
}
