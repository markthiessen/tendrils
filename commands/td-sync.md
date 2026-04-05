---
description: Sync task shipped status by checking GitHub PR merge state
---

You are syncing the tendrils task map against GitHub to mark merged PRs as shipped. This command checks all done-but-unshipped tasks, queries their linked PRs, and marks shipped any whose PR has been merged.

**Args:** `$ARGUMENTS`

## Current state

!`td task list --json 2>/dev/null || echo "[]"`

## Instructions

### Step 1: Run sync

Execute the sync command:
```bash
td sync --json
```

Parse the JSON output. It returns an array of results, each with:
- `shortId` — task identifier (e.g., G18.T079)
- `title` — task title
- `shipped` — whether it was marked shipped
- `reason` — why (PR merged, PR not merged, No PR URL)

### Step 2: Report results

Present a clear summary to the user:

1. **Shipped tasks** — list each task that was just marked shipped, with its ID and title
2. **Not yet shipped** — list tasks whose PRs are still open, with their PR URLs
3. **Missing PR URL** — list tasks with no PR link (suggest running `td task status <id> --pr <url>` to fix)

If nothing was synced (no unshipped done tasks), say so and suggest checking task statuses.

### Step 3: Show map

Display the updated map:
```bash
td map
```

Point out any goals where all tasks are now shipped — these are candidates for `/td-archive`.

## Rationalizations

- **"There are no done tasks, so sync is pointless"** — Run it anyway. The command handles the empty case gracefully, and the user may not know the current state. Show the result rather than guessing.

- **"I'll just mark tasks shipped manually instead of using td sync"** — No. `td sync` checks actual PR merge status on GitHub. Manual shipping bypasses that verification and can mark unmerged work as shipped.

- **"The PR URL looks wrong so I'll skip that task"** — Report it. Let the user see which tasks have bad or missing PR URLs so they can fix them. Don't silently skip.

## Guidelines

- **Always use `td sync`, never manually call `shipTask` or update shipped status** — the command handles logging and verification
- **Report all categories** — shipped, not-shipped, and missing-PR tasks all matter to the user
- **Suggest `/td-archive` when appropriate** — if a goal has all tasks shipped, it's ready for archival
