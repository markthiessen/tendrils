---
description: Show tendrils map status and summarize progress
---

You are providing a quick status update on the tendrils map.

## Map

!`td map --format md 2>/dev/null || echo "No map found. Run 'td init' to get started."`

_Markdown: `## G<n> <goal>` headings, then `- [status] G<n>.T<nnn> <title> @claimed -> <deps>` per task. Status words and dependency arrows drive the summary._

## Statistics

!`td stats --format md 2>/dev/null`

_Counts of goals and tasks by status._

## Recent Activity

!`td history --recent --json 2>/dev/null`

_JSON array of log entries; read `created_at`, `entity_id`, `agent`, `message`, and `new_status` for what changed recently._

## Key Decisions

!`td decisions --format md 2>/dev/null`

_Markdown table with `ID | Decision | Tags | Agent | Date`; recent rows (highest D-numbers) are the freshest decisions._

## Instructions

Provide a concise status summary:

1. **In Progress**: What tasks are currently being worked on and by whom
2. **Blocked**: Anything that's blocked and why
3. **Up Next**: The highest-priority ready tasks (what `td next` would return)
4. **Recent Completions**: What was recently finished
5. **Key Decisions**: Highlight any recently recorded decisions that affect current work

Keep it brief — this is a quick check-in, not a deep analysis.
