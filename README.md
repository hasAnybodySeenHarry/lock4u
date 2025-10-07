# Lock Manager

Lock Manager is a GitHub Action that manages state locks in your repository using Git. It allows workflows to **acquire**, **release**, or **wait** for a lock on a specific key, ensuring that critical operations execute in order and without conflicts.

---

## Why use Lock Manager?

GitHub Actions has a **built-in concurrency feature** with concurrency groups. While it ensures that only **one instance of a workflow or job runs at a time within a concurrency group**, it does **not guarantee the order** in which workflows run.

For example:

- You might have multiple workflows building images in parallel.
- You want to **queue them for versioning** in the order they start.

GitHub concurrency alone cannot enforce this ordering. **Lock Manager fills this gap**, allowing workflows to queue on a shared lock and execute critical sections **sequentially**.

This action enforces a linearizable ordering of workflow runs on shared resources. Each workflow “proposes” its operation by acquiring a lock in a Git branch. Workflows wait for their turn by polling the lock file, ensuring no two workflows update the same resource simultaneously and that operations happen in the order they arrive.

---

## Inputs

### `locks_dir`

- **Optional**
- Directory to store the lock file.
- If not provided, the branch name will be used as the directory.
- Default: `""`

### `locks_branch`

- **Optional**
- Git branch used to store lock files.
- Default: `"locks"`

### `action`

- **Required**
- Action to perform.
- Allowed values: `"acquire"`, `"release"`, `"wait"`

### `max_wait`

- **Optional**
- Maximum time in seconds to wait for a lock when `action` is `"wait"`.
- Must be greater than zero.
- Default: `3600` (1 hour)

### `sleep_interval`

- **Optional**
- Interval in seconds between retries while waiting for a lock.
- Must be greater than zero.
- Default: `5`

---

## Outputs

This action does **not produce any outputs**. It logs lock acquisition, release, and wait events.

---

## Notes

- ⚠️ Always include `actions/checkout` before using this action, as it relies on Git to manage lock files.

- This action works with **Node.js 24+** (`runs.using: "node24"`).

- Use this action when **order matters** across multiple workflow runs, something GitHub concurrency alone cannot guarantee.

---

## Example Usage: Sequential Versioning with Parallel Builds

This example demonstrates how to **run jobs in parallel** but enforce **sequential access** to a shared resource (e.g., versioning container images) using the Lock Manager action.

```yaml
jobs:
  get-lock:
    runs-on: ubuntu-latest
    steps:
      # Required: checkout repository
      - name: Checkout code
        uses: actions/checkout@v4

      # Acquire lock before doing any tasks
      - name: Acquire lock
        uses: hasAnybodySeenHarry/lock4u@v1
        with:
          locks_branch: locks
          action: acquire

  parallel-runnable:
    runs-on: ubuntu-latest
    steps:
      # Jobs that can run in parallel
      - name: Building container images
        run: |
          echo "Building container images in parallel"

  wait-for-lock:
    runs-on: ubuntu-latest
    steps:
      # Required: checkout repository
      - name: Checkout code
        uses: actions/checkout@v4

      # Wait for lock to proceed
      - name: Wait for lock
        uses: hasAnybodySeenHarry/lock4u@v1
        with:
          locks_branch: locks
          action: wait
          max_wait: 3600
          sleep_interval: 5

      # Critical section: versioning shared resources sequentially
      - name: Version images
        run: |
          echo "Versioning and tagging images sequentially"

      # Release lock so the next workflow can acquire it
      - name: Release lock
        uses: hasAnybodySeenHarry/lock4u@v1
        with:
          locks_branch: locks
          action: release
```
