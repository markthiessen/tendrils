---
description: Archive fully-completed goals from the active map
---

You are archiving completed goals to clean up the active map. Archived goals are hidden from `td map`, `td next`, and the kanban UI, but remain viewable via `td goal list --archived`.

## Current map

!`td map 2>/dev/null || echo "No map found."`

## All tasks

!`td task list --json 2>/dev/null || echo "[]"`

## Instructions

### Step 0: Sync shipped status

Before archiving, ensure shipped status is up to date. Run:

```bash
td sync
```

This checks done tasks against GitHub PRs and marks merged ones as shipped. `td goal archive` will warn if any done tasks aren't shipped yet.

### Step 1: Identify fully-completed goals

Review the map and task list above. A goal is fully completed when **every** task under it is `done` or `cancelled`. Never archive a goal that has tasks in any other status.

### Step 2: Propose archives

For each fully-completed goal, present it to the user with:
- The goal ID and title
- How many tasks were completed vs cancelled
- A proposed one-sentence summary of what was accomplished

Ask the user to confirm which goals to archive (or confirm all).

### Step 3: Archive confirmed goals

For each confirmed goal:

```bash
td goal archive <id> --summary "<one-sentence summary>"
```

If the command warns about unshipped tasks, run `td sync` first to check PR merge status. If tasks genuinely don't need PRs (e.g. planning-only tasks), use `--force`:

```bash
td goal archive <id> --summary "<summary>" --force
```

### Step 4: Show result

```bash
td map
td goal list --archived
```

Show the cleaned-up map and the list of archived goals.

## Guidelines

- **Always ask before archiving** — never archive without user confirmation.
- Summaries should describe what was built or decided, not just restate the goal title.
- If no goals are fully completed, tell the user and suggest running `/td-next` to continue work or `/td-review` to review pending tasks.
