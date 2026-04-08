---
description: Pick up the next task and start working on it
---

You are picking up the next available task from the tendrils map and starting work on it.

**Args:** `$ARGUMENTS`

If args contain `auto`, run in **auto mode**: skip confirmation, complete tasks without asking, and loop until blocked or out of work. See Step 3 and Step 8 for how auto mode changes behavior.

## Repo binding

!`cat .tendrils/config.toml 2>/dev/null || echo "No .tendrils/config.toml found — repo role unknown"`

## Next item (with context bundle)

!`td next --context --json 2>/dev/null || echo "null"`

The context bundle includes: related decisions, architecture diagram + notes, dependency chain with outputs, and any rejection feedback from prior attempts. Use this instead of looking up decisions separately.

If `context.relevant_nodes` is non-empty, those are the architecture diagram nodes owned by this repo — focus your work on those components.

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

**Always work on a feature branch, never main.** Before starting, check the current branch. If you are on `main`, create a feature branch first:
```bash
git checkout -b <task-id-slug>   # e.g. g21-t086-contract-artifacts
```

In **normal mode**: ask the user to confirm before claiming.

In **auto mode**: claim immediately without asking.

```bash
td task claim <id> --agent claude
td task status <id> in-progress --agent claude
td log <id> "Starting work" --agent claude
```

### Step 4: Baseline check

Before touching any code, run the repo's test/build command to establish a clean baseline:

```bash
# Infer from package.json, Makefile, etc.
npm test        # or: make test, cargo test, go test ./...
npm run build   # if applicable
```

If tests or build fail before you've changed anything:
- Log the failure: `td log <id> "Baseline failing: <summary>" --agent claude`
- In **normal mode**: flag to the user and ask how to proceed
- In **auto mode**: set blocked and move on:
  ```bash
  td task status <id> blocked --reason "Baseline tests/build failing before any changes" --agent claude
  ```

Only proceed to Step 5 once baseline is green (or the user explicitly says to continue).

### Step 5: Implement

Read the task description carefully — it should include:
- Acceptance criteria ("Done when: ...")
- Entry point file paths to look at first (if missing, run `/td-refine` first)
- Relevant decision IDs to follow
- Stack/convention notes

Use the **context bundle** from the next item above:
- `context.decisions` — architectural decisions relevant to this repo
- `context.architecture` — the Mermaid architecture diagram
- `context.architecture_notes` — per-node notes with repo ownership
- `context.relevant_nodes` — diagram nodes owned by this repo (your components)
- `context.dependencies` — upstream tasks with their outputs (what was built)
- `context.feedback` — any rejection comments from prior review attempts (address these first!)

Implement only what this task scopes. As you work:
- If there is rejection feedback, address those issues **first**
- Write tests alongside implementation, not after — if Done-when mentions tests, they ship with the code
- Follow relevant architectural decisions from the context bundle
- **Do not commit.** Leave changes uncommitted — the user will commit and submit via `/td-submit` when ready
- Log progress: `td log <id> "Completed X" --agent claude`

### Step 6: Verify

Run tests and build again to confirm nothing is broken:

```bash
npm test
npm run build
```

Then walk each "Done when:" criterion from the task description and confirm it is satisfied. For each criterion, note the specific evidence (test output, file change, behavior observed).

Assemble structured proof with three parts:

1. **Changes** — what files were modified and why
2. **Verification evidence** — test results, build output, manual checks performed
3. **Acceptance criteria mapping** — each "Done when:" item paired with how it was met

This proof will be submitted in Step 8. Do not proceed until all criteria are met.

### Step 7: Self-review

Read your own diff and check for:

- **Scope creep** — changes outside what the task asked for
- **Dead code** — unused imports, variables, or functions introduced
- **Copy-paste duplication** — repeated blocks that should be extracted
- **Speculative additions** — features, config options, or abstractions not in the acceptance criteria
- **Convention violations** — patterns that conflict with decisions in the context bundle

Strip anything that fails these checks. If the diff exceeds ~200 lines, consider whether the task should have been split — flag this to the user in normal mode.

