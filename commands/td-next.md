---
description: Pick up the next task and start working on it
---

You are picking up the next available task from the tendrils map and starting work on it.

**Args:** `$ARGUMENTS`

If args contain `auto`, run in **auto mode**: skip confirmation, complete tasks without asking, and loop until blocked or out of work. See Step 3 and Step 5 for how auto mode changes behavior.

## Repo binding

!`cat .tendrils/config.toml 2>/dev/null || echo "No .tendrils/config.toml found — repo role unknown"`

## Next item (with context bundle)

!`td next --context --json 2>/dev/null || echo "null"`

The context bundle includes: related decisions, architecture diagram, dependency chain with outputs, and any rejection feedback from prior attempts. Use this instead of looking up decisions separately.

## Current map

!`td map 2>/dev/null || echo "No map found. Run 'td init' to get started."`

## Instructions

### Step 1: Identify this repo's role

Read the repo binding above. The `repo` field (e.g., `repo = "api"` or `repo = "web"`) tells you what role this repo plays in the project. `td next` filters tasks to those scoped to this repo (or unscoped tasks).

If no `.tendrils/config.toml` exists, check the codebase to infer the repo's role and tell the user:
```bash
td init <name>
```

### Step 2: Check what's available

Review the next item above. If nothing is ready:
- Suggest running `/td-plan` to plan new work
- Or suggest switching to another repo that has pending work

If a next item was found:
- In **normal mode**: present it to the user — task ID, title, description, acceptance criteria, relevant decisions, blocking dependencies
- In **auto mode**: proceed directly to Step 3 without presenting or confirming

### Step 3: Claim the work

In **normal mode**: ask the user to confirm before claiming.

In **auto mode**: claim immediately without asking.

```bash
td task claim <id> --agent claude
td task status <id> in-progress --agent claude
td log <id> "Starting work" --agent claude
```

### Step 4: Do the work

Read the task description carefully — it should include:
- Acceptance criteria ("Done when: ...")
- Entry point file paths to look at first (if missing, run `/td-refine` first)
- Relevant decision IDs to follow
- Stack/convention notes

Use the **context bundle** from the next item above:
- `context.decisions` — architectural decisions relevant to this repo
- `context.architecture` — the Mermaid architecture diagram
- `context.dependencies` — upstream tasks with their outputs (what was built)
- `context.feedback` — any rejection comments from prior review attempts (address these first!)

Implement only what this task scopes. As you work:
- Follow relevant architectural decisions from the context bundle
- If there is rejection feedback, address those issues first
- Log progress: `td log <id> "Completed X" --agent claude`

### Step 5: Wrap up

**Normal mode** — mark for review and stop:
```bash
td log <id> "Done — <brief summary of what was built>" --agent claude
td task status <id> review --agent claude --proof "What was changed, how it was verified, how Done-when criteria are met"
```
Then run `/td-finalize` to record decisions and confirm map state.

**Auto mode** — mark done and loop:
```bash
td log <id> "Done — <brief summary of what was built>" --agent claude
td task status <id> done --agent claude --output "What was built — key files, endpoints, or components delivered"
```
Then run `td next --json` as a live command (not the pre-loaded output above). If another ready task is returned, go back to Step 3 and repeat. If the result is `null` or `data` is empty, stop and report how many tasks were completed. If a task hits a blocker during work, set it to blocked with a reason and stop the loop.

## Guidelines

- **Read the description fully** before writing any code — it has the acceptance criteria and entry points
- Check `td decisions` for conventions referenced in the task description before making architectural choices
- Keep commits focused on the task being worked on
- If the task turns out to be bigger than expected, discuss with the user before splitting it
- If a task is blocked by another task's completion, set blocked status with a clear reason:
  ```bash
  td task status <id> blocked --reason "Waiting on G01.T002: <title>" --agent claude
  ```
