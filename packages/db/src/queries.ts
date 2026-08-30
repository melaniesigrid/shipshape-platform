/**
 * Tenant-scoped queries.
 *
 * Every exported function takes `tenantId` first. Not a convention — the only
 * thing standing between a multi-tenant product and reading someone else's
 * board is that a missing scope will not compile.
 *
 * Scoring lives in @shipshape/core, never here. This file loads rows, hands
 * them to the domain, and stores what comes back.
 */

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  DEFAULT_COLUMNS,
  generateCardsForGaps,
  moveCard,
  portfolioRollup,
  scoreRubric,
  validateAssessment,
  type Assessment,
  type Board,
  type Card,
  type CriterionStatus,
  type PortfolioRollup,
  type Rubric,
  type RubricScore,
  type ValidationIssue,
} from "@shipshape/core";

import type { Database } from "./client.ts";
import {
  activity,
  assessments,
  boardColumns,
  boards,
  cards,
  memberships,
  projectRubrics,
  projects,
  rubricCriteria,
  rubrics,
  type Project,
  type RubricCriterionRow,
  type RubricRow,
} from "./schema.ts";

// ---------------------------------------------------------------------------
// Mapping database rows onto domain objects
// ---------------------------------------------------------------------------

/**
 * The domain works in criterion *keys*; the database works in uuids. This pair
 * of maps is the only place the two meet, so the translation happens once
 * instead of leaking into every caller.
 */
export interface CriterionIndex {
  byKey: Map<string, RubricCriterionRow>;
  byId: Map<string, RubricCriterionRow>;
}

export function indexCriteria(rows: readonly RubricCriterionRow[]): CriterionIndex {
  return {
    byKey: new Map(rows.map((row) => [row.key, row])),
    byId: new Map(rows.map((row) => [row.id, row])),
  };
}

export function toDomainRubric(rubric: RubricRow, criteria: readonly RubricCriterionRow[]): Rubric {
  return {
    id: rubric.key,
    name: rubric.name,
    version: rubric.version,
    description: rubric.description,
    passThreshold: rubric.passThreshold,
    criteria: [...criteria]
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        id: row.key,
        section: row.section,
        title: row.title,
        guidance: row.guidance,
        weight: row.weight,
        required: row.required,
        evidenceRequired: row.evidenceRequired,
      })),
  };
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

/** The workspaces a user may see. Every page load starts here. */
export async function tenantsForUser(db: Database, userId: string) {
  return db
    .select({ membership: memberships, tenantId: memberships.tenantId })
    .from(memberships)
    .where(eq(memberships.userId, userId));
}

/** Whether a user holds a seat in a workspace. Called before anything else. */
export async function requireMembership(db: Database, tenantId: string, userId: string) {
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Not a member of this workspace");
  return row;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(db: Database, tenantId: string): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, tenantId), isNull(projects.archivedAt)))
    .orderBy(asc(projects.name));
}

export async function getProjectBySlug(db: Database, tenantId: string, slug: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, tenantId), eq(projects.slug, slug)))
    .limit(1);
  return row;
}

export interface ProjectCard {
  project: Project;
  /** One row per rubric applied to the project, using the cached score. */
  rubrics: Array<{
    projectRubricId: string;
    rubricKey: string;
    rubricName: string;
    percentBp: number;
    readiness: string;
    blockingCount: number;
  }>;
}

/**
 * The portfolio grid, in two queries rather than one per project.
 *
 * Reads the cached score on `project_rubrics` instead of re-evaluating every
 * rubric. The cache is written by `saveAssessment` in the same transaction as
 * the change that invalidates it, so it cannot drift behind.
 */
