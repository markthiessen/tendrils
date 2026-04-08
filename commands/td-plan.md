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

# Tasks as vertical slices — scope each task to a repo with --repo
td task add G01 "POST /api/endpoint with validation" --repo data-api --desc "Acceptance criteria"
td task add G01 "Form component with error handling" --repo web --desc "Acceptance criteria"

# Tasks without --repo are unscoped (any repo can pick them up)
td task add G01 "User can do X" --desc "Acceptance criteria"

# Mark refined tasks as ready
td task status G01.T001 ready
```

In multi-repo workspaces, create separate tasks for each repo's contribution using `--repo`. This lets each repo pick up and complete its own tasks independently.

### Step 4: Write task descriptions that travel

Agents in other repos load `td decisions` and the architecture diagram — don't repeat global context (stack, conventions) in task descriptions. Only write what can't be derived from there:

- **"Done when:"** — the specific acceptance criteria for this task
- **Entry point** — the file or endpoint to start from (saves search time)
- **Cross-repo contract** — if another repo's task depends on this one, spell out the interface: endpoint URL+method+shape, event name+payload, CLI flag+output. This is the one thing that can't live anywhere else.

**This repo's task** — include entry point:
```
Add --priority <high|normal|low> flag to 'td task add'. Store in tasks.priority (migration V9).
Entry: src/cli/commands/task.ts, src/db/schema.ts.
Done when: td task add G01 "title" --priority high stores the value and td task show returns it.
```

**Another repo's task** — define the contract, skip the file path:
```
# api repo task (you're planning from web — you don't know their files)
Expose POST /tasks/:id/priority {priority: "high"|"normal"|"low"} → {ok, data: {id, priority}}.
Done when: endpoint live and returning the envelope (D15).
```
```
# web repo task (you're in web — you know the file)
Priority badge on task cards. Reads from POST /tasks/:id/priority (see api task).
Entry: src/components/TaskCard.tsx.
Done when: badge visible and updates on click without page reload.
```

### Step 5: Tell other repos to refine

For any tasks you created scoped to another repo, note in your review output that the agent in that repo should run `/td-refine` before picking up work. They'll add the entry point — the one thing you can't provide from here.

### Step 6: Record decisions

If planning reveals architectural decisions, record them:
```bash
td decide "New feature uses WebSocket for real-time updates" --tag architecture
```

### Step 7: Review

```bash
td map
```

Show the updated map and ask if anything needs adjusting.

**STOP HERE. Do not begin implementing any tasks. Planning and implementation are separate steps — your job ends when the map is reviewed. Even if the user confirms the plan looks good, do not start building unless they explicitly ask you to implement or pick up a task (e.g. via `/td-next`).**

## Guidelines

- **Build on conversation context** — if a plan was already discussed, don't restart from scratch
- **Tasks are vertical slices** — "User can log in", not "Login API" + "Login UI"
- Keep tasks small — each should be completable in a single session
- **Scope tasks to repos** with `--repo` in multi-repo workspaces — each repo gets its own tasks
- **Keep descriptions short** — don't repeat global context (stack, conventions, decisions); only write what's unique to this task
- **Every task needs "Done when:"** — the acceptance criteria is the one thing that can't be looked up
- **This repo's tasks: name the entry point** — the file to start from; you know your own codebase
- **Other repos' tasks: define the contract, not the file** — you don't know their file paths; give them the interface (endpoint shape, event payload, CLI output) and let them find the entry point themselves
- **Cross-repo contracts are the handoff** — the producer task defines what it will deliver; the consumer task references it
- Order tasks by dependency and priority
- Use dependencies (`td task depends G01.T002 --on G01.T001`) when order matters
- Record any new decisions that come out of planning
