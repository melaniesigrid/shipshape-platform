/**
 * Shipshape domain types.
 *
 * Two halves that meet in the middle:
 *
 *   Rubric  — the standard a project has to match. Reusable, versioned, and
 *             applied to many projects at once.
 *   Board   — the kanban that holds the work. Cards can point back at the
 *             criterion they exist to satisfy, which is what stops the rubric
 *             from becoming a checklist nobody updates.
 *
 * Every score in here is an integer. Weights are whole points and credit is in
 * basis points (0..10_000), so a percentage never drifts and two clients never
 * disagree about a rounding.
 */

/** Basis points: 10_000 == 100.00%. */
export type BasisPoints = number;

export const BP = 10_000 as const;

// ---------------------------------------------------------------------------
// Rubric
// ---------------------------------------------------------------------------

/**
 * How a single criterion currently stands for one project.
 *
 * `waived` and `not_applicable` look similar and are not:
 *   - `not_applicable` — the criterion does not apply here (no email, so no
 *     unsubscribe link). Removed from the denominator entirely.
 *   - `waived`         — it applies, it is not done, and someone with authority
 *     decided to ship anyway. Counts as earned so the score is honest about
 *     the decision, but stays visible in `waived` so nobody forgets.
 */
export type CriterionStatus =
  | "not_started"
  | "in_progress"
  | "met"
  | "waived"
  | "not_applicable";

export const CRITERION_STATUSES: readonly CriterionStatus[] = [
  "not_started",
  "in_progress",
  "met",
  "waived",
  "not_applicable",
] as const;

/**
 * Partial credit for work that is underway.
 *
 * Half credit is a deliberate choice: zero credit makes a long rubric feel
 * static for weeks, and full credit lets "in progress" masquerade as done.
 */
export const IN_PROGRESS_CREDIT_BP: BasisPoints = 5_000;

export interface RubricCriterion {
  /**
   * Stable key, unique within the rubric, e.g. `"billing.live-keys"`.
   * Survives rubric versioning so a project's history stays comparable.
   */
  id: string;
  /** Grouping for rollups and the UI, e.g. `"Billing"`. */
  section: string;
  title: string;
  /**
   * What "met" actually looks like. The field that stops a rubric from
   * degenerating into a row of vague adjectives — if you cannot write this,
   * the criterion is not ready to be scored.
   */
  guidance: string;
  /** Whole points. Higher means it matters more. Must be >= 1. */
  weight: number;
  /**
   * A required criterion that is not met blocks the project outright,
   * whatever the percentage says. Nine tenths of a launch is not a launch.
   */
  required: boolean;
  /** When true, moving to `met` demands a non-empty evidence string. */
  evidenceRequired?: boolean;
}

export interface Rubric {
  id: string;
  name: string;
  /** Bumped when criteria change. Old assessments stay attached to old versions. */
  version: number;
  description: string;
  /** Percent (0..100) at or above which a project passes, absent blockers. */
  passThreshold: number;
  criteria: RubricCriterion[];
}

export interface Assessment {
  criterionId: string;
  status: CriterionStatus;
  /** URL or short proof. Required to reach `met` when `evidenceRequired`. */
  evidence?: string | null;
  /** Why it was waived, why it does not apply, what is left. */
  note?: string | null;
  assessedAt?: string | null;
  assessedBy?: string | null;
}

export type Readiness = "blocked" | "at_risk" | "on_track" | "ready";

export interface SectionScore {
  section: string;
  /** Weight-basis-points earned and available, ignoring N/A criteria. */
  earned: number;
  possible: number;
  percentBp: BasisPoints;
  metCount: number;
  /** Criteria in this section that are not `not_applicable`. */
  applicableCount: number;
}

export interface RubricScore {
  rubricId: string;
  rubricVersion: number;
  earned: number;
  possible: number;
  percentBp: BasisPoints;
  readiness: Readiness;
  /** True when the score clears `passThreshold` and nothing is blocking. */
  passing: boolean;
  sections: SectionScore[];
  /** Required criteria that are neither met, waived, nor N/A. */
  blocking: RubricCriterion[];
  /** Criteria carrying a waiver — earned, but on the record. */
  waived: RubricCriterion[];
  /** Criteria with no assessment row at all. Treated as `not_started`. */
  unassessed: string[];
  /** Criteria excluded from the denominator. */
  notApplicable: string[];
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export interface BoardColumn {
  id: string;
  name: string;
  /** Ascending. See `position.ts` for how gaps are maintained. */
  position: number;
  /**
   * Cards here count as finished. Drives criterion suggestions and cycle time.
   * A board may have more than one (`Shipped`, `Won't do`).
   */
  isDone: boolean;
  /** Refuse to accept more than this many cards. `null` means no limit. */
  wipLimit: number | null;
}

export interface Card {
  id: string;
  columnId: string;
  position: number;
  title: string;
  body?: string | null;
  assigneeId?: string | null;
  labels?: string[];
  dueAt?: string | null;
  /**
   * The criterion this card exists to satisfy, if any. This is the join that
   * makes the rubric self-updating rather than a document someone forgets.
   */
  criterionId?: string | null;
  archivedAt?: string | null;
}

export interface Board {
  id: string;
  projectId: string;
  name: string;
  columns: BoardColumn[];
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export interface ProjectAssessments {
  projectId: string;
  projectName: string;
  assessments: Assessment[];
}

export interface CriterionRollup {
  criterion: RubricCriterion;
  met: number;
  inProgress: number;
  notStarted: number;
  waived: number;
  notApplicable: number;
  /** Projects where this criterion is required and unmet. The work queue. */
  blockedProjectIds: string[];
  /** Share of applicable projects that have it met, in basis points. */
  coverageBp: BasisPoints;
}

export interface PortfolioRollup {
  rubricId: string;
  rubricVersion: number;
  projects: Array<{ projectId: string; projectName: string; score: RubricScore }>;
  /** Per-criterion view across every project — the heatmap. */
  criteria: CriterionRollup[];
  /** Ascending by coverage: the criteria the portfolio is worst at. */
  weakest: CriterionRollup[];
}
