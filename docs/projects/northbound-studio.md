---
name: Northbound Studio
slug: northbound-studio
status: live
color: "#1C1C1C"
rubric: Launch readiness
score: 93
readiness: blocked
blocking: 1
summary: The studio site. The front door for everything else.
---

## What it is

The studio's own marketing site. Static, no accounts, no mailing list, nothing
sold — which is why most of the launch rubric legitimately does not apply to it.

## Where it stands

The highest score in the portfolio at 93%, and still blocked. That single blocker
is the clearest demonstration of the argument Shipshape makes: a percentage does
not clear a project.

## What is actually blocking

Terms of service and a privacy policy are in progress. It is one required
criterion on an otherwise finished site, and it is why the card reads red at 93%
rather than green.

Ten of this rubric's twenty criteria are marked not applicable — no billing, no
mailing list, no personal data, no environment variables. That is what keeps a
static site from being permanently capped by criteria written for a SaaS.

## Board

### In progress
- [ ] Terms of service and privacy policy `legal.terms-and-privacy` !required
  > The only thing between this site and a clear pass.

### Done
- [x] Core flow works end to end `product.core-flow-works`
- [x] Usable on a phone `product.mobile`
- [x] Marketing claims substantiated `legal.claims-substantiated`
- [x] SPF, DKIM and DMARC on the sending domain `email.sender-auth`
- [x] Inbound mail survives the DNS setup `email.inbound-survives-dns`
- [x] Deploying is one documented command `infra.deploy-is-repeatable`
- [x] A way to reach a human `support.contact-route`
