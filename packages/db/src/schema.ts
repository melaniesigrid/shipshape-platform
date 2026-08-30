/**
 * Shipshape schema.
 *
 * Multi-tenant by row. Every workspace is a `tenant`, and every tenant-owned
 * table carries `tenant_id` with a cascading foreign key. There is no ambient
 * tenant anywhere in this codebase — queries take a `tenantId` argument, which
 * turns a forgotten scope into a type error instead of a data leak.
 *
 * Two id systems live side by side on rubrics, on purpose:
 *   - `id`  — a uuid, for referential integrity.
 *   - `key` — a stable human string like `billing.live-keys`, which survives a
 *     rubric version bump. Comparing a project's history across versions, or
 *     one project against another, joins on `key`, not on the uuid.
 */

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CriterionStatus, Readiness } from "@shipshape/core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const criterionStatusEnum = pgEnum("criterion_status", [
  "not_started",
  "in_progress",
  "met",
  "waived",
  "not_applicable",
]);

export const readinessEnum = pgEnum("readiness", ["blocked", "at_risk", "on_track", "ready"]);

export const projectStatusEnum = pgEnum("project_status", [
  "idea",
  "building",
  "live",
  "paused",
  "archived",
]);

export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member", "viewer"]);

// A compile-time guarantee that the enum and the domain union stay in step. If
// someone adds a status to @shipshape/core and forgets the migration, this
// stops being assignable and the build fails here rather than in production.
const _statusParity: readonly CriterionStatus[] = criterionStatusEnum.enumValues;
const _readinessParity: readonly Readiness[] = readinessEnum.enumValues;
void _statusParity;
void _readinessParity;

// ---------------------------------------------------------------------------
// Tenancy and identity
// ---------------------------------------------------------------------------

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Public URL segment: /w/northbound */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tenants_slug_idx").on(table.slug)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(sql`lower(${table.email})`)],
);

/** A user's seat in a workspace. A user may hold seats in several. */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("memberships_tenant_user_idx").on(table.tenantId, table.userId),
    index("memberships_user_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Which workspace this session is currently looking at. */
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    /** Sessions are revocable server-side; deleting the row signs the user out. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

/**
 * Single-use magic-link tokens.
 *
 * Only the SHA-256 hash is stored. A leaked database backup then yields no
 * usable login link, which is the entire reason not to store the token itself.
 */
export const loginTokens = pgTable(
  "login_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set on first use. A second attempt with the same link is rejected. */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("login_tokens_hash_idx").on(table.tokenHash),
    index("login_tokens_email_idx").on(table.email),
  ],
);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    summary: text("summary"),
    status: projectStatusEnum("status").notNull().default("building"),
    /** Hex, for the project's dot and board accent. */
    color: text("color").notNull().default("#2F6F62"),
    repoUrl: text("repo_url"),
    productionUrl: text("production_url"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("projects_tenant_slug_idx").on(table.tenantId, table.slug),
    index("projects_tenant_idx").on(table.tenantId),
  ],
);

// ---------------------------------------------------------------------------
// Rubrics
// ---------------------------------------------------------------------------

export const rubrics = pgTable(
  "rubrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Stable across versions: `launch-readiness`. */
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    version: integer("version").notNull().default(1),
    /** Percent 0..100 a project must reach, absent blockers. */
    passThreshold: integer("pass_threshold").notNull().default(85),
    /**
     * Versions are new rows, not edits. A published rubric is immutable so a
     * score recorded in March still means what it meant in March.
     */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    supersededBy: uuid("superseded_by"),
    /** Where this came from, when cloned from a built-in template. */
    templateId: text("template_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rubrics_tenant_key_version_idx").on(table.tenantId, table.key, table.version),
    index("rubrics_tenant_idx").on(table.tenantId),
  ],
);

export const rubricCriteria = pgTable(
  "rubric_criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    rubricId: uuid("rubric_id")
      .notNull()
      .references(() => rubrics.id, { onDelete: "cascade" }),
    /** Stable across versions: `billing.live-keys`. */
    key: text("key").notNull(),
    section: text("section").notNull(),
    title: text("title").notNull(),
    /** What "met" looks like. Not nullable — an unscorable criterion is noise. */
    guidance: text("guidance").notNull(),
    weight: integer("weight").notNull().default(5),
    required: boolean("required").notNull().default(false),
    evidenceRequired: boolean("evidence_required").notNull().default(false),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rubric_criteria_rubric_key_idx").on(table.rubricId, table.key),
    index("rubric_criteria_rubric_idx").on(table.rubricId),
    // Answers "which projects fail billing.live-keys" across the portfolio.
    index("rubric_criteria_tenant_key_idx").on(table.tenantId, table.key),
  ],
);

