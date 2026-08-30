---
name: Shipshape
slug: shipshape
status: building
color: "#356484"
rubric: Discovery
score: 44
readiness: blocked
blocking: 3
summary: Kanban boards and readiness rubrics across a portfolio. This one.
---

## What it is

A standard written once and applied to every project that should meet it. You
define a rubric, apply it across the portfolio, and each project's gaps become
cards on its own board carrying the criterion's guidance as acceptance criteria.

Cards name the criterion they exist to satisfy, which is what stops the rubric
from decaying into a document nobody updates.

## Who it is for

Studios, agencies and solo founders running more than one product at a time —
anyone who has been surprised twice by the same launch gap on two different
projects.

Northbound is customer zero. Four more named buyers to go.

## Where it stands

Building. The domain is complete and tested; the app is written but has never
been installed, type-checked or run, because this machine has pnpm 6 and corepack
cannot fetch a newer one.

Held to Discovery rather than Launch readiness on purpose. The question is not
whether it works — it is whether anyone but us would pay for it.

## What is actually blocking

Nobody outside Northbound has been spoken to, there is no willingness-to-pay
signal, and there are no written kill criteria. Those three decide whether this
gets another quarter.

## Board

### Backlog
- [ ] Speak to five studios running multiple products `disc.spoken-to-five` !required
- [ ] Write down what would make you stop `disc.kill-criteria` !required
- [ ] Get a willingness-to-pay signal `disc.paid-signal`
- [ ] Tenant isolation test, holding this product to its own security baseline
- [ ] Create a project and a rubric from the UI

### In progress
- [ ] Name five people who would buy this `disc.named-buyer` !required
  > Northbound is one. Four to go.
- [ ] Get the app running: install, typecheck, push, seed, boot

### Done
- [x] Write the problem in the customer's words `disc.problem-statement`
  > Eight projects, no shared definition of ready, and the same launch gap found twice by accident.
- [x] Know what they do today instead `disc.today-workaround`
  > TODOS.md files that drift, and a monthly panic re-read.
- [x] Define the smallest version worth paying for `disc.smallest-version`
- [x] Rubric scoring engine, 49 tests
- [x] Theming system, 200 tests, every palette contrast-checked