```bash
td log <id> "Self-review complete — <any issues found and fixed>" --agent claude
```

### Step 8: Wrap up and mark for review

Proof was assembled in Step 6. Before submitting, handle decision recording.

**Do not create a PR.** PR creation is the user's responsibility — they can run `/td-submit` when ready.

#### Record decisions

Review the work you just completed for new technical decisions worth recording — new patterns, conventions, architectural choices, or technology selections that future agents should know about. Only propose decisions that are **non-obvious from the code itself** and would change how someone approaches future work.

If you identify decisions to record, propose them to the user with a brief rationale. If the user confirms:
```bash
td decide "Description of decision" --tag <relevant-tags>
```

If nothing notable was introduced, skip this silently.

#### Submit for review

**Normal mode** — mark for review and stop:
```bash
td log <id> "Done — <brief summary of what was built>" --agent claude
td task status <id> review --agent claude --proof "<proof from Step 6>"
```
Then show the final map (`td map`) and point out any tasks that may now be unblocked.

**Auto mode** — mark done and loop:
```bash
td log <id> "Done — <brief summary of what was built>" --agent claude
td task status <id> done --agent claude --output "What was built — key files, endpoints, or components delivered" --proof "<proof from Step 6>"
```
Then run `td next --json` as a live command (not the pre-loaded output above). If another ready task is returned, go back to Step 3 and repeat. If the result is `null` or `data` is empty, stop and report how many tasks were completed. If a task hits a blocker during work, set it to blocked with a reason and stop the loop.

## Rationalizations

Common excuses agents use to skip steps — and why they're wrong:

- **"The task is too simple to need the full context bundle"** → Always read the context bundle. Simple-looking tasks often have hidden constraints buried in decisions or rejection feedback. Skipping it means you're guessing at requirements instead of reading them.

- **"I'll write tests after the implementation"** → Write or verify tests as part of the task, not after. "After" never comes — the next task arrives and you move on. If Done-when mentions tests, they're not optional cleanup.

- **"This convention doesn't apply here"** → Check the decision that established it before overriding. Conventions exist because someone hit a problem you haven't seen yet. If you genuinely need an exception, log it and flag it in your proof.

- **"I can skip the entry point and just search"** → Entry points exist to save you time and ensure you start in the right place. Searching cold means you'll likely find a similar-but-wrong file and build on the wrong foundation.

- **"The description is vague so I'll interpret it broadly"** → A vague description means you should clarify scope, not expand it. Ask or check sibling tasks before assuming work belongs in your task. Scope creep is the top cause of rejected reviews.

- **"The task is straightforward so I'll mark it done instead of review"** → In normal mode, you NEVER set status to `done`. Only `review`. The human decides when work is done — that's the entire point of the review step. Skipping it means shipping unreviewed work. Auto mode is the only path to `done`, and it must be explicitly requested.

- **"I'm already on main and it's just a small change"** → Always work on a feature branch — no exceptions. Working on main bypasses review, blocks `/td-submit` from creating a clean PR, and makes it impossible to revert a single task's work without collateral damage. Create the branch before you start.

- **"I'll commit as I go to save progress"** → Do not commit. Leave changes uncommitted. The user controls when and how work is committed — that's what `/td-submit` is for. Committing steals that choice and can produce a messy history the user didn't want.

- **"I already know this codebase well enough"** → Your knowledge is from a previous conversation. Files change between sessions. Read the entry points fresh every time — stale assumptions cause subtle bugs that pass a quick glance but fail in review.

## Guidelines

- **Read the description fully** before writing any code — it has the acceptance criteria and entry points
- Check `td decisions` for conventions referenced in the task description before making architectural choices
- Keep commits focused on the task being worked on
- If the task turns out to be bigger than expected, discuss with the user before splitting it
- If a task is blocked by another task's completion, set blocked status with a clear reason:
  ```bash
  td task status <id> blocked --reason "Waiting on G01.T002: <title>" --agent claude
  ```