/** One rubric version applied to one project. The heart of "make it for every project". */
export const projectRubrics = pgTable(
  "project_rubrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    rubricId: uuid("rubric_id")
      .notNull()
      .references(() => rubrics.id, { onDelete: "cascade" }),
    /** Optional: the date this project is expected to clear the rubric. */
    targetDate: timestamp("target_date", { withTimezone: true }),
    /**
     * Denormalised score, refreshed on every assessment write. Present so the
     * portfolio grid is one query rather than N rubric evaluations; always
     * recomputed from @shipshape/core, never hand-edited.
     */
    cachedPercentBp: integer("cached_percent_bp").notNull().default(0),
    cachedReadiness: readinessEnum("cached_readiness").notNull().default("blocked"),
    cachedBlockingCount: integer("cached_blocking_count").notNull().default(0),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_rubrics_project_rubric_idx").on(table.projectId, table.rubricId),
    index("project_rubrics_tenant_idx").on(table.tenantId),
  ],
);

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectRubricId: uuid("project_rubric_id")
      .notNull()
      .references(() => projectRubrics.id, { onDelete: "cascade" }),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => rubricCriteria.id, { onDelete: "cascade" }),
    status: criterionStatusEnum("status").notNull().default("not_started"),
    /** URL or short proof. Required to reach `met` when the criterion demands it. */
    evidence: text("evidence"),
    /** Why waived, why not applicable, what is left. */
    note: text("note"),
    assessedById: uuid("assessed_by_id").references(() => users.id, { onDelete: "set null" }),
    assessedAt: timestamp("assessed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("assessments_project_rubric_criterion_idx").on(
      table.projectRubricId,
      table.criterionId,
    ),
    index("assessments_criterion_idx").on(table.criterionId),
  ],
);

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export const boards = pgTable(
  "boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /**
     * Null for a cross-project board — the portfolio view where one column
     * holds work from several projects at once.
     */
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("boards_tenant_idx").on(table.tenantId), index("boards_project_idx").on(table.projectId)],
);

export const boardColumns = pgTable(
  "board_columns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Sparse integer ordering; see position.ts in @shipshape/core. */
    position: integer("position").notNull(),
    /** Cards here count as finished. A board may have more than one. */
    isDone: boolean("is_done").notNull().default(false),
    /** Advisory, not enforced at the database. Null means no limit. */
    wipLimit: integer("wip_limit"),
  },
  (table) => [index("board_columns_board_idx").on(table.boardId, table.position)],
);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    columnId: uuid("column_id")
      .notNull()
      .references(() => boardColumns.id, { onDelete: "cascade" }),
    /**
     * Denormalised from the board for cross-project boards, where a card's
     * project is not implied by the board it sits on.
     */
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    labels: jsonb("labels").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    dueAt: timestamp("due_at", { withTimezone: true }),
    /**
     * The criterion this card exists to satisfy. The join that keeps the rubric
     * current instead of turning it into a document nobody updates.
     */
    criterionId: uuid("criterion_id").references(() => rubricCriteria.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("cards_column_idx").on(table.columnId, table.position),
    index("cards_board_idx").on(table.boardId),
    index("cards_criterion_idx").on(table.criterionId),
    index("cards_tenant_idx").on(table.tenantId),
  ],
);

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

/**
 * Append-only. Answers "who marked this met, and when" — the question every
 * rubric eventually gets asked, usually after something has gone wrong.
 */
export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    /** `assessment.changed`, `card.moved`, `rubric.published`. */
    kind: text("kind").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id"),
    summary: text("summary").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("activity_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("activity_project_idx").on(table.projectId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const tenantRelations = relations(tenants, ({ many }) => ({
  projects: many(projects),
  rubrics: many(rubrics),
  memberships: many(memberships),
}));

export const projectRelations = relations(projects, ({ one, many }) => ({
  tenant: one(tenants, { fields: [projects.tenantId], references: [tenants.id] }),
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  rubrics: many(projectRubrics),
  boards: many(boards),
}));

export const rubricRelations = relations(rubrics, ({ one, many }) => ({
  tenant: one(tenants, { fields: [rubrics.tenantId], references: [tenants.id] }),
  criteria: many(rubricCriteria),
  applications: many(projectRubrics),
}));

export const rubricCriterionRelations = relations(rubricCriteria, ({ one, many }) => ({
  rubric: one(rubrics, { fields: [rubricCriteria.rubricId], references: [rubrics.id] }),
  assessments: many(assessments),
  cards: many(cards),
}));

export const projectRubricRelations = relations(projectRubrics, ({ one, many }) => ({
  project: one(projects, { fields: [projectRubrics.projectId], references: [projects.id] }),
  rubric: one(rubrics, { fields: [projectRubrics.rubricId], references: [rubrics.id] }),
  assessments: many(assessments),
}));

export const assessmentRelations = relations(assessments, ({ one }) => ({
  projectRubric: one(projectRubrics, {
    fields: [assessments.projectRubricId],
    references: [projectRubrics.id],
  }),
  criterion: one(rubricCriteria, {
    fields: [assessments.criterionId],
    references: [rubricCriteria.id],
  }),
  assessedBy: one(users, { fields: [assessments.assessedById], references: [users.id] }),
}));

export const boardRelations = relations(boards, ({ one, many }) => ({
  project: one(projects, { fields: [boards.projectId], references: [projects.id] }),
  columns: many(boardColumns),
  cards: many(cards),
}));

export const boardColumnRelations = relations(boardColumns, ({ one, many }) => ({
  board: one(boards, { fields: [boardColumns.boardId], references: [boards.id] }),
  cards: many(cards),
}));

export const cardRelations = relations(cards, ({ one }) => ({
  board: one(boards, { fields: [cards.boardId], references: [boards.id] }),
  column: one(boardColumns, { fields: [cards.columnId], references: [boardColumns.id] }),
  criterion: one(rubricCriteria, { fields: [cards.criterionId], references: [rubricCriteria.id] }),
  assignee: one(users, { fields: [cards.assigneeId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type LoginToken = typeof loginTokens.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type RubricRow = typeof rubrics.$inferSelect;
export type RubricCriterionRow = typeof rubricCriteria.$inferSelect;
export type ProjectRubric = typeof projectRubrics.$inferSelect;
export type AssessmentRow = typeof assessments.$inferSelect;
export type BoardRow = typeof boards.$inferSelect;
export type BoardColumnRow = typeof boardColumns.$inferSelect;
export type CardRow = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type ActivityRow = typeof activity.$inferSelect;
