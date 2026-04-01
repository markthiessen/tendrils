---
description: Complete work in progress — mark done, log decisions, confirm map state
---

You are finalizing work in progress on the tendrils map. This command wraps up in-progress tasks: validating work is done, marking tasks complete, recording new decisions, and confirming the map is in a good state.

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

Review the in-progress tasks above. If there are no in-progress tasks, tell the user there's nothing to finalize and suggest running `/td-next` to pick up work first.

### Step 2: Verify code is shipped

Before marking anything done, confirm the work has been shipped — either merged to main or a PR is open:

```bash
git branch --show-current
git log main.. --oneline          # commits not yet on main
gh pr list --head $(git branch --show-current) --state open
```

- If the current branch **is** main, or `git log main..` is empty: work is merged — proceed.
- If an open PR exists for this branch: proceed.
- If neither: **stop here**. Tell the user the work needs a PR or to be merged before finalizing. Suggest running `gh pr create` to open one.

### Step 3: Validate completeness

For each in-progress task, verify the work is actually done:
- Check that code changes match what the task description says
- Look at `git diff` and `git status` to confirm changes are present
- If any work is incomplete, ask the user whether to:
  - Complete it now
  - Leave the task in progress and finalize only the completed tasks

### Step 4: Mark tasks done

For each completed task:
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

### Step 6: Confirm map state

Show the final map and confirm everything looks correct:
```bash
td map
```

Point out any tasks that appear stale (in-progress but not touched recently), blocked tasks that may now be unblocked, or goals where all tasks are done but the goal is still open.

## Guidelines

- **This is a wrap-up command** — it assumes work has already been done. If nothing is in progress, direct the user to `/td-next`.
- Validate before marking done — don't blindly mark tasks complete without checking.
- Keep the user in the loop — ask for confirmation at key points (incomplete work, decisions).
- Focus on map integrity: correct statuses, recorded decisions, clean state.
