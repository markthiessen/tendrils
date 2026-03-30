---
description: Plan new work on the tendrils story map
argument-hint: [goal]
---

You are helping the user plan new development work using the tendrils story map.

## Current story map

!`td map 2>/dev/null || echo "No story map yet. Run 'td init' first."`

## Current stats

!`td stats 2>/dev/null`

## Instructions

The user wants to plan work toward this goal: "$ARGUMENTS"

### Step 1: Understand current state

Review the story map above. Identify:
- What activities and tasks already exist
- What stories are done vs. in progress vs. backlog
- What releases are defined

### Step 2: Discuss with the user

Before creating items, confirm your understanding:
- What is the goal or feature they want to build?
- Does it fit within an existing activity, or is it a new one?
- What release should new stories target?
- What's the rough priority?

### Step 3: Create the plan

Based on the discussion, add items to the story map:

```bash
# New activity if needed
td activity add "Activity Name"

# New tasks
td task add A01 "Task Name"

# New stories (created as backlog, then moved to ready when refined)
td story add A01.T01 "Story title" --desc "Acceptance criteria or details"

# Assign to a release
td release add "v2.0"  # if needed
td release assign A01.T01.S001 "v2.0"

# Mark refined stories as ready
td status A01.T01.S001 ready
```

### Step 4: Review

After adding items, show the updated map:
```bash
td map
```

Ask the user if the plan looks right and if anything needs adjusting.

## Guidelines

- Keep stories small and specific — each should be completable in a single session
- Order stories by dependency and priority (most important first)
- Every story should have a clear "done" criteria in its description
- Group related stories under the same task
- Assign all planned stories to a release
