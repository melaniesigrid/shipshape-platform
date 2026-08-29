/**
 * Built-in rubric templates.
 *
 * These ship with the product because a blank rubric editor is a wall nobody
 * climbs. They are opinionated on purpose — a customer's first move should be
 * deleting the three criteria they disagree with, not inventing eighteen from
 * nothing.
 *
 * Launch Readiness is drawn from real Northbound launch failures: a public price
 * with no live payment keys behind it, a mailing list with no way off it, a DNS
 * change that would have silently killed inbound mail.
 */

import type { Rubric, RubricCriterion } from "./types.ts";

function criterion(
  id: string,
  section: string,
  title: string,
  guidance: string,
  weight: number,
  required = false,
  evidenceRequired = false,
): RubricCriterion {
  return { id, section, title, guidance, weight, required, evidenceRequired };
}

/**
 * Can a stranger find this, use it, pay for it, and get help — without you in
 * the room?
 */
export const LAUNCH_READINESS: Rubric = {
  id: "launch-readiness",
  name: "Launch readiness",
  version: 1,
  description:
    "The standard a product must clear before it takes money from someone you have never met. Every required criterion here has been the thing that broke a real launch.",
  passThreshold: 85,
  criteria: [
    // Product ---------------------------------------------------------------
    criterion(
      "product.core-flow-works",
      "Product",
      "The core flow works end to end for a new account",
      "Someone with no existing data signs up, completes the one thing the product promises, and sees a result. Verified in a real browser on a production build, not a dev server.",
      10,
      true,
      true,
    ),
    criterion(
      "product.empty-states",
      "Product",
      "Every screen has an empty state",
      "No screen renders a bare table header or a blank panel on a fresh account. Each says what goes here and how to add the first one.",
      4,
    ),
    criterion(
      "product.error-states",
      "Product",
      "Failures are visible and recoverable",
      "A failed save, a timeout, and a rejected upload each produce a message a non-technical user can act on. No silent failures, no raw stack traces.",
      5,
      true,
    ),
    criterion(
      "product.mobile",
      "Product",
      "Usable on a phone",
      "The primary flow completes on a 390px viewport without horizontal scrolling. Marketing pages included.",
      4,
    ),

    // Billing ---------------------------------------------------------------
    criterion(
      "billing.live-keys",
      "Billing",
      "Live payment keys are set in production",
      "If a price is published anywhere, production holds live payment provider keys and a real card completes a purchase. A public price with test keys behind it is a broken promise, not a soft launch.",
      10,
      true,
      true,
    ),
    criterion(
      "billing.webhook-verified",
      "Billing",
      "Payment webhooks are verified and idempotent",
      "The webhook endpoint checks the provider signature and processes a repeated event without double-granting access. Tested with a replayed event.",
      7,
      true,
    ),
    criterion(
      "billing.entitlements",
      "Billing",
      "Paying and non-paying accounts actually differ",
      "An unpaid account is blocked from the paid surface by a server-side check, not a hidden button.",
      7,
      true,
    ),
    criterion(
      "billing.cancellation",
      "Billing",
      "A customer can cancel without emailing you",
      "Self-serve cancellation exists and is reachable from the account screen.",
      4,
    ),

    // Legal -----------------------------------------------------------------
    criterion(
      "legal.terms-and-privacy",
      "Legal",
      "Terms of service and a privacy policy are published",
      "Both are linked from the marketing site and the signup form, name the real operating entity, and describe what data is actually collected.",
      6,
      true,
      true,
    ),
    criterion(
      "legal.data-deletion",
      "Legal",
      "A customer can get their data deleted",
      "A documented route to deletion exists and someone has run it end to end at least once.",
      5,
      true,
    ),
    criterion(
      "legal.claims-substantiated",
      "Legal",
      "Marketing claims can be substantiated",
      "Every number and superlative on the marketing site traces to something you could show a regulator. No invented customer counts, no unearned testimonials.",
      5,
      true,
    ),

    // Email -----------------------------------------------------------------
    criterion(
      "email.unsubscribe",
      "Email",
      "Every bulk email carries a working unsubscribe",
      "One click, no login, honoured on the next send, and recorded. Required by CAN-SPAM and CASL, and the deploy has actually happened — built but undeployed does not count.",
      8,
      true,
      true,
    ),
    criterion(
      "email.sender-auth",
      "Email",
      "SPF, DKIM and DMARC pass on the sending domain",
      "Verified against the live DNS, from the address the product actually sends from.",
      6,
      true,
      true,
    ),
    criterion(
      "email.inbound-survives-dns",
      "Email",
      "Inbound mail survives the DNS setup",
      "Whoever owns DNS has confirmed that the current nameserver and MX arrangement still delivers mail to the team's addresses. Changing nameservers for a hosting provider has silently killed inbound mail before.",
      5,
      true,
    ),

    // Infrastructure --------------------------------------------------------
    criterion(
      "infra.env-parity",
      "Infrastructure",
      "Production has every environment variable it needs",
      "A checked-in .env.example lists every variable, and production has a value for each. Verified against the deployed environment, not a local file.",
      6,
      true,
    ),
    criterion(
      "infra.error-tracking",
      "Infrastructure",
      "Errors reach a human",
      "Server and client exceptions land somewhere a person looks, with enough context to reproduce.",
      6,
      true,
    ),
    criterion(
      "infra.backups",
      "Infrastructure",
      "The database is backed up and a restore has been tested",
      "Automated backups are on, and a restore has been performed at least once. An untested backup is a hypothesis.",
      6,
      true,
    ),
    criterion(
      "infra.deploy-is-repeatable",
      "Infrastructure",
      "Deploying is one documented command",
      "Written down, runnable by someone who has not deployed it before, and it publishes only what was intended.",
      4,
    ),

    // Support ---------------------------------------------------------------
    criterion(
      "support.contact-route",
      "Support",
      "There is a way to reach a human",
      "A monitored address or form, reachable from inside the product, with a stated response time.",
      4,
      true,
    ),
    criterion(
      "support.onboarding-doc",
      "Support",
      "A new user can get started without you",
      "A getting-started page or in-product walkthrough covers the first session end to end.",
      3,
    ),
  ],
};