export async function listProjectsWithScores(
  db: Database,
  tenantId: string,
): Promise<ProjectCard[]> {
  const projectRows = await listProjects(db, tenantId);
  if (projectRows.length === 0) return [];

  const applied = await db
    .select({
      projectRubricId: projectRubrics.id,
      projectId: projectRubrics.projectId,
      rubricKey: rubrics.key,
      rubricName: rubrics.name,
      percentBp: projectRubrics.cachedPercentBp,
      readiness: projectRubrics.cachedReadiness,
      blockingCount: projectRubrics.cachedBlockingCount,
    })
    .from(projectRubrics)
    .innerJoin(rubrics, eq(rubrics.id, projectRubrics.rubricId))
    .where(
      and(
        eq(projectRubrics.tenantId, tenantId),
        inArray(
          projectRubrics.projectId,
          projectRows.map((p) => p.id),
        ),
      ),
    )
    .orderBy(asc(rubrics.name));

  return projectRows.map((project) => ({
    project,
    rubrics: applied
      .filter((row) => row.projectId === project.id)
      .map(({ projectId: _projectId, ...rest }) => rest),
  }));
}

/** Every rubric applied to one project, with its cached score. */
export async function listProjectRubrics(db: Database, tenantId: string, projectId: string) {
  return db
    .select({
      projectRubricId: projectRubrics.id,
      rubricId: rubrics.id,
      rubricKey: rubrics.key,
      rubricName: rubrics.name,
      version: rubrics.version,
      passThreshold: rubrics.passThreshold,
      percentBp: projectRubrics.cachedPercentBp,
      readiness: projectRubrics.cachedReadiness,
      blockingCount: projectRubrics.cachedBlockingCount,
    })
    .from(projectRubrics)
    .innerJoin(rubrics, eq(rubrics.id, projectRubrics.rubricId))
    .where(and(eq(projectRubrics.tenantId, tenantId), eq(projectRubrics.projectId, projectId)))
    .orderBy(asc(rubrics.name));
}

/** A project's board, if it has one. Projects get one at creation. */
export async function getBoardForProject(db: Database, tenantId: string, projectId: string) {
  const [row] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.tenantId, tenantId), eq(boards.projectId, projectId)))
    .limit(1);
  return row;
}

// ---------------------------------------------------------------------------
// Rubrics
// ---------------------------------------------------------------------------

export async function listRubrics(db: Database, tenantId: string) {
  return db
    .select()
    .from(rubrics)
    .where(and(eq(rubrics.tenantId, tenantId), isNull(rubrics.supersededBy)))
    .orderBy(asc(rubrics.name));
}

export async function loadRubric(db: Database, tenantId: string, rubricId: string) {
  const [rubric] = await db
    .select()
    .from(rubrics)
    .where(and(eq(rubrics.tenantId, tenantId), eq(rubrics.id, rubricId)))
    .limit(1);
  if (!rubric) return undefined;

  const criteria = await db
    .select()
    .from(rubricCriteria)
    .where(eq(rubricCriteria.rubricId, rubricId))
    .orderBy(asc(rubricCriteria.position));

  return { row: rubric, criteria, domain: toDomainRubric(rubric, criteria) };
}

// ---------------------------------------------------------------------------
// One project against one rubric
// ---------------------------------------------------------------------------

export interface ProjectRubricView {
  projectRubricId: string;
  project: Project;
  rubric: Rubric;
  criteria: RubricCriterionRow[];
  index: CriterionIndex;
  assessments: Assessment[];
  /** Keyed by criterion *key*, matching the domain. */
  rows: Map<string, { status: CriterionStatus; evidence: string | null; note: string | null }>;
  score: RubricScore;
}

