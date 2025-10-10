# **Lock Queue: A Distributed Locking Abstraction for GitHub Workflows**

Lock Queue is a **distributed coordination primitive** that treats the Git commit history as a replicated log to enforce **mutual exclusion and sequential consistency**. It enables workflows to **acquire, release, or await a lock on a specified key**, ensuring that critical operations across concurrently executing workflows adhere to **linearizable ordering constraints**.

---

## **Motivation**

GitHub Actions' built-in concurrency groups provide **exclusion guarantees**, preventing simultaneous workflow execution on a shared resource. However, they **do not impose total order** across workflows that contend for the same resource. Lock Queue fills this gap by implementing a **first-come-first-serve queuing protocol** leveraging the Git commit log as a **distributed ledger**, providing:

1. **Deterministic, append-only log semantics**.
2. **Linearizable execution of critical sections**.
3. **Safe coordination without a centralized arbiter**.

By relying on the Git commit DAG as the **source of truth**, Lock Queue achieves **optimistic concurrency control** with **minimal coordination overhead**, enabling high throughput for non-critical parallelizable tasks while strictly serializing critical operations.

---

## **System Model**

Lock Queue assumes the following **distributed systems model**:

- Each workflow acts as a **client node** in a **cooperatively-consistent replicated log**.
- Workflows append proposed operations to a **shared lock file** stored in a dedicated branch, forming a **logical commit queue**.
- No **Byzantine behavior** is tolerated: all workflows are assumed to be **honest, non-malicious participants**.
- There is **no centralized arbiter**; correctness emerges from **voluntary adherence to the queuing protocol**.

This corresponds to a **peer-to-peer optimistic lock acquisition model**, analogous to **distributed consensus protocols** where participants maintain **local views of the global commit log**.

---

## **Operational Semantics**

1. **Acquire Operation**
   A workflow appends its identifier to the lock file and observes the commit log to determine its **logical position in the queue**. It proceeds only when its entry resides at the **head of the ledger**.

2. **Wait Operation**
   Workflows that have not yet reached the head execute a **voluntary backoff** loop, polling the commit log at configurable intervals (`sleep_interval`) until **their turn arises** or `max_wait` expires.

3. **Release Operation**
   Upon completing the critical section, the workflow removes its entry from the lock file, enabling **subsequent queued workflows** to advance in **FIFO order**, preserving **causal consistency** across dependent commits.

---

## **Advanced Feature: Voluntary Step-Down for Commit Ancestry Violations**

In repositories where workflows may be triggered on **descendant commits arriving ahead of ancestors**, Lock Queue implements an **ancestry-aware cooperative demotion protocol**:

- If a workflow detects that a **prior ancestor commit** has a pending lock, it **voluntarily steps down** instead of executing.
- The **ancestor workflow does not intervene**, preserving **trust invariants** and preventing potential **Byzantine-like disruption** of the queue.
- This mechanism enforces **temporal linearizability** across commits, analogous to enforcing **causal order in distributed ledgers**.

> **Design Assumption:**
> This protocol relies on **optimistic client-side cooperation** and assumes that workflows **adhere honestly** to the step-down procedure. Non-compliant participants could violate **sequential consistency guarantees**.

---

## **Inputs (Configuration Parameters)**

### `token`

- Optional GitHub token to access external/private repositories.

### `locks_dir`

- Filepath for storing lock metadata; defaults to branch name.
- Default: `""`

### `locks_branch`

- Git branch used as a **replicated commit log**.
- Default: `"locks"`

### `action`

- Lock operation to perform.
- Allowed values: `"acquire"`, `"release"`, `"wait"`

### `max_wait`

- Maximum time in seconds to wait for a lock when `action` is `"wait"`.
- Must be greater than zero.
- Default: `3600` (1 hour)

### `sleep_interval`

- Polling interval for voluntary waiting loops.
- Must be greater than zero.
- Default: `5`

### `step_down`

- Optional boolean flag for ancestry-aware voluntary demotion in the lock queue.
- When action is "wait", if set to "true" (case-insensitive), the workflow voluntarily steps down if there's a lock behind it for a prior ancestor commit.
- **Important**: This only works for entries on the same branch; locks on other branches are ignored.
- **Performance note**: Enabling this incurs additional Git operations (fetching commit history) for ancestry checks, which may slightly slow down the workflow.
- Any value other than "true" (or empty) defaults to false.
- Default: `"false"`

---

## **Outputs**

Lock Queue does **not produce programmatic outputs**; all coordination events are logged for **auditability**.

---

## **Illustrative Workflow Example**

The following pattern demonstrates **parallel execution of non-critical tasks with sequentialized critical operations**, leveraging Lock Queue as a **distributed mutual exclusion primitive**:

```yaml
jobs:
  acquire-lock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Acquire lock
        uses: hasAnybodySeenHarry/lock4u@v1
        with:
          action: acquire

  parallel-tasks:
    runs-on: ubuntu-latest
    steps:
      - name: Execute non-critical tasks in parallel
        run: echo "Parallel execution"

  critical-section:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Wait for lock
        uses: hasAnybodySeenHarry/lock4u@v1
        with:
          action: wait
          step_down: true
      - name: Execute critical section
        run: echo "Linearizable versioning operation"
      - name: Release lock
        uses: hasAnybodySeenHarry/lock4u@v1
        with:
          action: release
```

---

## **Theoretical Properties**

1. **Linearizability:** Each workflow executes its critical section **atomically at the position it occupies in the commit log**.
2. **FIFO Fairness:** Workflows are serialized in **arrival order**, preserving **causal precedence**.
3. **Optimistic Concurrency:** Non-critical tasks execute without blocking, while **critical sections voluntarily coordinate** via commit log inspection.
4. **Trust Assumptions:** Assumes **no Byzantine participants**; otherwise, sequential consistency guarantees are **not enforced**.

---

## **Contributions and Collaboration**

We **welcome issues, ideas, and contributions**!

- Have a question, bug report, or feature idea? Open an issue and start a discussion.
- Want to improve the action? Fork the repository, make your changes, and submit a pull request.
- Feedback, suggestions, and tips are all appreciated. Every contribution helps make **Lock Queue** more reliable and useful for everyone.
