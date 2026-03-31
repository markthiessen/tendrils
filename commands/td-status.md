---
description: Show tendrils story map status and summarize progress
---

You are providing a quick status update on the tendrils story map.

## Story Map

!`td map 2>/dev/null || echo "No story map found. Run 'td init' to get started."`

## Statistics

!`td stats 2>/dev/null`

## Recent Activity

!`td history --recent 2>/dev/null`

## Key Decisions

!`td decisions 2>/dev/null`

## Instructions

Provide a concise status summary:

1. **In Progress**: What stories/bugs are currently being worked on and by whom
2. **Blocked**: Anything that's blocked and why
3. **Up Next**: The highest-priority ready items (what `td next` would return)
4. **Cross-Repo Progress**: For in-progress stories, check their items (`td story items <id> list`) to show which repos have completed their part and which still have work remaining
5. **Recent Completions**: What was recently finished
6. **Release Progress**: How close each active release is to completion
7. **Key Decisions**: Highlight any recently recorded decisions that affect current work

Keep it brief — this is a quick check-in, not a deep analysis.
