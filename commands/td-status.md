---
description: Show tendrils map status and summarize progress
---

You are providing a quick status update on the tendrils map.

## Map

!`td map 2>/dev/null || echo "No map found. Run 'td init' to get started."`

## Statistics

!`td stats 2>/dev/null`

## Recent Activity

!`td history --recent 2>/dev/null`

## Key Decisions

!`td decisions 2>/dev/null`

## Instructions

Provide a concise status summary:

1. **In Progress**: What tasks are currently being worked on and by whom
2. **Blocked**: Anything that's blocked and why
3. **Up Next**: The highest-priority ready tasks (what `td next` would return)
4. **Recent Completions**: What was recently finished
5. **Key Decisions**: Highlight any recently recorded decisions that affect current work

Keep it brief — this is a quick check-in, not a deep analysis.
