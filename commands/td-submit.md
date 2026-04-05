---
description: Commit uncommitted work and create a PR from the current branch
---

You are submitting work from the current branch as a pull request. This command commits any uncommitted changes (with NO agent attribution), pushes the branch, creates a PR, and links related tasks to it.

**Args:** `$ARGUMENTS`

## Current state

!`git branch --show-current 2>/dev/null`
!`git status --short 2>/dev/null`
!`git log main.. --oneline 2>/dev/null || echo "No commits ahead of main."`

## Related tasks

!`td task list --json 2>/dev/null || echo "[]"`

## Instructions

### Step 1: Check branch

Read the current branch from the state above. If on `main`:
- Tell the user: "Refusing to submit from main. Create a feature branch first."
- Stop here.

### Step 2: Commit uncommitted changes

Check git status above. If there are uncommitted changes (staged or unstaged):

1. Stage all changes:
   ```bash
   git add -A
   ```

2. Draft a concise commit message summarizing the changes. **Do NOT include Co-Authored-By, Signed-off-by, or any agent attribution lines.**

3. Commit:
   ```bash
   git commit -m "<commit message>"
   ```

If there are no uncommitted changes, skip this step.

### Step 3: Check for PR template

Look for a PR template in the repo:

```bash
cat .github/pull_request_template.md 2>/dev/null || cat .github/PULL_REQUEST_TEMPLATE.md 2>/dev/null || echo "NO_TEMPLATE"
```

If a template is found, use it as the structure for the PR body in Step 4. Fill in each section from the template based on the work done on this branch.

If no template exists, use this default format for the PR body:

```
## Summary
<bullet points describing what changed>

## Changes
<list of key files modified and why>
```

### Step 4: Push and create PR

1. Push the branch:
   ```bash
   git push -u origin HEAD
   ```

2. Derive a PR title from the branch name or the work done — keep it under 70 characters.

3. Create the PR:
   ```bash
   gh pr create --title "<title>" --body "<body from Step 3>"
   ```

4. Capture the PR URL from the output.

### Step 5: Link tasks to PR

Find all tasks from this work session that should be linked — tasks with status `in-progress`, `review`, or `done` that were worked on in the current branch. Use the task list above to identify them.

For each related task:
```bash
td task status <id> --pr <pr_url> --agent claude
```

Report which tasks were linked.

### Step 6: Summary

Show the user:
- The PR URL
- Which tasks were linked
- The current map:
  ```bash
  td map
  ```

## Rationalizations

- **"There's nothing to commit, so I'll skip straight to the PR"** — Check first. Uncommitted changes are easy to miss in the status output. Always verify before skipping Step 2.

- **"I'll add Co-Authored-By since Claude helped"** — No. The task explicitly forbids agent attribution in commits. The PR itself provides the audit trail.

- **"The PR template doesn't fit this change"** — Fill in every section anyway. Templates exist for reviewer consistency. Mark sections as "N/A" if truly not applicable, but don't skip them.

- **"I'll just link the current task"** — Check for all related tasks from the session. Multiple tasks often land in a single PR. Missing a link breaks the PR-aware lifecycle.

## Guidelines

- **Never commit on main** — refuse and explain why
- **No agent attribution in commits** — no Co-Authored-By, no Signed-off-by, no bot signatures
- **Always push before creating the PR** — `gh pr create` needs the remote branch to exist
- **Use the repo's PR template if it exists** — don't invent your own format when one is provided
- **Link all related tasks** — not just the one you picked up, but any in-progress/review/done tasks from this branch
