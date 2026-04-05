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

### Step 3: Evaluate

Review the task against these criteria:

1. **Correctness** — Does the code do what the task asked for? Are there obvious bugs, edge cases missed, or broken logic?
2. **Proof quality** — Did the agent provide structured proof (changes, verification, acceptance criteria mapping)? Is the proof specific or hand-wavy?
3. **Conventions** — Does the code follow the project's established patterns and decisions? Any style violations or new patterns introduced without justification?
4. **Scope** — Is the diff limited to what the task asked for? Any scope creep, speculative features, or unrelated cleanup?
5. **Completeness** — Are all "Done when:" criteria addressed? Are tests included if the criteria mention them?

For each criterion, note whether it passes, fails, or needs attention.

**In normal mode**: present your findings to the user for each task and ask whether to accept or reject. Include your recommendation with reasoning.

**In auto mode**: make the decision yourself based on the criteria above. Accept if all five criteria pass. Reject if any criterion fails — provide specific feedback on what needs fixing.

### Step 4: Accept or reject

**To accept:**
```bash
td task accept <id> --agent claude --message "<brief summary of what was reviewed and why it passes>"
```

**To reject:**
```bash
td task reject <id> --agent claude --message "<specific feedback: which criteria failed, what to fix, and where>"
```

Rejection messages must be actionable — the agent picking the task back up will see this as feedback in their context bundle. Be specific: cite file names, line numbers, and the criterion that failed.

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
