# Tendrils (`td`)

A CLI tool for managing product story maps that LLM agents can collaborate on.

Tendrils organizes work as a **story map**: Activities > Tasks > Stories, sliced by Release. Agents can claim work, update status, and log progress — all from the command line with structured JSON output.

## Install

From git:

```bash
npm install -g git+https://github.com/markthiessen/tendrils.git
```

From a local clone:

```bash
git clone <repo-url>
cd tendrils
npm install    # automatically builds via prepare script
npm link       # makes 'td' available globally
```

## Quick Start

### 1. Initialize a project

```bash
cd your-repo
td init my-project
```

This creates a project database at `~/.tendrils/projects/my-project/map.db` and binds the current directory to it via `.tendrils.toml`.

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

# File a bug
td bug add "Login fails on Safari" --severity high --link A01.T01.S001

# Create releases and assign stories
td release add MVP
td release assign A01.T01.S001 MVP
```

### 3. Agent workflow

```bash
# What should I work on next?
td next --json

# Claim a story
td claim A01.T01.S001 --agent claude-1

# Update status
td status A01.T01.S001 in-progress
td log A01.T01.S001 "Implemented email auth in src/auth.ts"

# Mark done
td status A01.T01.S001 done
```

### 4. Visualize

```bash
td map                  # Render the story map
td map --release MVP    # Filter by release
td stats                # Summary statistics
```

## Concepts

### Story Map Hierarchy

```
Activity (A01)          — a high-level user goal ("User Authentication")
  └─ Task (A01.T01)    — a step within the activity ("Login Flow")
       └─ Story (A01.T01.S001) — an implementation item ("OAuth2 support")
```

Activities form the horizontal backbone. Tasks hang below them. Stories stack vertically under tasks, ordered by priority. Releases slice horizontally across the map.

### Hierarchical IDs

Every item gets a stable, human-readable ID:

| Entity   | Format         | Example          |
|----------|----------------|------------------|
| Activity | `A{nn}`        | `A01`            |
| Task     | `A{nn}.T{nn}`  | `A01.T02`        |
| Story    | `A{nn}.T{nn}.S{nnn}` | `A01.T02.S001` |
| Bug      | `B{nnn}`       | `B001`           |

Fully qualified with project: `my_project::A01.T02.S001`

### Story Statuses

```
backlog → ready → claimed → in-progress → review → done
                                ↓
                             blocked
```

Any active status can transition to `cancelled`. `done` can reopen to `ready`.

### Bug Statuses

```
reported → confirmed → claimed → in-progress → fixed → verified
                                      ↓
                                   blocked
```

## Multi-Project Support

Tendrils stores all data in `~/.tendrils/`, keeping your repos clean. You can work across multiple projects:

```bash
# Bind different repos to different projects
cd ~/code/backend && td init my_project
cd ~/code/frontend && td init my_project    # same project, different repo
cd ~/code/other && td init other_project        # different project

# Override project for a single command
td --project other_project story list
```

Project is resolved in order: `--project` flag, `TD_PROJECT` env var, `.tendrils.toml` in current/parent directory, or auto-detected if only one project exists.

## JSON Output

Every command supports `--json` for machine-readable output:

```bash
td next --json
# {"ok":true,"data":{"id":"A01.T01.S001","title":"OAuth2 support","status":"ready",...}}
```

Errors also return structured JSON:

```bash
td claim A01.T01.S001 --json
# {"ok":false,"error":{"code":"ALREADY_CLAIMED","message":"Story is claimed by claude-2"}}
```

## Environment Variables

| Variable     | Purpose                                   |
|-------------|-------------------------------------------|
| `TD_HOME`   | Override `~/.tendrils` (useful for testing) |
| `TD_PROJECT`| Set default project                        |
| `TD_AGENT`  | Set default agent name for claim/log       |

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run dev          # Run via tsx (no build needed)
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
```
