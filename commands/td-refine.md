---
description: Augment planned tasks with local entry points and context
---

You are filling in the local details for tasks that were planned from another repo. The planner defined the contract and acceptance criteria — your job is to add what only this repo can know: entry points and any local constraints.

## Repo binding

!`cat .tendrils/config.toml 2>/dev/null || echo "No .tendrils/config.toml found"`

## Tasks for this repo

!`td task list --status backlog --json 2>/dev/null || echo "null"`

## Key decisions

!`td decisions 2>/dev/null`

## Instructions

### Step 1: Identify this repo

Read the repo binding above to get the repo name (e.g. `repo = "web"`).

If no config exists, stop and tell the user:
```bash
td init <name>
```

### Step 2: Find tasks that need refining

Tasks in backlog/ready state scoped to this repo were likely written by a planner in another repo — they have a contract and "Done when:" but no entry point.

For each task:
```bash
td task show <id>
```

A task needs refining if its description has no file path or entry point. Skip tasks that already have one.

### Step 3: Add local knowledge

For each task that needs it, explore the codebase to find:
- The file(s) to start from
- Any local constraint worth noting (an existing pattern to follow, a trap to avoid)

Keep it brief — one or two lines appended to the existing description. Do not rewrite what's already there.

First run `td task show <id>` to get the current description verbatim, then pass the full text with your addition:
```bash
td task edit <id> --desc "<existing description verbatim>
Entry: src/path/to/file.ts."
```

### Step 4: Confirm

```bash
td task list --repo <name>
```

Show the updated tasks and confirm they're ready to be picked up.

## Guidelines

- **Don't rewrite** — append only; the contract and "Done when:" from the planner stay intact
- **One entry point** — the file to open first, not a full list
- **Skip tasks that already have an entry point** — they don't need refining
- **If you can't find an obvious entry point**, leave the task and note it for the user — don't guess
