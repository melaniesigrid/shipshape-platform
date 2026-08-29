/**
 * Seed the Northbound workspace.
 *
 * Not lorem ipsum. These are the studio's real projects and their real state,
 * because a demo where everything is 60% green teaches you nothing about
 * whether the product is any good. The interesting output of this seed is that
 * two projects come out blocked for reasons that are actually true today.
 *
 *   pnpm db:push && pnpm db:seed
 *
 * Idempotent: re-running updates the same rows rather than duplicating them.
 */

import { BUILT_IN_RUBRICS, DEFAULT_COLUMNS, scoreRubric, type Rubric } from "@shipshape/core";
import { eq } from "drizzle-orm";

import { createDatabase, type Database } from "./client.ts";
import {
  assessments,
  boardColumns,
  boards,
  cards,
  memberships,
  projectRubrics,
  projects,
  rubricCriteria,
  rubrics,
  users,
  tenants,
} from "./schema.ts";

type Status = "not_started" | "in_progress" | "met" | "waived" | "not_applicable";

interface SeedProject {
  slug: string;
  name: string;
  summary: string;
  status: "idea" | "building" | "live" | "paused" | "archived";
  color: string;
  productionUrl?: string;
  /** Which rubric this project is held to. */
  rubricKey: string;
  /** Criterion key to status. Anything unlisted stays `not_started`. */
  assessments: Record<string, [Status, string?]>;
}

