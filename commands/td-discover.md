---
description: Analyze codebase and populate tendrils story map with existing features
argument-hint: [focus-area]
---

You are helping bootstrap a tendrils story map for an existing codebase. Your goal is to analyze the repo and create a comprehensive story map that reflects what has already been built, so the user can start planning new work from an accurate baseline.

**This command is designed to be run across multiple repos that belong to the same project.** When the map already has items, you must merge intelligently — reuse existing activities and tasks, avoid duplicates, and only add what is new.

## Current story map state

!`td map --export json 2>/dev/null || echo "{}"`

## Instructions

### Step 1: Understand the project and existing map

- Read the README, CHANGELOG, and any docs/ directory
- Examine the top-level directory structure
- Run `git log --oneline -50` to understand recent development history
- Run `git tag -l` to find release tags
- If a focus area was specified ("$ARGUMENTS"), concentrate on that area
- **Review the current story map state above carefully.** Note which activities, tasks, and stories already exist. You will need to build on this, not replace it.

### Step 2: Identify activities

Activities are high-level user goals or feature domains. Look for:
- Top-level source directories (e.g., `src/auth/` -> "Authentication")
- Major sections in the README
- Distinct functional areas visible in the codebase

**Before creating an activity, check the existing map.** If an activity already covers the same domain (even with a slightly different name), reuse it. Use `td activity list --json` to get current activity IDs.

Only create a new activity if it is genuinely distinct from all existing ones:
```bash
td activity add "Activity Name" --desc "Description"
```

### Step 3: Break activities into tasks

Tasks are user-facing capabilities within an activity. Think from the user's perspective:
- What can the user *do* within this activity? (e.g., under "Authentication": "Login", "Registration", "Password Reset")
- Group by user intent, not by code layer — "Login" is one task whether it involves an API endpoint, a form, and a database migration

Do NOT create separate tasks for backend vs frontend work. A task like "Login" covers everything needed for that capability to work end-to-end.

**Before creating a task, check the existing tasks under that activity.** Use `td task list <activity-id> --json` to see what exists. If a task already covers the same capability, reuse its ID for new stories instead of creating a duplicate.

Only create new tasks for capabilities not already represented:
```bash
td task add A01 "Task Name" --desc "Description"
```

### Step 4: Create stories as vertical feature slices

Stories represent complete features, not layers. Each story should describe a user-visible outcome that cuts across the full stack.

**Good stories (vertical slices):**
- "User can log in with email and password"
- "Dashboard shows real-time activity feed"
- "Admin can export reports as CSV"

**Bad stories (horizontal layers — do NOT create these):**
- "Login API endpoint" / "Login form UI" / "Login database schema"
- "Add Redux store for dashboard" / "Create dashboard REST API"
- "Backend validation for exports" / "Frontend download button"

When you find related backend and frontend code that serves the same user goal, consolidate them into a single story. Use the description to note which repos/layers contribute to it.

For already-built features, create them as done:
```bash
td story add A01.T01 "User can log in with email and password" --desc "API: POST /auth/login, UI: LoginPage component"
td status A01.T01.S001 ready
td status A01.T01.S001 claimed
td status A01.T01.S001 in-progress
td status A01.T01.S001 done
```

**Before creating a story, check `td story list <task-id> --json`.** If a story already exists that describes the same feature, skip it — even if this repo adds more implementation to that feature. Only create a new story if the capability is genuinely not represented yet.

### Step 4b: Add checklist items for cross-repo work

After creating stories, add structured checklist items that track what each repo needs to contribute. First check which repo you're in:

```bash
cat .tendrils.toml  # look for repo = "..." to know the current repo role
```

For each story, add items describing the concrete work this repo contributes:
```bash
td story items A01.T01.S001 add "POST /auth/login endpoint with JWT" --repo api
td story items A01.T01.S001 add "Login page with email/password form" --repo web
```

For already-done features, mark items as complete:
```bash
td story items A01.T01.S001 done 1
```

If a story already has items from a previous repo run (`td story items <id> list --json`), only add items for work you can see in *this* repo that isn't already represented.

To identify features, look across the codebase for:
- Complete user flows (route + handler + UI, or API + consumer)
- Git log for feature commits (commit messages often describe the user-facing outcome)
- Test files (integration/e2e tests often map to vertical stories)

### Step 5: Identify future work

Search for unfinished or planned work:
```bash
grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.js" --include="*.py" --include="*.rs" --include="*.go" -l .
```

Create these as backlog stories under the most appropriate existing task:
```bash
td story add A01.T01 "Fix: description from TODO" --desc "Found in path/to/file.ts"
```

### Step 6: Record architectural decisions

As you analyze the codebase, record key technical decisions that will help agents working across repos. Look for:
- Framework and language choices ("Express + TypeScript", "React 19 with Vite")
- Data storage ("PostgreSQL with Prisma ORM", "SQLite with WAL mode")
- Authentication strategy ("JWT in httpOnly cookies")
- API conventions ("REST, 422 for validation errors")
- Deployment patterns ("Docker on AWS ECS", "Vercel for frontend")

```bash
td decide "Framework: Express with TypeScript" --tag stack
td decide "Auth tokens stored in httpOnly cookies" --tag auth,security
td decide "API returns 422 for validation errors, not 400" --tag api-conventions
```

Check existing decisions first with `td decisions --json` to avoid recording duplicates.

### Step 7: Create releases

If git tags exist, create matching releases:
```bash
td release add "v1.0"
```

**Check existing releases first with `td release list --json`.** Do not create a release that already exists. Assign completed stories to their releases based on git history.
If no tags exist and no releases exist yet, create a single "v1" release for all existing work.

### Step 8: Summary

After populating the map, run:
```bash
td map
td stats
```

Present a summary to the user:
- How many activities, tasks, stories, and decisions were **added** (vs already existed)
- What areas of the codebase were covered
- Which existing activities/tasks were extended with new stories
- Key decisions recorded
- Any areas that need manual refinement
- Suggested next steps for planning new work

## Guidelines

- Prefer fewer, well-named activities over many granular ones (3-8 is ideal)
- Each activity should have 2-5 tasks
- Stories should be concrete, specific, and describe a user-visible outcome — not a code change
- **Always think in vertical slices.** If you find yourself writing "API for X" and "UI for X" as separate stories, merge them into "User can X".
- Mark all existing implemented features as `done`
- Create future work items as `backlog`
- When in doubt, create fewer items — the user can always add more
- Use `--json` flag if you need to parse output programmatically
- **When extending an existing map, always list before adding.** Run `td <entity> list --json` to check what exists before creating anything. This is critical to avoid duplicates across multi-repo runs.
- **Reuse over recreate.** If "Authentication" activity exists and this repo also has auth code, add stories to the existing activity/tasks rather than creating "Authentication (API)" as a separate activity.
