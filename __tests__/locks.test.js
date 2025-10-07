/* eslint-disable no-undef */
import { buildLockEntry } from "../src/helpers.js";

describe("Lock Actions", () => {});

describe("Lock helpers", () => {
  test("buildLockEntry formats two entries correctly", async () => {
    const entry1 = await buildLockEntry({
      sha: "abc123",
      workflow: "Test Workflow",
      runId: 42,
      actor: "hasAnybodySeenHarry",
      commitMessage: "fix(auth): validate JWT tokens correctly (#JIRA-1234)",
    });

    const entry2 = await buildLockEntry({
      sha: "def456",
      workflow: "Another Workflow",
      runId: 43,
      actor: "enoki",
      commitMessage: "feat(ui): add loading spinner (#JIRA-5678)",
    });

    expect(entry1).toContain("commit_sha: abc123");
    expect(entry1).toContain("workflow: Test Workflow");
    expect(entry1).toContain("run_id: 42");
    expect(entry1).toContain("actor: hasAnybodySeenHarry");
    expect(entry1).toContain("commit_message: |");
    expect(entry1).toContain(
      "    fix(auth): validate JWT tokens correctly (#JIRA-1234)"
    );
    expect(entry1).toMatch(/timestamp: .*Z/);
    expect(entry1.endsWith("---\n")).toBe(true);

    expect(entry2).toContain("commit_sha: def456");
    expect(entry2).toContain("workflow: Another Workflow");
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
