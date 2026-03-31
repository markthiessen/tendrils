# Tendrils (`td`)

A CLI tool for managing product story maps that LLM agents can collaborate on.

Tendrils organizes work as a **story map**: Activities > Tasks > Stories. Agents can claim work, update status, and log progress — all from the command line with structured JSON output.

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

### 2. Build a story map

```bash
# Add activities (top-level goals)
td activity add "User Authentication"
td activity add "Payment Processing"

# Add tasks under an activity
td task add A01 "Login Flow"
td task add A01 "Registration"

# Add stories under a task
td story add A01.T01 "Email/password login"
td story add A01.T01 "OAuth2 provider support"
td story add A01.T02 "Sign-up form"

# Add checklist items scoped to repos
td story items A01.T01.S001 add "POST /auth/login endpoint" --role api
td story items A01.T01.S001 add "Login form component" --role web

# Mark stories as ready
td story status A01.T01.S001 ready
```

### 3. Agent workflow

```bash
# What should I work on next?
td next --json

# Claim a story
td story claim A01.T01.S001 --agent claude-1

# Update status
td story status A01.T01.S001 in-progress
td log A01.T01.S001 "Implemented email auth in src/auth.ts"

# Mark done
td story status A01.T01.S001 done
```

### 4. Visualize

```bash
td map                  # Render the story map
td stats                # Summary statistics
td status               # Show current repo and workspace config
```

## Concepts

### Story Map Hierarchy

```
Activity (A01)          — a high-level user goal ("User Authentication")
  └─ Task (A01.T01)    — a step within the activity ("Login Flow")
       └─ Story (A01.T01.S001) — an implementation item ("OAuth2 support")
```

Activities form the horizontal backbone. Tasks hang below them. Stories stack vertically under tasks, ordered by priority.

### Hierarchical IDs

Every item gets a stable, human-readable ID:

| Entity   | Format         | Example          |
|----------|----------------|------------------|
| Activity | `A{nn}`        | `A01`            |
| Task     | `A{nn}.T{nn}`  | `A01.T02`        |
| Story    | `A{nn}.T{nn}.S{nnn}` | `A01.T02.S001` |

Fully qualified with workspace: `my_project::A01.T02.S001`

### Story Statuses

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
# {"ok":true,"data":{"id":"A01.T01.S001","title":"OAuth2 support","status":"ready",...}}
```

Errors also return structured JSON:

```bash
td story claim A01.T01.S001 --json
# {"ok":false,"error":{"code":"ALREADY_CLAIMED","message":"Story is claimed by claude-2"}}
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
