# Shipshape — state of play

Written 2026-08-29, at the end of the first build session.

## What is verified

- **`packages/core` — 49 unit tests, all passing.** Run `pnpm test`, or
  `node --test 'test/*.test.ts'` inside the package; it has no dependencies, so
  it runs with no install. Covers scoring, the readiness bands, the
  not-applicable and waiver rules, rubric and assessment validation, portfolio
  rollups, sparse position ordering, WIP limits, board-to-rubric suggestions,
  and card generation.
- **Seed data integrity.** Every criterion key referenced in `seed.ts` resolves
  against its template, and each of the eight projects produces a plausible
  score (Northbound Studio 93% with one blocker, ZipQuarry 57% with nine).

## What is NOT yet verified

The machine this was built on has pnpm 6 globally and corepack could not fetch
a newer one, so **nothing has been installed, type-checked, built, or run.**
Treat the following as written-but-unproven:

- [ ] `pnpm install` resolves. Pinned versions were matched to Quotefront's
      working tree, but they have not been resolved together here.
- [ ] `pnpm typecheck` passes across all four packages.
- [ ] `pnpm db:push` produces the schema cleanly on a fresh Neon branch.
- [ ] `pnpm db:seed` runs end to end.
- [ ] `pnpm dev` boots and the four screens render.
- [ ] Tailwind picks up classes from `packages/ui` via the `@source` line in
      `globals.css`. If the primitives render unstyled, that line is the cause.
- [ ] The `tx as unknown as Database` cast in `applyRubricToProject` compiles.
      Drizzle types a transaction handle separately from the pool handle; if it
      objects, widen the helper's parameter type rather than loosening the cast.

**Start here on the next session**, in this order: install, typecheck, push,
seed, dev. Fix forward from whatever breaks first.

## Brand

Live at <https://melaniesigrid.github.io/shipshape-brand/> (public repo,
generated). The honest version, scored against the real portfolio, is
`brand/index.html` in this repo.

Open questions on the identity:

- [ ] The wordmark is set type, not a drawn mark. Needs one before anything
      goes public under the name.
- [ ] `--color-sea` is `#2F6F62`, which is the *same hex* as Windward's project
      colour in the seed. One of the two should move.
- [ ] Fraunces is doing display work at a single weight; the soft and wonk axes
      are untested.
- [ ] No iconography. The board's move controls are text arrows standing in.

## Known gaps, deliberately left

- **No self-serve signup.** Sign-in is invite-only — a token is only issued for
  an address that already has a user row. An open signup form on a product with
  no billing is a spam magnet.
- **No project or rubric creation UI.** Projects and rubrics come from the seed.
  Creating them in-app is the next real feature.
- **No rubric editor.** `validateRubric` exists and is tested; nothing calls it
  from a form yet.
- **Drag and drop uses the browser's HTML5 API**, which is weak on touch.
  Every card also has keyboard-reachable move buttons, which is the accessible
  path regardless. A pointer-based library is the eventual fix, but adding one
  unverified was not worth it.
- **No `activity` view.** The table is written on every assessment and move;
  nothing displays it yet.
- **No tests below `packages/core`.** Queries and actions are untested. The
  tenant-isolation test — proving one tenant cannot read another's rows — is the
  one to write first, and it is a criterion in the security baseline rubric this
  product ships with.
- **No CI.** No workflow file, no deploy configuration, no error tracking.

## Next three things, in order

1. **Get it running.** Install, typecheck, push, seed, boot. Nothing else
   matters until the eight seeded projects render.
2. **Tenant isolation test.** Two tenants, one query, prove the leak is
   impossible. Shipshape holding itself to its own security baseline is both the
   right engineering call and the demo.
3. **Create a project and a rubric from the UI.** Until then it is a viewer for
   seeded data, not a product.
