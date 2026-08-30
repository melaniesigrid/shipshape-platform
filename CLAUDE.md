# Shipshape — working agreement

## Commit and push after every completed unit of work

This machine shuts down unexpectedly under memory pressure. Uncommitted work is
lost work.

**Rule: commit as soon as any coherent piece is finished — a package, a route, a
schema, a fix. Do not batch several units into one commit at the end.** If in
doubt, commit.

Never commit `.env`, `.env.local`, or anything holding a token. `.gitignore`
covers these; check `git status` before adding.

## What this is

Kanban boards plus readiness rubrics across a portfolio. The differentiator is
not the board — it is that a standard is written **once** and applied to **every**
project, and that the board and the rubric keep each other honest.

If a change makes Shipshape more like Trello and less like a standard applied
across a portfolio, it is the wrong change.

## Architecture

| Package | Role |
| --- | --- |
| `packages/core` | Pure domain. No I/O, no env, no database, no dependencies. Fully unit tested. |
| `packages/db` | Drizzle schema and tenant-scoped queries against Neon. |
| `packages/ui` | "Chart & Rule" tokens and presentational primitives. No hooks, no handlers — usable from server components. |
| `apps/web` | Next.js App Router. |

## Non-negotiables

- **Scoring lives in `packages/core`.** A query may load rows and store results;
  it must never compute a score. The same code has to run in a server action, a
  digest job, and a unit test.
- **Every tenant-scoped query takes an explicit `tenantId`.** No ambient tenant,
  ever. A missing scope must be a type error rather than a data leak.
- **All score math is integer.** Weights in whole points, credit in basis
  points. Never floats — two clients must never disagree about a rounding.
- **`not_applicable` leaves the denominator. `waived` earns credit and stays
  visible. A required criterion that is unmet blocks at any percentage.** These
  three rules are the product. Changing one changes what a score means, so it is
  a product decision, not a refactor.
- **Guidance is mandatory on every criterion.** If you cannot write what "met"
  looks like, the criterion is not ready to be scored.
- **The board suggests; a person decides.** Never write a criterion status from
  card movement. "The work is done" and "the standard is met" are different
  claims.
- **Published rubric versions are immutable.** New version, new row.
- **Validation is enforced server-side.** The UI may hide a field it does not
  need; the server checks the rule regardless. Server actions are public HTTP
  endpoints with a friendlier name — re-scope every id they receive.

## Commands

```bash
pnpm dev          # the app on :3000
pnpm test         # domain unit tests (no install required)
pnpm typecheck
pnpm db:push      # schema to Neon
pnpm db:seed      # built-in rubrics and the eight demo projects
```

## Repository

Part of the Northbound workspace, and its own git repo. Never run git from the
workspace root — sibling products live beside this one.

Read [TODOS.md](TODOS.md) before starting: it records precisely what has been
verified and what has only been written.
