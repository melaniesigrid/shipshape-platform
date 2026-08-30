---
name: ReconAI
slug: reconai
status: building
color: "#4A4E8C"
rubric: Launch readiness
score: 28
readiness: blocked
blocking: 10
summary: Matches invoices against purchase orders and flags the differences.
---

## What it is

Invoice reconciliation. Drop in an invoice and its purchase order; it extracts
both into structured line items, matches them, and reports what differs — a
quantity, a rate, a line that appears on one and not the other.

## Who it is for

Anyone approving invoices against POs by hand. Bookkeepers, ops managers, small
finance teams.

## Where it stands

The earliest of the three TypeScript products by launch readiness, but the core
works: invoice and PO reconcile end to end across the sample set. It is a single
Next.js app with no database — state is per session, which is why several launch
criteria genuinely do not apply.

## What is actually blocking

Everything commercial. No billing, no legal, no support route, no error
tracking. The honest read is that this is a working demo rather than a product,
and the discovery rubric would probably tell you more about it right now than
the launch one does.

## Board

### Backlog
- [ ] Live payment keys in production `billing.live-keys` !required
- [ ] Payment webhooks verified and idempotent `billing.webhook-verified` !required
- [ ] Paying and non-paying accounts differ server-side `billing.entitlements` !required
- [ ] Terms of service and privacy policy `legal.terms-and-privacy` !required
- [ ] A customer can get their data deleted `legal.data-deletion` !required
- [ ] Errors reach a human `infra.error-tracking` !required
- [ ] A way to reach a human `support.contact-route` !required

### In progress
- [ ] Every screen has an empty state `product.empty-states`
- [ ] Failures are visible and recoverable `product.error-states` !required
- [ ] Production has every environment variable `infra.env-parity` !required
- [ ] Marketing claims substantiated `legal.claims-substantiated` !required

### Done
- [x] Core flow works end to end `product.core-flow-works`
  > Invoice and PO reconcile across the sample set.
- [x] Deploying is one documented command `infra.deploy-is-repeatable`
