---
description: Analyze codebase and populate tendrils story map with existing features
argument-hint: [focus-area]
---

You are helping bootstrap a tendrils story map for an existing codebase. Your goal is to analyze the repo and create a comprehensive story map that reflects what has already been built, so the user can start planning new work from an accurate baseline.

## Current story map state

!`td map --export json 2>/dev/null || echo "{}"`

## Instructions

### Step 1: Understand the project

- Read the README, CHANGELOG, and any docs/ directory
- Examine the top-level directory structure
- Run `git log --oneline -50` to understand recent development history
- Run `git tag -l` to find release tags
- If a focus area was specified ("$ARGUMENTS"), concentrate on that area

### Step 2: Identify activities

Activities are high-level user goals or feature domains. Look for:
- Top-level source directories (e.g., `src/auth/` -> "Authentication")
- Major sections in the README
- Distinct functional areas visible in the codebase

For each activity, run:
```bash
td activity add "Activity Name" --desc "Description"
```

### Step 3: Break activities into tasks

Tasks are user-facing steps within an activity. Look for:
- Sub-modules or sub-directories within each activity area
- Distinct capabilities (e.g., under "Authentication": "Login", "Registration", "Password Reset")
- API route groups, controller groups, or service classes

For each task, run:
```bash
td task add A01 "Task Name" --desc "Description"
```

### Step 4: Create stories for implemented features

Stories are specific implementation items. For already-built features, create them as done:
```bash
td story add A01.T01 "Story title" --desc "What was implemented"
td status A01.T01.S001 ready
td status A01.T01.S001 claimed
td status A01.T01.S001 in-progress
td status A01.T01.S001 done
```

Look for stories by examining:
- Individual source files and their exports/classes
- Git log for feature commits
- Test files (each test suite often maps to a story)

### Step 5: Identify future work

Search for unfinished or planned work:
```bash
grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.js" --include="*.py" --include="*.rs" --include="*.go" -l .
```

Create these as backlog stories:
```bash
td story add A01.T01 "Fix: description from TODO" --desc "Found in path/to/file.ts"
```

### Step 6: Create releases

If git tags exist, create matching releases:
```bash
td release add "v1.0"
```

Assign completed stories to their releases based on git history.
If no tags exist, create a single "v1" release for all existing work.

### Step 7: Summary

After populating the map, run:
```bash
td map
td stats
```

Present a summary to the user:
- How many activities, tasks, and stories were created
- What areas of the codebase were covered
- Any areas that need manual refinement
- Suggested next steps for planning new work

## Guidelines

- Prefer fewer, well-named activities over many granular ones (3-8 is ideal)
- Each activity should have 2-5 tasks
- Stories should be concrete and specific, not vague
- Mark all existing implemented features as `done`
- Create future work items as `backlog`
- When in doubt, create fewer items — the user can always add more
- Use `--json` flag if you need to parse output programmatically
