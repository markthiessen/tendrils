---
description: Complete work in progress — simplify, mark done, record decisions, create PR
---

You are finalizing work in progress on the tendrils map. This command orchestrates the wrap-up: validating work is done, simplifying code, marking tasks complete, recording new decisions, and creating a PR.

## Repo binding

!`cat .tendrils/config.toml 2>/dev/null || echo "No .tendrils/config.toml found — repo role unknown"`

## In-progress tasks

!`td task list --status in-progress --json 2>/dev/null || echo "[]"`

## Current map

!`td map 2>/dev/null || echo "No map found."`

## Recent activity

!`td history --recent 2>/dev/null`

## Instructions

### Step 1: Gather in-progress work

Review the in-progress tasks above. Check that each task's work is actually complete by reviewing the code changes.

If there are no in-progress tasks, tell the user there's nothing to finalize and suggest running `/td-next` to pick up work first.

### Step 2: Validate completeness

For each in-progress task, verify the work is actually done:
- Check that the code changes match what the task description says
- Look at `git diff` and `git status` to confirm changes are present
- If any work is incomplete, ask the user whether to:
  - Complete it now
  - Skip it (mark as done anyway)
  - Leave the task in progress and finalize only the completed tasks

### Step 3: Simplify changed code

Run `/simplify` to review the changed code for reuse opportunities, quality issues, and efficiency improvements. Address any issues found before proceeding.

### Step 4: Mark tasks done

```bash
td task status <id> done --agent claude
td log <id> "Finalized — work complete" --agent claude
```

### Step 5: Record new decisions

Ask the user if any new technical decisions were made during this work that should be recorded. Prompt with specific suggestions based on what changed:
- New patterns or conventions introduced
- Architectural choices made
- Technology or library selections

If the user confirms decisions to record:
```bash
td decide "Description of decision" --tag <relevant-tags>
```

If the user has no decisions to record, skip this step.

### Step 6: Create PR

Run `/create-pr` to create a pull request. The PR should summarize the completed work, referencing the task IDs and what was accomplished.

## Guidelines

- **This is a wrap-up command** — it assumes work has already been done. If nothing is in progress, direct the user to `/td-next`.
- Validate before marking done — don't blindly mark tasks complete without checking.
- The `/simplify` step catches quality issues before they go into a PR.
- Keep the user in the loop — this command asks for confirmation at key points (incomplete work, decisions).
- If the user wants to skip steps (e.g., no decisions to record, skip simplify), respect that and move on.
