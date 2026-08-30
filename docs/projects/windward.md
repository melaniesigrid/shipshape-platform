---
name: Windward
slug: windward
status: building
color: "#3F7A6A"
rubric: Security baseline
score: 46
readiness: blocked
blocking: 5
summary: Portfolio grading across five pillars. Rails API plus a Python analytics engine.
---

## What it is

Investment portfolio grading. A Rails 8 API owns persistence and auth; a Python
FastAPI service owns the analytics. Every number the product displays is computed
in one of those two places, and the five pillars are the grading model.

## Who it is for

Not yet decided, and that is the honest answer. It is held to the security
baseline rather than launch readiness because it will handle other people's
financial data long before it handles their money.

## Where it stands

Building. Held to the security baseline deliberately: a multi-tenant product
touching financial data should clear that floor before it gets a landing page.

## What is actually blocking

Tenant isolation and server-side authorisation are both in progress, which is the
pair that matters most. Sessions are not hardened, nothing is rate limited, and
there is no written inventory of the personal data it holds.

Note: its project colour in the seed was the same hex as Shipshape's accent.
Moved here so the two stop reading as the same thing.

## Board

### Backlog
- [ ] Sessions signed, expiring and revocable `sec.session-hardening` !required
- [ ] Rate limit login and expensive endpoints `sec.rate-limiting` !required
- [ ] Written inventory of personal data held `sec.pii-inventory` !required

### In progress
- [ ] Every tenant-scoped query takes an explicit tenant id `sec.tenant-isolation` !required
  > The one that must be a type error, not a convention.
- [ ] Authorisation enforced on the server `sec.authz-server-side` !required
- [ ] Dependency audit `sec.dependency-audit`

### Done
- [x] No secret in the repository or client bundle `sec.secrets`
  > History scanned, not just the working tree.
- [x] Vendor terms permit this use of customer data `sec.third-party-terms`
