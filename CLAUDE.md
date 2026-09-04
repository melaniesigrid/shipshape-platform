# Shipshape — working agreement

## Spending rule — before anything else

**No agent commits more than US$10 of vendor spend without asking Melanie first.**

This outranks finishing the task. An agent that stops at $10 and reports has done
the right thing; an agent that finishes the job and presents a bill has not,
however good the work is.

**What counts.** Anything metered by a third party with a card behind it —
Google Places/Maps, Anthropic, OpenAI, Gemini, Resend, Neon compute, Vercel
overages, ad spend, storage, build minutes.

**What to do.**

1. **Price the worst case out loud, before the first call.** Before any batch,
   backfill, bulk scoring run, eval sweep, or anything that loops over a corpus
   calling a vendor: compute `requests x unit price` using the vendor's real
   current per-SKU price — look it up, do not recall it — and state the number.
2. **If the worst case is over $10, stop and ask.** Say what you are doing, what
   it costs, and what it buys. Wait for a yes. Do not resume on your own
   judgment, and do not split the work into smaller runs to stay under the line.
3. **Never raise a cap, disable a guard, or route around a ledger to get
   unblocked.** Being blocked by a spend cap is the cap working.
4. **A new metered vendor needs a meter before its first call.** A vendor nothing
   meters is a vendor nothing caps.

**Four things that are not optional.**

- **The ceiling goes in before the loop does.** Anything calling a paid API more
  than once needs a hard maximum and a stop condition, written before the first
  run.
- **Cap the total, not the per-user share.** A per-user quota is not a bill: the
  bill is the sum over every user, and in development "every user" means every
  seed account, every dev auth seam, and every agent session that made one.
- **A cap in the code is not a cap.** The provider's own console needs a budget
  alert and a hard quota too. An application limit cannot survive a bug in the
  application, which is precisely when it is needed.
- **Kill a runaway before diagnosing it.** A retry storm, a loop that will not
  terminate, a hung job — stop it first, then investigate.

**Why, with the receipt.** Between 2026-08-24 and 2026-08-28 ZipQuarry billed
**US$671.66** of Google Places — 19,190 Text Search requests at the Enterprise
rate of $35/1,000 — on a $758.98 invoice, against a pre-revenue product with zero
customers and zero revenue. The meter was written four days after billing
started; a pagination loop billed a request every 300ms until it was killed by
hand; no console budget existed; the per-user quota was 400 requests/day, which
is $42/day across three dev accounts all comfortably inside their limits; and the
$200/month Google credit everyone was mentally budgeting against no longer exists
(it is per-SKU monthly free tiers now, and Text Search Enterprise gets 1,000
calls a month). Postmortem: `zipquarry-platform/docs/SPEND-INCIDENT-2026-08.md`.

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