export async function loadProjectRubric(
  db: Database,
  tenantId: string,
  projectRubricId: string,
): Promise<ProjectRubricView | undefined> {
  const [application] = await db
    .select()
    .from(projectRubrics)
    .where(and(eq(projectRubrics.tenantId, tenantId), eq(projectRubrics.id, projectRubricId)))
    .limit(1);
  if (!application) return undefined;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, tenantId), eq(projects.id, application.projectId)))
    .limit(1);
  if (!project) return undefined;

  const loaded = await loadRubric(db, tenantId, application.rubricId);
  if (!loaded) return undefined;

  const rows = await db
    .select()
    .from(assessments)
    .where(eq(assessments.projectRubricId, projectRubricId));

  const index = indexCriteria(loaded.criteria);
  const byKey = new Map<
    string,
    { status: CriterionStatus; evidence: string | null; note: string | null }
  >();
  const domainAssessments: Assessment[] = [];

  for (const row of rows) {
    const criterion = index.byId.get(row.criterionId);
    if (!criterion) continue; // Criterion removed by a rubric edit; ignore the orphan.
    byKey.set(criterion.key, {
      status: row.status,
      evidence: row.evidence,
      note: row.note,
    });
    domainAssessments.push({
      criterionId: criterion.key,
      status: row.status,
      evidence: row.evidence,
      note: row.note,
      assessedAt: row.assessedAt?.toISOString() ?? null,
      assessedBy: row.assessedById,
    });
  }

  return {
    projectRubricId,
    project,
    rubric: loaded.domain,
    criteria: loaded.criteria,
    index,
    assessments: domainAssessments,
    rows: byKey,
    score: scoreRubric(loaded.domain, domainAssessments),
  };
}

export interface SaveAssessmentInput {
  projectRubricId: string;
  /** Criterion key, e.g. `billing.live-keys`. */
  criterionKey: string;
  status: CriterionStatus;
  evidence?: string | null;
  note?: string | null;
  actorId: string;
}

export type SaveAssessmentResult =
  | { ok: true; score: RubricScore }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Record one criterion and refresh the project's cached score.
 *
 * Validation runs against the domain rules first — an evidence-required
 * criterion cannot reach `met` without evidence, and a waiver cannot be saved
 * without a reason. Rejecting here rather than in the form is what stops the
 * API from being a way around the rule.
 */