/** Applies the moment a product touches a stranger's data, inbox, or money. */
export const SECURITY_BASELINE: Rubric = {
  id: "security-baseline",
  name: "Security and privacy baseline",
  version: 1,
  description:
    "The floor for any multi-tenant product holding customer data. Scored before a schema or auth change goes live, not after.",
  passThreshold: 90,
  criteria: [
    criterion(
      "sec.tenant-isolation",
      "Isolation",
      "Every tenant-scoped query takes an explicit tenant id",
      "No ambient tenant anywhere. A missing scope is a type error, not a data leak, and there is a test that proves one tenant cannot read another's rows.",
      10,
      true,
      true,
    ),
    criterion(
      "sec.authz-server-side",
      "Isolation",
      "Authorisation is enforced on the server",
      "Every mutation re-checks the caller's right to the row. Hiding a control in the UI is not authorisation.",
      10,
      true,
    ),
    criterion(
      "sec.secrets",
      "Secrets",
      "No secret is in the repository or the client bundle",
      "History has been scanned, not just the working tree. Anything ever committed has been rotated.",
      9,
      true,
      true,
    ),
    criterion(
      "sec.session-hardening",
      "Auth",
      "Sessions are signed, expiring, and revocable",
      "HttpOnly, Secure, SameSite cookies with a real expiry, and signing out invalidates server-side.",
      7,
      true,
    ),
    criterion(
      "sec.rate-limiting",
      "Auth",
      "Login and expensive endpoints are rate limited",
      "Per-identifier limits on auth, uploads, and anything calling a paid API.",
      6,
      true,
    ),
    criterion(
      "sec.pii-inventory",
      "Privacy",
      "You can list every piece of personal data you hold",
      "A written inventory: what is collected, where it lives, how long it is kept, who it is shared with.",
      6,
      true,
    ),
    criterion(
      "sec.third-party-terms",
      "Privacy",
      "Model and vendor terms permit this use of customer data",
      "Checked against the actual terms for every provider that sees customer content.",
      5,
      true,
    ),
    criterion(
      "sec.dependency-audit",
      "Supply chain",
      "Dependencies have been audited recently",
      "A clean audit within the last month, with known-exploitable findings resolved.",
      4,
    ),
  ],
};

/** Answers whether a thing is worth building before anyone builds it. */
export const DISCOVERY: Rubric = {
  id: "discovery",
  name: "Discovery",
  version: 1,
  description:
    "Applied before a project gets engineering time. Cheap to score, and it kills the projects that would have cost a quarter.",
  passThreshold: 70,
  criteria: [
    criterion(
      "disc.named-buyer",
      "Demand",
      "You can name five people who would buy this",
      "Real names of real people or companies, not a market segment.",
      10,
      true,
    ),
    criterion(
      "disc.spoken-to-five",
      "Demand",
      "You have spoken to five of them",
      "Conversations, with notes, where they described the problem before you described the product.",
      10,
      true,
    ),
    criterion(
      "disc.paid-signal",
      "Demand",
      "Someone has signalled willingness to pay",
      "A deposit, a signed pilot, a design-partner agreement, or a specific stated budget. Enthusiasm is not signal.",
      8,
    ),
    criterion(
      "disc.problem-statement",
      "Problem",
      "The problem is written in the customer's words",
      "One paragraph, quoting how they say it, not how you would pitch it.",
      6,
      true,
    ),
    criterion(
      "disc.today-workaround",
      "Problem",
      "You know what they do today instead",
      "The spreadsheet, the intern, the competitor. If nothing, that is usually a sign the problem is not felt.",
      6,
    ),
    criterion(
      "disc.smallest-version",
      "Scope",
      "The smallest version that would be paid for is defined",
      "One sentence naming what is in it, and it is weeks of work rather than quarters.",
      6,
      true,
    ),
    criterion(
      "disc.kill-criteria",
      "Scope",
      "You have written down what would make you stop",
      "A specific condition and a date, agreed before the sunk cost accumulates.",
      6,
      true,
    ),
  ],
};

export const BUILT_IN_RUBRICS: readonly Rubric[] = [
  LAUNCH_READINESS,
  SECURITY_BASELINE,
  DISCOVERY,
];

export function findBuiltInRubric(id: string): Rubric | undefined {
  return BUILT_IN_RUBRICS.find((rubric) => rubric.id === id);
}
