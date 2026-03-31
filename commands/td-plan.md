---
description: Plan new work on the tendrils story map
argument-hint: [goal]
---

You are helping the user plan new development work using the tendrils story map.

## Current story map

!`td map`

## Current stats

!`td stats`

## Workspace repos

!`td repos --json`

## This repo

!`cat .tendrils/config.toml`

## Instructions

The user wants to plan work toward this goal: "$ARGUMENTS"

### Step 1: Understand current state

Review the story map above, then **fetch decisions from each repo** to understand what each repo does:
```bash
td decisions --repo /path/to/repo
```

Do this for every repo listed under "Workspace repos". This cross-repo context is critical for writing accurate checklist items — you need to know each repo's stack, conventions, and responsibilities.

Also review:
- What activities and tasks already exist in the story map
- What stories are done vs. in progress vs. backlog

### Step 2: Discuss with the user

Before creating items, confirm your understanding:
- What is the goal or feature they want to build?
- Does it fit within an existing activity, or is it a new one?
- What's the rough priority?
- Which repos are involved?

### Step 3: Create the plan

Based on the discussion, add items to the story map:

```bash
# New activity if needed
td activity add "Activity Name"

# New tasks
td task add A01 "Task Name"

# New stories as vertical slices (user-visible outcomes, not layer work)
td story add A01.T01 "User can do X" --desc "Acceptance criteria or details"

# Add checklist items for each repo that needs to contribute
# Use the role from `td repos` as the --role value
td story items A01.T01.S001 add "POST /api/endpoint with validation" --role data-api
td story items A01.T01.S001 add "Form component with error handling" --role web
td story items A01.T01.S001 add "Add auth check to proxy middleware" --role analytics-api

# Mark refined stories as ready
td status A01.T01.S001 ready
```

Every repo that needs to contribute to a story should have at least one checklist item tagged with its role.

### Step 4: Record decisions

If planning reveals new architectural decisions, record them:
```bash
td decide "New feature uses WebSocket for real-time updates" --tag architecture
td decide "File uploads go to S3 with presigned URLs" --tag storage
```

### Step 5: Review

After adding items, show the updated map:
```bash
td map
```

Ask the user if the plan looks right and if anything needs adjusting.

## Guidelines

- **Stories are vertical slices** — "User can log in", not "Login API" + "Login UI"
- Keep stories small and specific — each should be completable in a single session
- **Add checklist items for each repo** that needs to contribute — use the role as the `--role` value
- Use decisions from each repo to write informed, specific checklist items (e.g., if the data-api uses Express + Prisma, reference those in the item description)
- Order stories by dependency and priority (most important first)
- Every story should have a clear "done" criteria in its description
- Group related stories under the same task
- Record any new decisions that come out of planning
