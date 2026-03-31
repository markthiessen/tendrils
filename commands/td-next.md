---
description: Pick up the next story and start working on it
---

You are picking up the next available story from the tendrils story map and starting work on it.

## Repo binding

!`cat .tendrils/config.toml 2>/dev/null || echo "No .tendrils/config.toml found — repo role unknown"`

## Next item

!`td next --json 2>/dev/null || echo "null"`

## Current story map

!`td map 2>/dev/null || echo "No story map found. Run 'td init' to get started."`

## Key decisions

!`td decisions 2>/dev/null`

## Instructions

### Step 1: Identify this repo's role

Read the repo binding above. The `repo` field (e.g., `repo = "api"` or `repo = "web"`) tells you what role this repo plays in the project. This is critical — it determines:
- Which checklist items are yours to work on
- What kind of implementation to produce (API endpoints vs UI components vs CLI commands, etc.)
- Which items `td next` prioritized (it auto-filters for stories with incomplete items tagged to this repo)

If no `.tendrils/config.toml` exists, check the codebase to infer the repo's role and tell the user they should create a binding:
```bash
td init <name> --role <role>
```

### Step 2: Check what's available

Review the next item above. The CLI already prioritized items relevant to this repo — stories with incomplete checklist items tagged to this repo's role come first.

Note: `td next` automatically unblocks stories when it detects that the blocking repo's checklist items are now all done. If a story was blocked waiting on another repo and that work is complete, it moves back to `in-progress` and becomes available. You may see "Unblocked ..." messages in the output.

If nothing is ready:
- Check if there are items ready in other repos: `td next --json` without repo filtering may show work that belongs elsewhere
- Suggest running `/td-plan` to plan new work
- Or suggest switching to another repo that has pending work

If a next item was found, present it to the user:
- The item ID and title
- Its description and acceptance criteria
- Its full checklist: `td story items <id> list`
- **Highlight which checklist items are tagged for this repo** vs. other repos
- Note if items in other repos are blocking or need to be done first
- Relevant architectural decisions that apply

### Step 3: Claim the work

Once the user confirms (or immediately if the item looks straightforward):

```bash
td story claim <id> --agent claude
td story status <id> in-progress --agent claude
td log <id> "Starting work on <repo-role> items" --agent claude
```

### Step 4: Scope to this repo's contribution

For stories with checklist items, filter to the items tagged for this repo:
```bash
td story items <id> list
```

**Only implement the items tagged for this repo.** A story like "User can log in" might have:
- `[x] POST /auth/login endpoint with JWT` — repo: **api**
- `[ ] Login page with email/password form` — repo: **web**
- `[ ] Login CLI command` — repo: **cli**

If you're in the `web` repo, build the login page — don't touch the API endpoint.

If no checklist items exist yet, create them based on what this repo should contribute:
```bash
td story items <id> add "Description of this repo's work" --role <role>
```

If the story has items for other repos that aren't done yet and your work depends on them, flag this:
```bash
td story status <id> blocked --reason "Waiting on <other-repo> items: <description>" --agent claude
```

### Step 5: Do the work

Implement only this repo's portion of the story. As you work:
- Follow any relevant architectural decisions from the decisions list above
- Log progress with repo context: `td log <id> "[<repo-role>] Completed login form component" --agent claude`
- Mark checklist items done as you complete them: `td story items <id> done <item-number>`

### Step 6: Wrap up

When this repo's items are complete:
```bash
# Mark this repo's checklist items done
td story items <id> done <item-number>

# Log what was completed
td log <id> "[<repo-role>] All items complete" --agent claude
```

**Only move the story to review if ALL repos' items are done.** Check the full checklist:
```bash
td story items <id> list
```

- If all items across all repos are done → `td story status <id> review --agent claude`
- If only this repo's items are done → leave status as `in-progress` and tell the user which repos still have outstanding items

Present a summary of what was done and what remains across other repos.

## Guidelines

- **Stay in your lane** — only implement work tagged for this repo's role
- Stories are vertical slices — but each repo contributes its layer of that slice via checklist items
- Check `td decisions` for conventions before making architectural choices
- Keep commits focused on the story being worked on
- If the story is blocked by another repo's work, set blocked status with a clear reason
- If the story turns out to be bigger than expected, discuss with the user before splitting it
- If a story has no checklist items, create them — this helps the next repo know what's already done
