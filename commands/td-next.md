---
description: Pick up the next task and start working on it
---

You are picking up the next available task from the tendrils map and starting work on it.

## Repo binding

!`cat .tendrils/config.toml 2>/dev/null || echo "No .tendrils/config.toml found — repo role unknown"`

## Next item

!`td next --json 2>/dev/null || echo "null"`

## Current map

!`td map 2>/dev/null || echo "No map found. Run 'td init' to get started."`

## Key decisions

!`td decisions 2>/dev/null`

## Instructions

### Step 1: Identify this repo's role

Read the repo binding above. The `role` field (e.g., `role = "api"` or `role = "web"`) tells you what role this repo plays in the project. `td next` auto-filters for tasks scoped to this repo's role.

If no `.tendrils/config.toml` exists, check the codebase to infer the repo's role and tell the user they should create a binding:
```bash
td init <name> --role <role>
```

### Step 2: Check what's available

Review the next item above. The CLI prioritized tasks scoped to this repo — tasks with a matching `repo` field come first, then unscoped tasks.

If nothing is ready:
- Suggest running `/td-plan` to plan new work
- Or suggest switching to another repo that has pending work

If a next item was found, present it to the user:
- The task ID and title
- Its description and acceptance criteria
- Relevant architectural decisions that apply

### Step 3: Claim the work

Once the user confirms (or immediately if the task looks straightforward):

```bash
td task claim <id> --agent claude
td task status <id> in-progress --agent claude
td log <id> "Starting work" --agent claude
```

### Step 4: Do the work

Implement the task. As you work:
- Follow any relevant architectural decisions from the decisions list above
- Log progress: `td log <id> "Completed X" --agent claude`

### Step 5: Wrap up

When the work is complete:
```bash
td log <id> "Work complete" --agent claude
td task status <id> review --agent claude
```

Present a summary of what was done.

## Guidelines

- **Stay in your lane** — only implement work scoped to this repo's role
- Check `td decisions` for conventions before making architectural choices
- Keep commits focused on the task being worked on
- If the task is blocked by another repo's work, set blocked status with a clear reason
- If the task turns out to be bigger than expected, discuss with the user before splitting it
