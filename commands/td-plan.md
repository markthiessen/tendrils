---
description: Plan new work on the tendrils story map
argument-hint: [goal]
---

You are helping the user plan new development work using the tendrils story map.

## Current story map

!`td map 2>/dev/null || echo "No story map yet. Run 'td init' first."`

## Current stats

!`td stats 2>/dev/null`

## Key decisions

!`td decisions 2>/dev/null`

## Instructions

The user wants to plan work toward this goal: "$ARGUMENTS"

### Step 1: Understand current state

Review the story map and decisions above. Identify:
- What activities and tasks already exist
- What stories are done vs. in progress vs. backlog
- What releases are defined
- What architectural decisions constrain or guide new work

### Step 2: Discuss with the user

Before creating items, confirm your understanding:
- What is the goal or feature they want to build?
- Does it fit within an existing activity, or is it a new one?
- What release should new stories target?
- What's the rough priority?
- Which repos are involved? (check `.tendrils.toml` for the current repo role)

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
td story items A01.T01.S001 add "POST /api/endpoint with validation" --repo api
td story items A01.T01.S001 add "Form component with error handling" --repo web

# Assign to a release
td release add "v2.0"  # if needed
td release assign A01.T01.S001 "v2.0"

# Mark refined stories as ready
td status A01.T01.S001 ready
```

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
- **Add checklist items** for each repo that needs to contribute to a story
- Order stories by dependency and priority (most important first)
- Every story should have a clear "done" criteria in its description
- Group related stories under the same task
- Assign all planned stories to a release
- Check `td decisions` for existing conventions before proposing new patterns
- Record any new decisions that come out of planning