export async function saveAssessment(
  db: Database,
  tenantId: string,
  input: SaveAssessmentInput,
): Promise<SaveAssessmentResult> {
  const view = await loadProjectRubric(db, tenantId, input.projectRubricId);
  if (!view) return { ok: false, issues: [{ path: "projectRubricId", message: "Not found." }] };

  const criterion = view.rubric.criteria.find((c) => c.id === input.criterionKey);
  const row = view.index.byKey.get(input.criterionKey);
  if (!criterion || !row) {
    return { ok: false, issues: [{ path: "criterionKey", message: "Unknown criterion." }] };
  }

  const next: Assessment = {
    criterionId: input.criterionKey,
    status: input.status,
    evidence: input.evidence ?? null,
    note: input.note ?? null,
  };

  const issues = validateAssessment(criterion, next);
  if (issues.length > 0) return { ok: false, issues };

  const merged = [
    ...view.assessments.filter((a) => a.criterionId !== input.criterionKey),
    next,
  ];
  const score = scoreRubric(view.rubric, merged);
  const previous = view.rows.get(input.criterionKey)?.status ?? "not_started";

  await db.transaction(async (tx) => {
    await tx
      .insert(assessments)
      .values({
        tenantId,
        projectRubricId: input.projectRubricId,
        criterionId: row.id,
        status: input.status,
        evidence: next.evidence,
        note: next.note,
        assessedById: input.actorId,
        assessedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [assessments.projectRubricId, assessments.criterionId],
        set: {
          status: input.status,
          evidence: next.evidence,
          note: next.note,
          assessedById: input.actorId,
          assessedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    // Same transaction as the change, so the cache cannot fall behind the truth.
    await tx
      .update(projectRubrics)
      .set({
        cachedPercentBp: score.percentBp,
        cachedReadiness: score.readiness,
        cachedBlockingCount: score.blocking.length,
        scoredAt: new Date(),
      })
      .where(eq(projectRubrics.id, input.projectRubricId));

    await tx.insert(activity).values({
      tenantId,
      actorId: input.actorId,
      kind: "assessment.changed",
      projectId: view.project.id,
      subjectId: row.id,
      summary: `${criterion.title}: ${previous} → ${input.status}`,
      detail: { criterionKey: input.criterionKey, from: previous, to: input.status },
    });
  });

  return { ok: true, score };
}

// ---------------------------------------------------------------------------
// Applying a rubric to a project
// ---------------------------------------------------------------------------

export interface ApplyRubricOptions {
  /** Create a card for each unmet required criterion on the project's board. */
  generateCards?: boolean;
  /** Cover optional criteria too when generating cards. */
  includeOptional?: boolean;
  actorId: string;
}

/**
 * Apply a rubric to a project: the application row, a blank assessment per
 * criterion, and optionally the cards for the gaps.
 *
 * One transaction. A project that ends up with an application row but no
 * assessments scores as a perfect zero for reasons nobody can see, which is
 * worse than the operation having failed outright.
 */
export async function applyRubricToProject(
  db: Database,
  tenantId: string,
  projectId: string,
  rubricId: string,
  options: ApplyRubricOptions,
): Promise<{ projectRubricId: string; cardsCreated: number }> {
  const loaded = await loadRubric(db, tenantId, rubricId);
  if (!loaded) throw new Error("Rubric not found in this workspace");

  return db.transaction(async (tx) => {
    const [application] = await tx
      .insert(projectRubrics)
      .values({ tenantId, projectId, rubricId })
      .onConflictDoUpdate({
        target: [projectRubrics.projectId, projectRubrics.rubricId],
        // Re-applying is a no-op rather than an error; the button is idempotent.
        set: { tenantId },
      })
      .returning({ id: projectRubrics.id });

    const projectRubricId = application!.id;

    await tx
      .insert(assessments)
      .values(
        loaded.criteria.map((criterion) => ({
          tenantId,
          projectRubricId,
          criterionId: criterion.id,
          status: "not_started" as const,
        })),
      )
      .onConflictDoNothing({
        target: [assessments.projectRubricId, assessments.criterionId],
      });

    const score = scoreRubric(loaded.domain, []);
    await tx
      .update(projectRubrics)
      .set({
        cachedPercentBp: score.percentBp,
        cachedReadiness: score.readiness,
        cachedBlockingCount: score.blocking.length,
        scoredAt: new Date(),
      })
      .where(eq(projectRubrics.id, projectRubricId));

    let cardsCreated = 0;
    if (options.generateCards) {
      // Drizzle types a transaction handle separately from the pool handle even
      // though the query surface is identical. The cast keeps the card
      // generation inside this transaction rather than opening a second one.
      cardsCreated = await generateGapCards(tx as unknown as Database, tenantId, {
        projectId,
        rubric: loaded.domain,
        criteriaByKey: indexCriteria(loaded.criteria).byKey,
        includeOptional: options.includeOptional,
      });
    }

    await tx.insert(activity).values({
      tenantId,
      actorId: options.actorId,
      kind: "rubric.applied",
      projectId,
      subjectId: rubricId,
      summary: `Applied ${loaded.row.name} v${loaded.row.version}`,
      detail: { cardsCreated },
    });

    return { projectRubricId, cardsCreated };
  });
}

interface GenerateGapCardsInput {
  projectId: string;
  rubric: Rubric;
  criteriaByKey: Map<string, RubricCriterionRow>;
  includeOptional?: boolean;
}

/** Turn the rubric's gaps into cards in the project's first non-done column. */
async function generateGapCards(
  db: Database,
  tenantId: string,
  input: GenerateGapCardsInput,
): Promise<number> {
  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.tenantId, tenantId), eq(boards.projectId, input.projectId)))
    .limit(1);
  if (!board) return 0;

  const [backlog] = await db
    .select()
    .from(boardColumns)
    .where(and(eq(boardColumns.boardId, board.id), eq(boardColumns.isDone, false)))
    .orderBy(asc(boardColumns.position))
    .limit(1);
  if (!backlog) return 0;

  const existing = await db
    .select()
    .from(cards)
    .where(and(eq(cards.boardId, board.id), isNull(cards.archivedAt)));

  const drafts = generateCardsForGaps(input.rubric, [], {
    columnId: backlog.id,
    includeOptional: input.includeOptional,
    existingCards: existing.map((row) => ({
      id: row.id,
      columnId: row.columnId,
      position: row.position,
      title: row.title,
      criterionId: criterionKeyFor(row.criterionId, input),
      archivedAt: row.archivedAt?.toISOString() ?? null,
    })),
  });
  if (drafts.length === 0) return 0;

  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${cards.position}), 0)` })
    .from(cards)
    .where(eq(cards.columnId, backlog.id));

  await db.insert(cards).values(
    drafts.map((draft, i) => ({
      tenantId,
      boardId: board.id,
      columnId: backlog.id,
      projectId: input.projectId,
      position: Number(max) + (i + 1) * 65_536,
      title: draft.title,
      body: draft.body ?? null,
      labels: draft.labels ?? [],
      criterionId: draft.criterionId
        ? (input.criteriaByKey.get(draft.criterionId)?.id ?? null)
        : null,
    })),
  );

  return drafts.length;
}

/** Reverse the uuid on an existing card back to its criterion key. */
function criterionKeyFor(criterionId: string | null, input: GenerateGapCardsInput): string | null {
  if (!criterionId) return null;
  for (const [key, row] of input.criteriaByKey) {
    if (row.id === criterionId) return key;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export interface BoardView {
  board: Board;
  cards: Card[];
  /** Criterion key per card id, so the UI can label a card with its criterion. */
  criterionKeys: Map<string, string>;
}

export async function loadBoard(
  db: Database,
  tenantId: string,
  boardId: string,
): Promise<BoardView | undefined> {
  const [row] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.tenantId, tenantId), eq(boards.id, boardId)))
    .limit(1);
  if (!row) return undefined;

  const [columnRows, cardRows] = await Promise.all([
    db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.boardId, boardId))
      .orderBy(asc(boardColumns.position)),
    db
      .select()
      .from(cards)
      .where(and(eq(cards.boardId, boardId), isNull(cards.archivedAt)))
      .orderBy(asc(cards.position)),
  ]);

  const criterionIds = [...new Set(cardRows.map((c) => c.criterionId).filter(Boolean))] as string[];
  const criterionRows = criterionIds.length
    ? await db.select().from(rubricCriteria).where(inArray(rubricCriteria.id, criterionIds))
    : [];
  const keyById = new Map(criterionRows.map((c) => [c.id, c.key]));

  return {
    board: {
      id: row.id,
      projectId: row.projectId ?? "",
      name: row.name,
      columns: columnRows.map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position,
        isDone: c.isDone,
        wipLimit: c.wipLimit,
      })),
    },
    cards: cardRows.map((c) => ({
      id: c.id,
      columnId: c.columnId,
      position: c.position,
      title: c.title,
      body: c.body,
      assigneeId: c.assigneeId,
      labels: c.labels ?? [],
      dueAt: c.dueAt?.toISOString() ?? null,
      criterionId: c.criterionId ? (keyById.get(c.criterionId) ?? null) : null,
      archivedAt: null,
    })),
    criterionKeys: new Map(
      cardRows
        .filter((c) => c.criterionId)
        .map((c) => [c.id, keyById.get(c.criterionId!) ?? ""]),
    ),
  };
}

/**
 * Persist a drag. One row written, whatever the board's size.
 *
 * `moveCard` computes the new position; if the sparse gap has closed it throws
 * `PositionExhaustedError`, and the caller rebalances that column and retries.
 */
export async function moveCardTo(
  db: Database,
  tenantId: string,
  boardId: string,
  cardId: string,
  toColumnId: string,
  toIndex: number,
  actorId: string,
) {
  const view = await loadBoard(db, tenantId, boardId);
  if (!view) throw new Error("Board not found in this workspace");

  const { move, violation } = moveCard(view.board, view.cards, cardId, toColumnId, toIndex);

  await db
    .update(cards)
    .set({ columnId: move.columnId, position: move.position, updatedAt: new Date() })
    .where(and(eq(cards.tenantId, tenantId), eq(cards.id, cardId)));

  await db.insert(activity).values({
    tenantId,
    actorId,
    kind: "card.moved",
    subjectId: cardId,
    summary: `Moved to ${view.board.columns.find((c) => c.id === toColumnId)?.name ?? "a column"}`,
  });

  return { move, violation };
}

/** Re-space a column when `moveCardTo` reports the gap has closed. */
export async function rebalanceColumn(db: Database, tenantId: string, columnId: string) {
  const rows = await db
    .select({ id: cards.id, position: cards.position })
    .from(cards)
    .where(and(eq(cards.tenantId, tenantId), eq(cards.columnId, columnId)))
    .orderBy(asc(cards.position));

  await db.transaction(async (tx) => {
    for (const [i, row] of rows.entries()) {
      await tx
        .update(cards)
        .set({ position: (i + 1) * 65_536 })
        .where(eq(cards.id, row.id));
    }
  });
}

/** Create a board with the default columns. Called when a project is created. */
export async function createBoardForProject(
  db: Database,
  tenantId: string,
  projectId: string,
  name = "Work",
) {
  return db.transaction(async (tx) => {
    const [board] = await tx
      .insert(boards)
      .values({ tenantId, projectId, name })
      .returning({ id: boards.id });

    await tx.insert(boardColumns).values(
      DEFAULT_COLUMNS.map((column) => ({
        tenantId,
        boardId: board!.id,
        name: column.name,
        position: column.position,
        isDone: column.isDone,
        wipLimit: column.wipLimit,
      })),
    );

    return board!.id;
  });
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

/**
 * One rubric, every project it is applied to.
 *
 * The view the studio actually runs on: not "how is one project doing" but
 * "which of the eight things we own still cannot take a payment".
 */
export async function loadPortfolio(
  db: Database,
  tenantId: string,
  rubricId: string,
): Promise<PortfolioRollup | undefined> {
  const loaded = await loadRubric(db, tenantId, rubricId);
  if (!loaded) return undefined;

  const applications = await db
    .select({ id: projectRubrics.id, projectId: projectRubrics.projectId, name: projects.name })
    .from(projectRubrics)
    .innerJoin(projects, eq(projects.id, projectRubrics.projectId))
    .where(and(eq(projectRubrics.tenantId, tenantId), eq(projectRubrics.rubricId, rubricId)))
    .orderBy(asc(projects.name));

  if (applications.length === 0) {
    return portfolioRollup(loaded.domain, []);
  }

  const rows = await db
    .select()
    .from(assessments)
    .where(
      inArray(
        assessments.projectRubricId,
        applications.map((a) => a.id),
      ),
    );

  const index = indexCriteria(loaded.criteria);

  return portfolioRollup(
    loaded.domain,
    applications.map((application) => ({
      projectId: application.projectId,
      projectName: application.name,
      assessments: rows
        .filter((row) => row.projectRubricId === application.id)
        .flatMap((row) => {
          const key = index.byId.get(row.criterionId)?.key;
          return key
            ? [{ criterionId: key, status: row.status, evidence: row.evidence, note: row.note }]
            : [];
        }),
    })),
  );
}

/** Recent activity for a workspace, newest first. */
export async function recentActivity(db: Database, tenantId: string, limit = 20) {
  return db
    .select()
    .from(activity)
    .where(eq(activity.tenantId, tenantId))
    .orderBy(desc(activity.createdAt))
    .limit(limit);
}