const NORTHBOUND: SeedProject[] = [
  {
    slug: "zipquarry",
    name: "ZipQuarry",
    summary: "Finds and qualifies local prospects, then writes the first email.",
    status: "live",
    color: "#B4562A",
    productionUrl: "https://zipquarry.com",
    rubricKey: "launch-readiness",
    assessments: {
      "product.core-flow-works": ["met", "Hunt to scored prospect to draft email, run end to end."],
      "product.empty-states": ["met"],
      "product.error-states": ["in_progress"],
      "product.mobile": ["met"],
      // The reason this seed exists: a public price with no way to pay it.
      "billing.live-keys": ["not_started", "Price is public at $79. Production has no Stripe keys."],
      "billing.webhook-verified": ["in_progress"],
      "billing.entitlements": ["met", "Entitlement checks are server-side and tested."],
      "billing.cancellation": ["not_started"],
      "legal.terms-and-privacy": ["in_progress"],
      "legal.data-deletion": ["not_started"],
      "legal.claims-substantiated": ["met"],
      "email.unsubscribe": [
        "in_progress",
        "Opt-out is built and email_optouts is applied, but undeployed and there is no Resend key in production.",
      ],
      "email.sender-auth": ["in_progress"],
      "email.inbound-survives-dns": [
        "met",
        "Confirmed: nameservers stay put. Moving them to the host would kill @zipquarry.com mail, and forwarding can receive but not send.",
      ],
      "infra.env-parity": ["in_progress"],
      "infra.error-tracking": ["not_started"],
      "infra.backups": ["met", "Neon automated backups on; restore tested once."],
      "infra.deploy-is-repeatable": [
        "in_progress",
        "Deploying www needs a real cd into the directory; the --cwd flag reads the wrong config.",
      ],
      "support.contact-route": ["met"],
      "support.onboarding-doc": ["not_started"],
    },
  },
  {
    slug: "quotefront",
    name: "Quotefront",
    summary: "Photo-to-quote intake for trade businesses.",
    status: "building",
    color: "#1E5D9E",
    rubricKey: "launch-readiness",
    assessments: {
      "product.core-flow-works": ["in_progress"],
      "product.empty-states": ["in_progress"],
      "product.error-states": ["in_progress"],
      "product.mobile": ["met", "Intake is phone-first; that is where the photos are taken."],
      "billing.live-keys": ["not_started"],
      "billing.webhook-verified": ["not_started"],
      "billing.entitlements": ["not_started"],
      "billing.cancellation": ["not_started"],
      "legal.terms-and-privacy": ["not_started"],
      "legal.data-deletion": ["not_started"],
      "legal.claims-substantiated": ["in_progress"],
      "email.unsubscribe": [
        "not_applicable",
        "Transactional quote emails only. No bulk sending, so nothing to unsubscribe from.",
      ],
      "email.sender-auth": ["in_progress"],
      "email.inbound-survives-dns": ["met"],
      "infra.env-parity": ["met"],
      "infra.error-tracking": ["not_started"],
      "infra.backups": ["met"],
      "infra.deploy-is-repeatable": ["met"],
      "support.contact-route": ["not_started"],
      "support.onboarding-doc": ["not_started"],
    },
  },
  {
    slug: "reconai",
    name: "ReconAI",
    summary: "Matches invoices against purchase orders and flags the differences.",
    status: "building",
    color: "#4A4E8C",
    rubricKey: "launch-readiness",
    assessments: {
      "product.core-flow-works": ["met", "Invoice and PO reconcile end to end on the sample set."],
      "product.empty-states": ["in_progress"],
      "product.error-states": ["in_progress"],
      "product.mobile": ["not_applicable", "Desktop tool. Nobody reconciles a PO on a phone."],
      "billing.live-keys": ["not_started"],
      "billing.webhook-verified": ["not_started"],
      "billing.entitlements": ["not_started"],
      "billing.cancellation": ["not_started"],
      "legal.terms-and-privacy": ["not_started"],
      "legal.data-deletion": ["not_started"],
      "legal.claims-substantiated": ["in_progress"],
      "email.unsubscribe": ["not_applicable", "No email sending at all yet."],
      "email.sender-auth": ["not_applicable", "No email sending at all yet."],
      "email.inbound-survives-dns": ["not_applicable", "No domain of its own yet."],
      "infra.env-parity": ["in_progress"],
      "infra.error-tracking": ["not_started"],
      "infra.backups": ["not_applicable", "No database yet; state is per-session."],
      "infra.deploy-is-repeatable": ["met"],
      "support.contact-route": ["not_started"],
      "support.onboarding-doc": ["not_started"],
    },
  },
  {
    slug: "windward",
    name: "Windward",
    summary: "Portfolio grading across five pillars, Rails API plus a Python analytics engine.",
    status: "building",
    color: "#2F6F62",
    rubricKey: "security-baseline",
    assessments: {
      "sec.tenant-isolation": ["in_progress"],
      "sec.authz-server-side": ["in_progress"],
      "sec.secrets": ["met", "History scanned; nothing ever committed."],
      "sec.session-hardening": ["not_started"],
      "sec.rate-limiting": ["not_started"],
      "sec.pii-inventory": ["not_started"],
      "sec.third-party-terms": ["met"],
      "sec.dependency-audit": ["in_progress"],
    },
  },
  {
    slug: "duebook",
    name: "Duebook",
    summary: "A smaller site in the studio portfolio.",
    status: "paused",
    color: "#8A7B5C",
    rubricKey: "discovery",
    assessments: {
      "disc.named-buyer": ["in_progress"],
      "disc.spoken-to-five": ["not_started"],
      "disc.paid-signal": ["not_started"],
      "disc.problem-statement": ["in_progress"],
      "disc.today-workaround": ["not_started"],
      "disc.smallest-version": ["not_started"],
      "disc.kill-criteria": ["not_started"],
    },
  },
  {
    slug: "millwright",
    name: "Millwright",
    summary: "A smaller site in the studio portfolio.",
    status: "paused",
    color: "#6B6257",
    rubricKey: "discovery",
    assessments: {
      "disc.named-buyer": ["not_started"],
      "disc.spoken-to-five": ["not_started"],
      "disc.paid-signal": ["not_started"],
      "disc.problem-statement": ["in_progress"],
      "disc.today-workaround": ["not_started"],
      "disc.smallest-version": ["not_started"],
      "disc.kill-criteria": ["not_started"],
    },
  },
  {
    slug: "northbound-studio",
    name: "Northbound Studio",
    summary: "The studio site.",
    status: "live",
    color: "#1C1C1C",
    rubricKey: "launch-readiness",
    assessments: {
      "product.core-flow-works": ["met"],
      "product.empty-states": ["not_applicable", "Static marketing site; no accounts, no lists."],
      "product.error-states": ["not_applicable", "Static marketing site."],
      "product.mobile": ["met"],
      "billing.live-keys": ["not_applicable", "Nothing is sold here."],
      "billing.webhook-verified": ["not_applicable", "Nothing is sold here."],
      "billing.entitlements": ["not_applicable", "Nothing is sold here."],
      "billing.cancellation": ["not_applicable", "Nothing is sold here."],
      "legal.terms-and-privacy": ["in_progress"],
      "legal.data-deletion": ["not_applicable", "No personal data collected."],
      "legal.claims-substantiated": ["met"],
      "email.unsubscribe": ["not_applicable", "No mailing list."],
      "email.sender-auth": ["met"],
      "email.inbound-survives-dns": ["met"],
      "infra.env-parity": ["not_applicable", "No environment variables; it is a static build."],
      "infra.error-tracking": ["not_applicable", "Static site."],
      "infra.backups": ["not_applicable", "The repository is the backup."],
      "infra.deploy-is-repeatable": ["met"],
      "support.contact-route": ["met"],
      "support.onboarding-doc": ["not_applicable", "Static site."],
    },
  },
  {
    slug: "shipshape",
    name: "Shipshape",
    summary: "This. Kanban boards and readiness rubrics across a portfolio.",
    status: "building",
    color: "#2F6F62",
    rubricKey: "discovery",
    assessments: {
      "disc.named-buyer": ["in_progress", "Northbound is customer zero. Four more to name."],
      "disc.spoken-to-five": ["not_started"],
      "disc.paid-signal": ["not_started"],
      "disc.problem-statement": [
        "met",
        "Eight projects, no shared definition of ready, and the same launch gap found twice by accident.",
      ],
      "disc.today-workaround": ["met", "TODOS.md files that drift, and a monthly panic re-read."],
      "disc.smallest-version": ["met", "Rubrics applied across projects, with the gaps as cards."],
      "disc.kill-criteria": ["not_started"],
    },
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  const db = createDatabase(url);

  const tenantId = await upsertTenant(db, "northbound", "Northbound Studio");
  const userId = await upsertUser(db, "melaniesigridab@gmail.com", "Melanie");
  await db
    .insert(memberships)
    .values({ tenantId, userId, role: "owner" })
    .onConflictDoNothing({ target: [memberships.tenantId, memberships.userId] });

  // Rubrics first: projects reference them.
  const rubricIds = new Map<string, string>();
  for (const template of BUILT_IN_RUBRICS) {
    rubricIds.set(template.id, await upsertRubric(db, tenantId, template));
  }

  for (const seed of NORTHBOUND) {
    const projectId = await upsertProject(db, tenantId, userId, seed);
    const boardId = await upsertBoard(db, tenantId, projectId);
    const rubricId = rubricIds.get(seed.rubricKey);
    if (!rubricId) throw new Error(`Unknown rubric ${seed.rubricKey} on ${seed.slug}`);

    const template = BUILT_IN_RUBRICS.find((r) => r.id === seed.rubricKey)!;
    const { percentBp, readiness, blocking } = await applySeedRubric(
      db,
      tenantId,
      projectId,
      rubricId,
      template,
      seed,
      userId,
    );

    await seedCardsForGaps(db, tenantId, projectId, boardId, rubricId, template, seed);

    const bar = String(Math.round(percentBp / 100)).padStart(3, " ");
    const flag = blocking > 0 ? `${blocking} blocking` : "clear";
    console.log(`  ${seed.name.padEnd(20)} ${bar}%  ${readiness.padEnd(9)} ${flag}`);
  }

  console.log("\nSeeded. Sign in as melaniesigridab@gmail.com.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Upserts
// ---------------------------------------------------------------------------

async function upsertTenant(db: Database, slug: string, name: string): Promise<string> {
  const [row] = await db
    .insert(tenants)
    .values({ slug, name })
    .onConflictDoUpdate({ target: tenants.slug, set: { name, updatedAt: new Date() } })
    .returning({ id: tenants.id });
  return row!.id;
}

async function upsertUser(db: Database, email: string, name: string): Promise<string> {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db.insert(users).values({ email, name }).returning({ id: users.id });
  return row!.id;
}

async function upsertRubric(db: Database, tenantId: string, template: Rubric): Promise<string> {
  const [row] = await db
    .insert(rubrics)
    .values({
      tenantId,
      key: template.id,
      name: template.name,
      description: template.description,
      version: template.version,
      passThreshold: template.passThreshold,
      templateId: template.id,
      publishedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [rubrics.tenantId, rubrics.key, rubrics.version],
      set: { name: template.name, description: template.description, updatedAt: new Date() },
    })
    .returning({ id: rubrics.id });

  const rubricId = row!.id;

  for (const [position, criterion] of template.criteria.entries()) {
    await db
      .insert(rubricCriteria)
      .values({
        tenantId,
        rubricId,
        key: criterion.id,
        section: criterion.section,
        title: criterion.title,
        guidance: criterion.guidance,
        weight: criterion.weight,
        required: criterion.required,
        evidenceRequired: criterion.evidenceRequired ?? false,
        position,
      })
      .onConflictDoUpdate({
        target: [rubricCriteria.rubricId, rubricCriteria.key],
        set: {
          section: criterion.section,
          title: criterion.title,
          guidance: criterion.guidance,
          weight: criterion.weight,
          required: criterion.required,
          position,
        },
      });
  }

  return rubricId;
}

async function upsertProject(
  db: Database,
  tenantId: string,
  ownerId: string,
  seed: SeedProject,
): Promise<string> {
  const [row] = await db
    .insert(projects)
    .values({
      tenantId,
      slug: seed.slug,
      name: seed.name,
      summary: seed.summary,
      status: seed.status,
      color: seed.color,
      productionUrl: seed.productionUrl ?? null,
      ownerId,
    })
    .onConflictDoUpdate({
      target: [projects.tenantId, projects.slug],
      set: {
        name: seed.name,
        summary: seed.summary,
        status: seed.status,
        color: seed.color,
        updatedAt: new Date(),
      },
    })
    .returning({ id: projects.id });
  return row!.id;
}

async function upsertBoard(db: Database, tenantId: string, projectId: string): Promise<string> {
  const existing = await db.select().from(boards).where(eq(boards.projectId, projectId)).limit(1);
  if (existing[0]) return existing[0].id;

  const [row] = await db
    .insert(boards)
    .values({ tenantId, projectId, name: "Work" })
    .returning({ id: boards.id });

  await db.insert(boardColumns).values(
    DEFAULT_COLUMNS.map((column) => ({
      tenantId,
      boardId: row!.id,
      name: column.name,
      position: column.position,
      isDone: column.isDone,
      wipLimit: column.wipLimit,
    })),
  );

  return row!.id;
}

async function applySeedRubric(
  db: Database,
  tenantId: string,
  projectId: string,
  rubricId: string,
  template: Rubric,
  seed: SeedProject,
  actorId: string,
) {
  const criteriaRows = await db
    .select()
    .from(rubricCriteria)
    .where(eq(rubricCriteria.rubricId, rubricId));
  const idByKey = new Map(criteriaRows.map((row) => [row.key, row.id]));

  const domainAssessments = Object.entries(seed.assessments).map(([key, [status, note]]) => ({
    criterionId: key,
    status,
    note: note ?? null,
    // Evidence-required criteria need something in the evidence field to be
    // saved as met, and the seed should not be able to dodge its own rule.
    evidence: status === "met" ? (note ?? "Verified during seed.") : null,
  }));

  const score = scoreRubric(template, domainAssessments);

  const [application] = await db
    .insert(projectRubrics)
    .values({
      tenantId,
      projectId,
      rubricId,
      cachedPercentBp: score.percentBp,
      cachedReadiness: score.readiness,
      cachedBlockingCount: score.blocking.length,
      scoredAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [projectRubrics.projectId, projectRubrics.rubricId],
      set: {
        cachedPercentBp: score.percentBp,
        cachedReadiness: score.readiness,
        cachedBlockingCount: score.blocking.length,
        scoredAt: new Date(),
      },
    })
    .returning({ id: projectRubrics.id });

  const projectRubricId = application!.id;

  for (const criterion of template.criteria) {
    const criterionId = idByKey.get(criterion.id);
    if (!criterionId) continue;
    const entry = seed.assessments[criterion.id];
    const status = entry?.[0] ?? "not_started";
    const note = entry?.[1] ?? null;

    await db
      .insert(assessments)
      .values({
        tenantId,
        projectRubricId,
        criterionId,
        status,
        note,
        evidence: status === "met" ? (note ?? "Verified during seed.") : null,
        assessedById: actorId,
        assessedAt: status === "not_started" ? null : new Date(),
      })
      .onConflictDoUpdate({
        target: [assessments.projectRubricId, assessments.criterionId],
        set: {
          status,
          note,
          evidence: status === "met" ? (note ?? "Verified during seed.") : null,
          updatedAt: new Date(),
        },
      });
  }

  return {
    percentBp: score.percentBp,
    readiness: score.readiness,
    blocking: score.blocking.length,
  };
}

/**
 * Put the gaps on the board.
 *
 * Every unmet required criterion becomes a backlog card carrying the criterion's
 * guidance as its acceptance criteria — which is the loop the whole product is
 * built around, demonstrated on real work.
 */
async function seedCardsForGaps(
  db: Database,
  tenantId: string,
  projectId: string,
  boardId: string,
  rubricId: string,
  template: Rubric,
  seed: SeedProject,
) {
  const [backlog] = await db
    .select()
    .from(boardColumns)
    .where(eq(boardColumns.boardId, boardId))
    .orderBy(boardColumns.position)
    .limit(1);
  if (!backlog) return;

  const existing = await db.select().from(cards).where(eq(cards.boardId, boardId));
  if (existing.length > 0) return; // Already seeded; leave a real board alone.

  const criteriaRows = await db
    .select()
    .from(rubricCriteria)
    .where(eq(rubricCriteria.rubricId, rubricId));
  const idByKey = new Map(criteriaRows.map((row) => [row.key, row.id]));

  const gaps = template.criteria.filter((criterion) => {
    if (!criterion.required) return false;
    const status = seed.assessments[criterion.id]?.[0] ?? "not_started";
    return status === "not_started" || status === "in_progress";
  });

  if (gaps.length === 0) return;

  await db.insert(cards).values(
    gaps.map((criterion, i) => ({
      tenantId,
      boardId,
      columnId: backlog.id,
      projectId,
      position: (i + 1) * 65_536,
      title: criterion.title,
      body: criterion.guidance,
      labels: [criterion.section.toLowerCase(), "required"],
      criterionId: idByKey.get(criterion.id) ?? null,
    })),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
