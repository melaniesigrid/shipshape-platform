# Shipshape

Kanban boards and readiness rubrics across a portfolio of projects.

Most project tools track *what you are doing*. Shipshape also tracks *what
"done" is supposed to mean*, and it does that once for every project rather than
once per project. You write a standard — launch readiness, a security baseline,
whatever your business actually requires — apply it across the portfolio, and
each project's gaps become cards on its own board carrying the criterion's
guidance as acceptance criteria.

The question it is built to answer is not "how is this project doing". It is
**"which of the eight things we own still cannot take a payment"**.

---

## Status

Early. The domain is complete and tested; the schema and app are written but
have not yet been installed, built, or run against a live database. See
[TODOS.md](TODOS.md) for exactly what is verified and what is not.

## Getting started

```bash
pnpm install
cp .env.example .env.local        # fill in DATABASE_URL and SESSION_SECRET
pnpm db:push                      # create the schema on a Neon branch
pnpm db:seed                      # load the built-in rubrics and demo projects
pnpm dev                          # http://localhost:3000
```

Sign in with the email the seed created. With no `RESEND_API_KEY` set, the
magic link is printed to the **server console** rather than emailed — check the
terminal running `pnpm dev`.

```bash
pnpm test        # domain unit tests (no install needed: node --test)
pnpm typecheck
pnpm lint
```

## Brand

The Chart & Rule identity is at `brand/index.html` — a standalone page, no build
step, so the design can be judged before the app installs. Open it directly.

That page is scored against Northbound's **real** portfolio, which is why it is
not the one on the public URL. `node brand/build-public.mjs` swaps the portfolio
for illustrative data and refuses to write if any real project name survives;
its output is published at
<https://melaniesigrid.github.io/shipshape-brand/> from the public
[shipshape-brand](https://github.com/melaniesigrid/shipshape-brand) repo.

## Architecture

| Package | Role |
| --- | --- |
| `packages/core` | Pure domain: rubric scoring, board ordering, the board/rubric join. No I/O, no env, no database. Fully unit tested. |
| `packages/db` | Drizzle schema and queries against Neon Postgres. Every tenant-scoped query takes an explicit `tenantId`. |
| `packages/ui` | The "Chart & Rule" design system — tokens plus presentational primitives. |
| `apps/web` | Next.js App Router. Magic-link auth, the portfolio, the rubric editor, the board. |

### The model

- A **rubric** is a versioned set of **criteria**. Each criterion has a weight,
  a section, a `required` flag, and — not optional — **guidance** saying what
  "met" actually looks like. A criterion you cannot write guidance for is not
  ready to be scored.
- Applying a rubric to a **project** creates an assessment per criterion and,
  optionally, a card per gap.
- A **card** may name the criterion it exists to satisfy. That single foreign
  key is what stops the rubric from decaying into a document nobody updates.

### Scoring rules worth knowing

All integer math — weights in whole points, credit in basis points — so a
percentage never drifts between two clients.

| Status | Credit | Notes |
| --- | --- | --- |
| `met` | full | Evidence required when the criterion demands it |
| `in_progress` | half | Zero makes a long rubric feel static; full lets "nearly" pass as "done" |
| `not_started` | none | A criterion with no assessment counts as this, so a project cannot pass by never being looked at |
| `waived` | full | Clears the block, but stays on the record with a mandatory reason |
| `not_applicable` | — | Leaves the denominator entirely, so an irrelevant criterion cannot cap a project below 100% |

**A required criterion that is unmet blocks the project at any percentage.**
The score bar takes its colour from readiness rather than from the number, so a
project at 96% with one required gap still reads red. That is the whole argument
of the product.

### Non-negotiables

- **No ambient tenant.** Every query takes a `tenantId` argument. A forgotten
  scope is a type error, not a data leak.
- **The board suggests, a person decides.** Moving the last card for a criterion
  into a done column raises a suggestion. It never marks a criterion met — "the
  work is done" and "the standard is met" are different claims.
- **Guidance is mandatory.** The validator rejects a criterion without it.
- **Published rubric versions are immutable.** A new version is a new row, so a
  score recorded in March still means what it meant in March.
- **Evidence is enforced server-side.** The form hides the field when it is not
  needed; the server checks the rule regardless.

## Repository

Part of the Northbound studio workspace, and its own git repository. Sibling
products live beside it — do not run git from the workspace root.
