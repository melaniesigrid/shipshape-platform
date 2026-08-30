---
name: ZipQuarry
slug: zipquarry
status: live
color: "#B4562A"
rubric: Launch readiness
score: 57
readiness: blocked
blocking: 9
production: https://zipquarry.com
summary: Finds and qualifies local prospects, then writes the first email.
---

## What it is

Outbound prospecting for local service businesses. It hunts a postal area,
scores each business on how likely it is to buy, finds a contact, and drafts the
first email in the operator's voice. The operator sends it — ZipQuarry never
sends on their behalf.

## Who it is for

Small agencies and service businesses doing their own outbound, who have a
territory rather than a list.

## Where it stands

Live, and the furthest along of anything in the portfolio. The core loop works
end to end: hunt, score, find contact, draft. It is also the project with the
widest gap between "works" and "sellable" — the price is published and there is
no way to pay it.

## What is actually blocking

The $79 price is public and production holds no Stripe keys, so a visitor who
decides to buy cannot. Opt-out is built and the migration is applied, but it is
undeployed and there is no Resend key in production, which means bulk sending
has no working unsubscribe. Both are legal exposure, not polish.

DNS is a live constraint: the nameservers stay put. Moving them to a hosting
provider would kill inbound mail on the domain, and forwarding can receive but
cannot send.

## Board

### Backlog
- [ ] Live payment keys in production `billing.live-keys` !required
  > Price is public at $79. Production has no Stripe keys.
- [ ] A customer can get their data deleted `legal.data-deletion` !required
- [ ] Errors reach a human `infra.error-tracking` !required
- [ ] Self-serve cancellation `billing.cancellation`
- [ ] Getting-started documentation `support.onboarding-doc`

### In progress
- [ ] Deploy the unsubscribe endpoint `email.unsubscribe` !required
  > Built and migrated, but undeployed and no Resend key in production.
- [ ] Terms of service and privacy policy `legal.terms-and-privacy` !required
- [ ] SPF, DKIM and DMARC on the sending domain `email.sender-auth` !required

### Blocked
- [ ] Verify payment webhooks are idempotent `billing.webhook-verified` !required
  > Cannot be tested until live keys exist.

### Done
- [x] Core flow works end to end `product.core-flow-works`
- [x] Entitlement checks are server-side `billing.entitlements`
- [x] Inbound mail survives the DNS setup `email.inbound-survives-dns`
- [x] Database backups tested `infra.backups`
- [x] Marketing claims substantiated `legal.claims-substantiated`
