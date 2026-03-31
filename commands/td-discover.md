---
description: Analyze codebase and record decisions that document what exists
argument-hint: [focus-area]
---

You are analyzing a repo and recording what you find as **decisions** — the technical choices, feature implementations, and conventions that are already in place. This gives humans and agents context about the repo without having to read every file.

Decisions are per-repo. When decisions already exist, check for duplicates and only add what is new.

## Current decisions

!`td decisions --json`

## Instructions

### Step 1: Understand the codebase

- Read the README, CHANGELOG, and any docs/ directory
- Examine the top-level directory structure
- Run `git log --oneline -50` to understand recent development history
- Run `git tag -l` to find release tags
- If a focus area was specified ("$ARGUMENTS"), concentrate on that area
- **Review existing decisions above carefully.** Do not record duplicates.

### Step 2: Record feature decisions

For each user-facing capability you find in the codebase, record a decision documenting what was built and how. These should describe the **vertical feature** — the complete user-visible outcome, not individual layers.

**Good feature decisions:**
- "User login via POST /auth/login with JWT, LoginPage component on frontend"
- "Real-time activity feed using SSE on dashboard"
- "CSV export from admin reports panel"

**Bad feature decisions (too granular / horizontal):**
- "Login API endpoint" / "Login form component" / "Login database table"
- "Redux store for dashboard" / "Dashboard REST API"

```bash
td decide "User login with email/password — POST /auth/login, JWT tokens, LoginPage component" --tag feature,auth
td decide "Dashboard shows real-time activity feed via SSE" --tag feature,dashboard
```

Use `--tag feature` plus a domain tag (e.g., `auth`, `dashboard`, `admin`, `api`).

### Step 3: Record architectural decisions

Capture the technical choices that shape how work should be done in this repo:

- Framework and language choices
- Data storage and ORM
- Authentication and authorization strategy
- API conventions (REST/GraphQL, error formats, versioning)
- Deployment and infrastructure patterns
- Testing strategy and tools
- Code organization conventions

```bash
td decide "Framework: Express with TypeScript" --tag stack
td decide "SQLite with WAL mode, better-sqlite3 driver" --tag stack,data
td decide "Auth tokens stored in httpOnly cookies" --tag security,auth
td decide "API returns 422 for validation errors, not 400" --tag convention,api
td decide "Vitest for unit tests, Playwright for e2e" --tag testing
```

### Step 4: Record conventions and patterns

Look for patterns that aren't obvious from reading a single file but matter when writing new code:

- Naming conventions (file naming, ID formats, route patterns)
- Error handling patterns
- Logging and observability approach
- Configuration management
- Shared utilities or helpers that new code should reuse

```bash
td decide "Hierarchical IDs: A01.T01.S001 format, zero-padded" --tag convention
td decide "All CLI commands support --json flag for machine output" --tag convention,cli
```

### Step 5: Summary

After analyzing the codebase, run:
```bash
td decisions
```

Present a summary to the user:
- How many decisions were **added** (vs already existed), grouped by type:
  - Feature decisions (what's built)
  - Architectural decisions (technical choices)
  - Convention decisions (patterns to follow)
- Areas of the codebase that were covered

## Guidelines

- **Discover only records decisions. It does not create stories or modify the story map.** Planning is done with `/td-plan`.
- Use tags consistently: `feature` for capabilities, `stack` for technology choices, `convention` for patterns, `security` for auth/access concerns, plus a domain tag where relevant.
- When describing features, think in vertical slices — describe the full user-facing outcome, not individual code layers.
- Check existing decisions before adding. Avoid duplicates, especially across multi-repo runs.
- When extending from a previous run, look for capabilities in this repo that aren't yet documented — especially cross-repo features where this repo adds a new dimension (e.g., a mobile app consuming an API that was already documented from the backend repo).
- Prefer fewer, richer decisions over many thin ones. A decision like "User login with email/password — POST /auth/login, JWT, LoginPage" is better than three separate decisions for the endpoint, token strategy, and component.
- Record the `--agent` flag if running as an agent so the source of discovery is tracked.
