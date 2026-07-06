# Tendrils

Tendrils is a CLI that organizes work for LLM agents across multiple repositories. It gives agents the structure they need — goals, tasks, dependencies, decisions, and architecture — so they can plan and execute without a central orchestrator.

You plan once. Agents pick up tasks, implement them, and ship through GitHub PRs. Dependencies resolve automatically.

---

## Setting up

A workspace ties related repos together. You initialize each repo and give it a role:

```bash
cd ~/code/api
td init my_project --role api

cd ~/code/web
td init my_project --role web
```

Both repos now share the `my_project` workspace. Each has its own role, its own decisions, but they **share a single map of work**.

Install the Claude Code slash commands so agents can interact with the map:

```bash
td claude install -g
```

---

## Discovering what's already there

Before planning new work, agents need to understand the codebase. In each repo, run:

```
/td-discover
```

The agent reads through the code and records **decisions** — the technical choices already in place. Things like "Express with TypeScript," "JWT auth with httpOnly cookies," or "all endpoints return a `{ok, data, error}` envelope."

It also builds an **architecture diagram** — a Mermaid diagram showing how the system's components connect. Both repos contribute to the same diagram, so any agent planning work can see how the pieces fit together.

Decisions and architecture are reference material. They **stay out of the way until an agent needs context** for planning or implementation.

---

## Planning work

Say you want to add a contact form that emails submissions to the site owner. From either repo:

```
/td-plan add a contact form that emails submissions to the site owner
```

The planner sees the architecture diagram and both repos' decisions. It creates a **goal** with **tasks** scoped to each repo and wires up dependencies:

```
G01  Contact form with email notifications
 +-- G01.T001  POST /contact endpoint + email sending    (api)
 +-- G01.T002  Contact form UI component                 (web)  <- depends on T001
```

The web task is blocked — it depends on the API being ready first. **Dependencies unblock automatically** when upstream tasks complete.

Planning works the same whether you're mapping out an MVP or just organizing a day's work.

---

## Refining tasks

The planner scoped work to each repo, but it doesn't know the local codebase in detail. In the web repo:

```
/td-refine
```

The agent explores the codebase and adds entry points to G01.T002 — which files to start from, which patterns to follow. This is the **handoff from planning to implementation**.

---

## Picking up work

In the API repo:

```
/td-next
```

The agent gets the next ready task for this repo. It receives a **context bundle** — not just the task description, but the decisions from this repo, the architecture diagram, the dependency chain, and any feedback from prior rejections. **It doesn't have to search for context.**

The agent claims G01.T001, creates a feature branch, implements the contact endpoint, runs tests, writes proof of completion, and marks it for review.

---

## Reviewing

```
/td-review
```

Every task goes through review on five axes: correctness, proof quality, conventions, scope, and completeness. The reviewer checks the diff against the acceptance criteria.

If something's off, the task gets sent back with specific feedback. That feedback gets **bundled into the agent's context the next time it picks up the task** — no information is lost between attempts.

If everything looks good, the task is accepted and any dependent tasks automatically unblock.

---

## Submitting and syncing

```
/td-submit
```

Submit commits the work, pushes the branch, and opens a PR. The task gets linked to the PR automatically.

After the PR merges on GitHub:

```
/td-sync
```

Sync checks GitHub for merged PRs and marks tasks as shipped. G01.T001 just shipped, so **G01.T002 in the web repo automatically unblocks**.

---

## The cycle continues

Switch to the web repo:

```
/td-next
```

G01.T002 is ready. The agent gets the full context bundle — including the output from the API task it depended on. **No manual handoff, no copy-pasting contracts between repos.**

The agent implements the contact form. From here the cycle repeats: implement, review, submit, sync. When all tasks under a goal are done, `/td-archive` retires it from the active map.

---

## Checking in

At any point, you can see where things stand:

```bash
td map          # the full map of goals and tasks
td stats        # counts by status
td decisions    # what's been decided in this repo
td arch show    # the architecture diagram
td repos        # which repos are in the workspace
```

Or from Claude Code:

```
/td-status
```
