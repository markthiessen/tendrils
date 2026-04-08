---
description: Commit uncommitted work and create or update a PR from the current branch
---

You are submitting work from the current branch as a pull request. This command commits any uncommitted changes (with NO agent attribution), pushes the branch, creates or updates a PR, and links related tasks to it.

**Args:** `$ARGUMENTS`

## Current state

!`git branch --show-current 2>/dev/null`
!`git status --short 2>/dev/null`
!`git log main.. --oneline 2>/dev/null || echo "No commits ahead of main."`
!`gh pr view --json url,title,body 2>/dev/null || echo "NO_EXISTING_PR"`

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

### Step 4: Push and create or update PR

1. Push the branch:
   ```bash
   git push -u origin HEAD
   ```

2. Check the current state above for the `gh pr view` output. If a PR already exists for this branch, **update** it. If not, **create** one.

**If no existing PR:**

3. Derive a PR title from the branch name or the work done — keep it under 70 characters.
4. Create the PR:
   ```bash
   gh pr create --title "<title>" --body "<body from Step 3>"
   ```
5. Capture the PR URL from the output.

**If a PR already exists:**

3. Capture the PR URL from the `gh pr view` output.
4. Regenerate the PR body using the template/format from Step 3, incorporating any new commits.
5. Update the PR description:
   ```bash
   gh pr edit <pr_url> --body "<updated body from Step 3>"
   ```

### Step 5: Link tasks to PR

From the task list above, find **every** task whose `pr_url` is empty/null **and** whose status is one of: `claimed`, `in-progress`, `review`, or `done`. These are the tasks that need the PR attached.

For **each** matching task, run:
```bash
td task status <id> <current-status> --pr <pr_url> --agent claude
```

Use the task's **current** status as `<current-status>` so the command is a no-op status change that only attaches the PR.

Report which tasks were linked and which (if any) already had a PR.

### Step 6: Summary

**Always end by displaying the PR URL as a clickable link — this is the most important output of the command.** Show the user:
- **The PR URL** (e.g. `https://github.com/owner/repo/pull/123`) — always print this, whether the PR was just created or already existed
- Which tasks were linked
- The current map:
  ```bash
  td map
  ```

## Rationalizations

- **"A PR already exists, so there's nothing to do"** — Wrong. Push new commits, update the PR description to reflect all changes, and make sure the PR URL is linked on every related task.

- **"There's nothing to commit, so I'll skip straight to the PR"** — Check first. Uncommitted changes are easy to miss in the status output. Always verify before skipping Step 2.

- **"I'll add Co-Authored-By since Claude helped"** — No. The task explicitly forbids agent attribution in commits. The PR itself provides the audit trail.

- **"The PR template doesn't fit this change"** — Fill in every section anyway. Templates exist for reviewer consistency. Mark sections as "N/A" if truly not applicable, but don't skip them.

- **"I'll just link the current task"** — Check for ALL tasks with an active status (`claimed`, `in-progress`, `review`, `done`) that don't already have a `pr_url`. Multiple tasks often land in a single PR. Missing a link breaks the PR-aware lifecycle.

## Guidelines

- **Never commit on main** — refuse and explain why
- **No agent attribution in commits** — no Co-Authored-By, no Signed-off-by, no bot signatures
- **Always push before creating or updating the PR** — `gh pr create` needs the remote branch; `gh pr edit` needs the latest commits pushed
- **Use the repo's PR template if it exists** — don't invent your own format when one is provided
- **Link all related tasks** — any task with status claimed/in-progress/review/done and no existing `pr_url` gets linked
