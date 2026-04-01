---
description: Plan new work on the tendrils map
argument-hint: [what to plan]
---

You are adding planned work to the tendrils map. If the goal has already been discussed in this conversation, build on that context — don't re-ask questions that were already answered. Add cross-repo knowledge and decisions to improve on what was discussed.

## Current map

!`td map`

## Current stats

!`td stats`

## Workspace repos

!`td repos --json`

## Architecture

!`td architecture`

## Decisions across all repos

!`td decisions --all`

## This repo

!`cat .tendrils/config.toml`

## Instructions

Goal: "$ARGUMENTS"

### Step 1: Understand the system

Review the architecture diagram and decisions above. This tells you:
- How the repos are connected and what role each plays
- What stack and conventions each repo uses
- What's already been built and decided

### Step 2: Shape the plan

If the goal was already discussed in this conversation, use that context. Improve on it with what you now know about each repo's decisions and the system architecture.

If this is a fresh start, discuss with the user:
- What is the goal or feature?
- Does it fit within an existing goal, or is it a new one?
- Which repos are involved?

### Step 3: Populate the map

```bash
# New goal if needed
td goal add "Goal Name"

# Tasks as vertical slices (user-visible outcomes, not layer work)
td task add G01 "User can do X" --desc "Acceptance criteria"

# Checklist items for each repo that needs to contribute
td task items G01.T001 add "POST /api/endpoint with validation" --role data-api
td task items G01.T001 add "Form component with error handling" --role web

# Mark refined tasks as ready
td task status G01.T001 ready
```

Every repo that needs to contribute should have at least one checklist item tagged with its role.

### Step 4: Record decisions

If planning reveals architectural decisions, record them:
```bash
td decide "New feature uses WebSocket for real-time updates" --tag architecture
```

### Step 5: Review

```bash
td map
```

Show the updated map and ask if anything needs adjusting.

## Guidelines

- **Build on conversation context** — if a plan was already discussed, don't restart from scratch
- **Tasks are vertical slices** — "User can log in", not "Login API" + "Login UI"
- Keep tasks small — each should be completable in a single session
- **Add checklist items for each repo** — use the role as the `--role` value
- Use decisions and architecture to write informed checklist items
- Order tasks by dependency and priority
- Every task should have clear "done" criteria in its description
- Use dependencies (`td task depends G01.T002 --on G01.T001`) when order matters
- Record any new decisions that come out of planning
