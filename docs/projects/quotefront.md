---
name: Quotefront
slug: quotefront
status: building
color: "#1E5D9E"
rubric: Launch readiness
score: 37
readiness: blocked
blocking: 11
summary: Photo-to-quote intake for trade businesses.
---

## What it is

A homeowner photographs the job. Vision reads the photos into structured
findings, and the contractor's own rate card turns those findings into a priced
band. The model never prices — that separation is what lets an estimate be
explained line by line.

## Who it is for

Trade contractors — roofing, painting, flooring and three more — who lose work
to whoever quotes first.

## Where it stands

Building. The domain is the strongest part: estimate line items reconcile
exactly to the final band, with a test across all six trades. What is missing is
everything around it — no billing, no legal, no error tracking.

## What is actually blocking

Nothing is sold yet, so all four billing criteria are open. Terms, privacy and
data deletion are untouched, which matters more here than elsewhere because the
product holds customers' property photos in private blob storage.

## Board

### Backlog
- [ ] Live payment keys in production `billing.live-keys` !required
- [ ] Payment webhooks verified and idempotent `billing.webhook-verified` !required
- [ ] Paying and non-paying accounts differ server-side `billing.entitlements` !required
- [ ] Terms of service and privacy policy `legal.terms-and-privacy` !required
- [ ] A customer can get their data deleted `legal.data-deletion` !required
  > Property photos are the customer's, not ours.
- [ ] Errors reach a human `infra.error-tracking` !required
- [ ] A way to reach a human `support.contact-route` !required

### In progress
- [ ] Core flow works end to end for a new account `product.core-flow-works` !required
- [ ] Failures are visible and recoverable `product.error-states` !required
- [ ] SPF, DKIM and DMARC on the sending domain `email.sender-auth` !required

### Done
- [x] Usable on a phone `product.mobile`
  > Intake is phone-first. That is where the photos are taken.
- [x] Production has every environment variable `infra.env-parity`
- [x] Database backups tested `infra.backups`
- [x] Deploying is one documented command `infra.deploy-is-repeatable`
