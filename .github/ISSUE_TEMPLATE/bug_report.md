---
name: Bug Report
about: Create a report to help us improve
title: "[BUG] "
labels: bug
assignees: ""
---

**Describe the bug**
A clear and concise description of the problem with your GitHub Action, workflow, or job.

**To Reproduce**
Steps to reproduce the workflow failure:

1. Provide a minimal workflow snippet (if applicable)

   ```yaml
   name: Example Workflow
   on: [push]
   jobs:
     example:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - name: Run step
           run: echo "Example"
   ```

2. Trigger the workflow by `...`

3. Observe failure at step `...`

4. Include any relevant logs or error messages.

**Expected behavior**

A clear and concise description of what you expected to happen (e.g., job should complete successfully, artifact should be uploaded, etc.).
