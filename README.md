# Tendrils (`td`)

A CLI tool for managing work that LLM agents can collaborate on across repos.

Tendrils organizes work as a **map**: Goals > Tasks. Agents can claim work, update status, and log progress — all from the command line with structured JSON output.

## Install

**Latest build** (recommended):

```bash
npm install -g https://github.com/markthiessen/tendrils/releases/download/latest/tendrils-latest.tgz
```

**Local development**:

```bash
git clone git@github.com:markthiessen/tendrils.git
cd tendrils
npm install
npm link
```

## Quick Start

### 1. Initialize a workspace

```bash
cd your-repo
td init my_project --role api
```

This creates a workspace database at `~/.tendrils/workspaces/my-project/map.db`, binds the current directory via `.tendrils/config.toml`, and adds `.tendrils/` to `.gitignore`.

### 2. Build a map

```bash
# Add goals (high-level outcomes)
td goal add "User Authentication"
td goal add "Payment Processing"

# Add tasks under a goal
td task add G01 "Email/password login"
td task add G01 "OAuth2 provider support"
td task add G01 "Sign-up form"

# Add checklist items scoped to repos
td task items G01.T001 add "POST /auth/login endpoint" --role api
td task items G01.T001 add "Login form component" --role web

# Mark tasks as ready
td task status G01.T001 ready
```

### 3. Agent workflow

```bash
# What should I work on next?
td next --json

# Claim a task
td task claim G01.T001 --agent claude-1

# Update status
td task status G01.T001 in-progress
td log G01.T001 "Implemented email auth in src/auth.ts"

# Mark done
td task status G01.T001 done
```

### 4. Visualize

```bash
td map                  # Render the map
td stats                # Summary statistics
td status               # Show current repo and workspace config
```

## Concepts

### Map Hierarchy

```
Goal (G01)              — a high-level outcome ("User Authentication")
  └─ Task (G01.T001)   — a claimable unit of work ("OAuth2 support")
```

Goals form the horizontal backbone. Tasks stack vertically under goals, ordered by priority.

### Hierarchical IDs

Every item gets a stable, human-readable ID:

| Entity | Format         | Example    |
|--------|----------------|------------|
| Goal   | `G{nn}`        | `G01`      |
| Task   | `G{nn}.T{nnn}` | `G01.T001` |

Fully qualified with workspace: `my_project::G01.T001`

### Task Statuses

```
backlog → ready → claimed → in-progress → review → done
                                ↓
                             blocked
```

Any active status can transition to `cancelled`. `done` can reopen to `ready`.

## Multi-Repo Workspaces

Tendrils stores all data in `~/.tendrils/`, keeping your repos clean. Multiple repos can share one workspace:

```bash
# Bind different repos to the same workspace with roles
cd ~/code/backend && td init my_project --role api
cd ~/code/frontend && td init my_project --role web
cd ~/code/analytics && td init my_project --role analytics

# Check current configuration
td status

# Switch all repos to a new workstream
td workspace switch sprint-2
```

Workspace is resolved in order: `--workspace` flag, `TD_WORKSPACE` env var, `.tendrils/config.toml` in current/parent directory, or auto-detected if only one workspace exists.

### Decisions

Each repo can record technical decisions — architectural choices, conventions, and patterns:

```bash
td decide "Framework: Express with TypeScript" --tag stack
td decide "All endpoints return {ok, data, error} envelope" --tag convention,api
td decisions                    # List this repo's decisions
td decisions --repo ~/code/web  # View another repo's decisions
```

Decisions are per-repo and survive workspace switches. Use `/td-discover` to seed them from an existing codebase.

## JSON Output

Every command supports `--json` for machine-readable output:

```bash
td next --json
# {"ok":true,"data":{"id":"G01.T001","title":"OAuth2 support","status":"ready",...}}
```

Errors also return structured JSON:

```bash
td task claim G01.T001 --json
# {"ok":false,"error":{"code":"ALREADY_CLAIMED","message":"Task is claimed by claude-2"}}
```

## Claude Code Integration

Install slash commands for Claude Code:

```bash
td claude install        # Local to this project
td claude install -g     # Global (all projects)
```

This installs `/td-discover`, `/td-plan`, `/td-next`, and `/td-status` commands and optionally configures permissions.

## Environment Variables

| Variable      | Purpose                                   |
|--------------|-------------------------------------------|
| `TD_HOME`    | Override `~/.tendrils` (useful for testing) |
| `TD_WORKSPACE`| Set default workspace                     |
| `TD_AGENT`   | Set default agent name for claim/log       |

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run dev          # Run via tsx (no build needed)
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
```
