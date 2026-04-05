---
description: Analyze codebase, record decisions, and update architecture diagram
argument-hint: [focus-area]
---

You are analyzing a repo and recording what you find as **decisions** — the technical choices, feature implementations, and conventions that are already in place. This gives humans and agents context about the repo without having to read every file.

Decisions are per-repo. When decisions already exist, check for duplicates and only add what is new.

## Current decisions

!`td decisions --json 2>/dev/null || echo "[]"`

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
td decide "Hierarchical IDs: G01.T001 format, zero-padded" --tag convention
td decide "All CLI commands support --json flag for machine output" --tag convention,cli
```

### Step 5: Update the architecture diagram

Generate or update a Mermaid diagram that captures the system's high-level architecture. This diagram is workspace-level (shared across repos), so it should show the full system, not just the current repo.

First check the current diagram:
```bash
td arch --json
```

If no diagram exists, create one. If one exists, update it with any new components or connections you've discovered. The diagram should show:

- Major components/services (frontend, backend, database, external services)
- How they connect (HTTP, SSE, file system, etc.)
- Key technology labels on nodes

Use Mermaid `graph` or `flowchart` syntax. Keep it readable — show the **important** structural relationships, not every file.

```bash
td arch set "graph TD
  CLI[CLI - td]-->|reads/writes|DB[(SQLite)]
  CLI-->|serves|Server[Fastify Server]
  Server-->|SSE|UI[React SPA]
  Server-->|reads/writes|DB
  UI-->|HTTP API|Server"
```

Add notes to key nodes to capture non-obvious details:
```bash
td arch note DB "WAL mode, separate decisions.db per repo"
td arch note Server "Serves static UI build + REST API on same port"
```

### Step 6: Claim architecture nodes for this repo

If this repo has a role (check `.tendrils/config.toml` for `role = "..."`), link diagram nodes to the repo using `--repo`:

First check existing ownership:
```bash
td arch --json
```

For each node that this repo owns or is primarily responsible for, claim it:
```bash
td arch note CLI "Commander CLI entry point" --repo cli
td arch note Config ".tendrils/config.toml binding" --repo cli
```

Rules:
- **Claim nodes your repo implements** — if this repo contains the code for that component, claim it
- **Don't claim nodes owned by another repo** — if a note already has a different `repo_role`, leave it
- **Shared infrastructure nodes** (databases, config files) can be left unclaimed (null) or claimed by the repo that manages them
- **This step is idempotent** — re-running discover just confirms or updates existing ownership
- **Skip this step** if the repo has no role configured

### Step 7: Summary

After analyzing the codebase, run:
```bash
td decisions
td arch
```

Present a summary to the user:
- How many decisions were **added** (vs already existed), grouped by type:
  - Feature decisions (what's built)
  - Architectural decisions (technical choices)
  - Convention decisions (patterns to follow)
- Whether the architecture diagram was **created** or **updated**
- How many architecture nodes were **claimed** for this repo (if any)
- Areas of the codebase that were covered

## Guidelines

- **Discover records decisions and updates the architecture diagram. It does not create tasks or modify the map.** Planning is done with `/td-plan`.
- Use tags consistently: `feature` for capabilities, `stack` for technology choices, `convention` for patterns, `security` for auth/access concerns, plus a domain tag where relevant.
- When describing features, think in vertical slices — describe the full user-facing outcome, not individual code layers.
- Check existing decisions before adding. Avoid duplicates, especially across multi-repo runs.
- When extending from a previous run, look for capabilities in this repo that aren't yet documented — especially cross-repo features where this repo adds a new dimension (e.g., a mobile app consuming an API that was already documented from the backend repo).
- Prefer fewer, richer decisions over many thin ones. A decision like "User login with email/password — POST /auth/login, JWT, LoginPage" is better than three separate decisions for the endpoint, token strategy, and component.
- Record the `--agent` flag if running as an agent so the source of discovery is tracked.
