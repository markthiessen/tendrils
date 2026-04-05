---
description: Review tasks submitted by agents — accept or send back with feedback
---

You are reviewing tasks that agents have submitted for review. Your role is **supervisor** — you inspect proof, diffs, and acceptance criteria, then accept or reject each task with feedback.

**Args:** `$ARGUMENTS`

If args contain `auto`, run in **auto mode**: loop through all review tasks and accept/reject each without asking the user. See Step 3 for how auto mode changes behavior.

## Review queue

!`td task list --status review --json 2>/dev/null || echo "[]"`

## Current map

!`td map 2>/dev/null || echo "No map found."`

## Instructions

### Step 1: Check the queue

Review the task list above. If no tasks are in `review` status:
- Tell the user the review queue is empty
- Suggest running `/td-next` to pick up work, or `/td-status` to check progress
- Stop here

If tasks are found:
- In **normal mode**: list them with ID, title, and claimed_by — ask which to review first
- In **auto mode**: proceed directly to Step 2 for the first task

### Step 2: Inspect each task

For each task in the review queue, gather the evidence:

```bash
td task show <id> --json
```

From the task JSON, extract:
- **Description** — the acceptance criteria ("Done when: ...")
- **Proof** — the structured proof the agent submitted (changes, verification, acceptance criteria mapping)
- **PR URL** — if present, fetch the diff

If the task has a `pr_url`:
```bash
gh pr diff <pr_url> --color=never
```

If no `pr_url`, check for recent commits by the claiming agent:
```bash
git log main.. --oneline --author=<claimed_by> 2>/dev/null
```

### Step 3: Evaluate on five axes

Score each axis **pass** or **flag**. A flag means the work does not meet the bar for that axis.

| # | Axis | Pass when | Flag when |
|---|------|-----------|-----------|
| 1 | **Correctness** | Code does what the task description says. No obvious bugs, broken logic, or missed edge cases. | Behavior diverges from task description, tests fail, or clear edge cases are unhandled. |
| 2 | **Proof quality** | Proof references concrete evidence — test output, build logs, specific file/line citations. Three-part structure (changes, verification, acceptance criteria mapping) is present. | Proof is vague ("it works"), missing sections, or contains no verifiable evidence. |
| 3 | **Conventions** | Follows patterns and decisions recorded in `td decisions`. No undocumented pattern drift. | Introduces new patterns that contradict existing decisions, or ignores conventions without justification. |
| 4 | **Scope** | Diff is limited to what the task asked for. No unrelated changes, speculative features, or drive-by refactors. | Contains changes outside the task boundary — unrelated cleanup, extra features, or files the task didn't mention. |
| 5 | **Completeness** | Every "Done when:" criterion from the task description is addressed in the proof with matching evidence. | One or more "Done when:" items are unaddressed, or tests required by the criteria are missing. |

Build a **scorecard** for each task:

```
Scorecard for <task-id>:
  1. Correctness:  pass | flag — <one-line reasoning>
  2. Proof quality: pass | flag — <one-line reasoning>
  3. Conventions:   pass | flag — <one-line reasoning>
  4. Scope:         pass | flag — <one-line reasoning>
  5. Completeness:  pass | flag — <one-line reasoning>
  Verdict: accept | reject
```

**Verdict rules:**
- All five axes pass → **accept**
- Any axis flagged → **reject**

**In normal mode**: present the scorecard to the user and ask whether to accept or reject. Include your recommendation.

**In auto mode**: apply the verdict rules automatically. Accept if all pass. Reject if any flagged.

### Step 4: Accept or reject

**To accept** (all axes pass):
```bash
td task accept <id> --agent claude --message "All review axes pass. <brief summary of what was verified>"
```

**To reject** (one or more axes flagged):

Rejection **must** specify which axes were flagged. Use this format:
```bash
td task reject <id> --agent claude --message "Flagged axes: <list>. <specific feedback per flagged axis: what failed, what to fix, file/line references>"
```

Example rejection:
```bash
td task reject <id> --agent claude --message "Flagged axes: Scope, Completeness. Scope: diff includes unrelated refactor of utils/logger.ts not in task description. Completeness: 'Done when: CLI help text updated' is not addressed — help output still shows old flag name."
```

Rejection messages must be actionable — the agent picking the task back up will see this as feedback in their context bundle. Every flagged axis must have specific feedback with file names, line numbers, or concrete observations.

### Step 5: Continue or finish

After processing a task:
- In **normal mode**: ask the user if they want to review the next task in the queue
- In **auto mode**: move to the next review task. Repeat Steps 2-4 until the queue is empty, then report a summary:
  - How many tasks were reviewed
  - How many accepted vs rejected
  - Brief reason for each rejection

Show the updated map when done:
```bash
td map
```

## Rationalizations

Common excuses to skip thorough review — and why they're wrong:

- **"The proof says it passes, so it must be fine"** — Proof is an agent's self-assessment. Your job is to verify it, not trust it. Check the diff against the criteria independently.

- **"The diff is small so it's probably correct"** — Small diffs can introduce subtle bugs. A one-line change can break everything. Review proportionally but never skip.

- **"I'll just accept it and fix issues later"** — Accepting a bad task unblocks dependents that build on broken foundations. Reject early, fix once.

- **"The task description is vague so anything reasonable should pass"** — If the description is vague, that's a planning problem. Reject with feedback asking for clearer criteria, or flag it to the user.

- **"Rejecting will slow things down"** — Accepting broken work slows things down more. A clean rejection with specific feedback gets resolved in one iteration. A bad acceptance creates cascading problems.

## Guidelines

- **Read the actual diff**, not just the proof summary — agents can claim they did things they didn't
- Rejection feedback should be specific enough that the agent can fix the issue without asking questions
- If a task was rejected before and resubmitted, check that the previous rejection feedback was addressed
- Don't reject for style preferences — only reject for criteria violations, bugs, or missing requirements
- If the PR has merge conflicts or CI failures, reject with that as the reason
