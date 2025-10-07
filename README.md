# Lock Queue

Lock Queue is a GitHub Action that manages state locks in your repository using Git. It allows workflows to **acquire**, **release**, or **wait** for a lock on a specific key, ensuring that critical operations execute in order and without conflicts.

---

## Why use Lock Queue?

GitHub Actions concurrency groups prevent simultaneous runs but **don’t guarantee order**. Lock Queue fills this gap by providing a **first-come-first-serve queue** for workflows:

- Each workflow proposes its operation by appending an entry to a shared lock file in a Git branch.
- Workflows wait until they see their entry at the top before executing critical tasks.
- Non-critical tasks can run in parallel, but critical sections are **executed sequentially in arrival order**.

Lock Queue is **more than a mutex** as it enforces **deterministic, linearizable ordering** for workflows that share resources.

For example:

- You might have multiple workflows building images in parallel.
- You want to **queue them for versioning** in the order they start.

With this action, workflows wait for their turn by polling the lock file, ensuring no two workflows update the same resource simultaneously and that operations happen in the order they arrive.

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

- Always include `actions/checkout` before using this action, as it relies on Git to manage lock files.

- This action works with **Node.js 24+** (`runs.using: "node24"`).

- Use this action when **order matters** across multiple workflow runs, something GitHub concurrency alone cannot guarantee.

---

## Example Usage: Sequential Versioning with Parallel Builds

This example demonstrates how to **run jobs in parallel** but enforce **sequential access** to a shared resource (e.g., versioning container images) using the Lock Queue action.

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

---

## Contributing & Discussion

We **welcome issues, ideas, and contributions**!

- Have a question, bug report, or feature idea? Open an issue and start a discussion.
- Want to improve the action? Fork the repository, make your changes, and submit a pull request.
- Feedback, suggestions, and tips are all appreciated — every contribution helps make **Lock Queue** more reliable and useful for everyone.

Let’s collaborate to make workflows safer, more predictable, and easier to manage!
