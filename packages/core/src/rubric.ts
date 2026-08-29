/**
 * Rubric scoring.
 *
 * Pure functions over plain data. Nothing here touches a database, a clock, or
 * an environment variable, which is what lets the same code score a project in
 * a server action, in a nightly digest, and in a unit test.
 */

import {
  BP,
  IN_PROGRESS_CREDIT_BP,
  type Assessment,
  type BasisPoints,
  type CriterionRollup,
  type CriterionStatus,
  type PortfolioRollup,
  type ProjectAssessments,
  type Readiness,
  type Rubric,
  type RubricCriterion,
  type RubricScore,
  type SectionScore,
} from "./types.ts";

/** Fraction of a criterion's weight earned at each status, in basis points. */
export function creditBp(status: CriterionStatus): BasisPoints {
  switch (status) {
    case "met":
    case "waived":
      return BP;
    case "in_progress":
      return IN_PROGRESS_CREDIT_BP;
    case "not_started":
      return 0;
    case "not_applicable":
      return 0; // Excluded from the denominator too; see `scoreRubric`.
  }
}

/** A criterion counts toward the score unless it has been ruled out. */
function isApplicable(status: CriterionStatus): boolean {
  return status !== "not_applicable";
}

/** Met, waived, or ruled out — i.e. nothing further is owed on it. */
function isSettled(status: CriterionStatus): boolean {
  return status === "met" || status === "waived" || status === "not_applicable";
}

function percent(earned: number, possible: number): BasisPoints {
  // Every criterion ruled out. Nothing is owed, so nothing is outstanding.
  if (possible <= 0) return BP;
  return Math.round((earned * BP) / possible);
}

/**
 * Score one project against one rubric.
 *
 * Criteria with no assessment are treated as `not_started` rather than skipped:
 * an unanswered question is not a passed one, and the alternative lets a
 * project reach 100% by never being looked at.
 */
export function scoreRubric(rubric: Rubric, assessments: readonly Assessment[]): RubricScore {
  const byId = new Map(assessments.map((a) => [a.criterionId, a]));

  const sections = new Map<string, SectionScore>();
  const blocking: RubricCriterion[] = [];
  const waived: RubricCriterion[] = [];
  const unassessed: string[] = [];
  const notApplicable: string[] = [];

  let earned = 0;
  let possible = 0;

  for (const criterion of rubric.criteria) {
    const assessment = byId.get(criterion.id);
    if (!assessment) unassessed.push(criterion.id);
    const status: CriterionStatus = assessment?.status ?? "not_started";

    const section = sections.get(criterion.section) ?? {
      section: criterion.section,
      earned: 0,
      possible: 0,
      percentBp: 0,
      metCount: 0,
      applicableCount: 0,
    };

    if (isApplicable(status)) {
      const criterionEarned = criterion.weight * creditBp(status);
      const criterionPossible = criterion.weight * BP;

      earned += criterionEarned;
      possible += criterionPossible;
      section.earned += criterionEarned;
      section.possible += criterionPossible;
      section.applicableCount += 1;
      if (status === "met") section.metCount += 1;
    } else {
      notApplicable.push(criterion.id);
    }

    if (status === "waived") waived.push(criterion);
    if (criterion.required && !isSettled(status)) blocking.push(criterion);

    sections.set(criterion.section, section);
  }

  for (const section of sections.values()) {
    section.percentBp = percent(section.earned, section.possible);
  }

  const percentBp = percent(earned, possible);
  const readiness = deriveReadiness(percentBp, blocking.length, rubric.passThreshold);

  return {
    rubricId: rubric.id,
    rubricVersion: rubric.version,
    earned,
    possible,
    percentBp,
    readiness,
    passing: readiness === "ready",
    // Insertion order, so sections render in the order the rubric declares them.
    sections: [...sections.values()],
    blocking,
    waived,
    unassessed,
    notApplicable,
  };
}

/**
 * Percentage alone never clears a project. One unmet required criterion is a
 * blocker at 99%, because shipping without a privacy policy is not a rounding
 * error.
 */
export function deriveReadiness(
  percentBp: BasisPoints,
  blockingCount: number,
  passThreshold: number,
): Readiness {
  if (blockingCount > 0) return "blocked";
  const passBp = Math.round(passThreshold * 100);
  if (percentBp >= passBp) return "ready";
  if (percentBp >= Math.round(passBp * 0.7)) return "on_track";
  return "at_risk";
}

/** Convenience for display. `8750` becomes `"87.5%"`. */
export function formatBp(bp: BasisPoints, decimals = 1): string {
  return `${(bp / 100).toFixed(decimals)}%`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Structural checks a rubric must pass before it can be saved. Returns every
 * problem at once rather than throwing on the first, so an editor can show a
 * whole form's worth of errors in one pass.
 */
export function validateRubric(rubric: Rubric): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!rubric.name.trim()) issues.push({ path: "name", message: "Name is required." });
  if (!Number.isInteger(rubric.version) || rubric.version < 1) {
    issues.push({ path: "version", message: "Version must be a whole number of at least 1." });
  }
  if (rubric.passThreshold < 0 || rubric.passThreshold > 100) {
    issues.push({ path: "passThreshold", message: "Pass threshold must be between 0 and 100." });
  }
  if (rubric.criteria.length === 0) {
    issues.push({ path: "criteria", message: "A rubric needs at least one criterion." });
  }

  const seen = new Set<string>();
  rubric.criteria.forEach((criterion, i) => {
    const at = `criteria[${i}]`;
    if (!criterion.id.trim()) {
      issues.push({ path: `${at}.id`, message: "Criterion id is required." });
    } else if (seen.has(criterion.id)) {
      issues.push({ path: `${at}.id`, message: `Duplicate criterion id "${criterion.id}".` });
    }
    seen.add(criterion.id);

    if (!criterion.title.trim()) issues.push({ path: `${at}.title`, message: "Title is required." });
    if (!criterion.section.trim()) {
      issues.push({ path: `${at}.section`, message: "Section is required." });
    }
    if (!criterion.guidance.trim()) {
      issues.push({
        path: `${at}.guidance`,
        message:
          "Guidance is required. Write what a met criterion looks like, or it cannot be scored honestly.",
      });
    }
    if (!Number.isInteger(criterion.weight) || criterion.weight < 1) {
      issues.push({ path: `${at}.weight`, message: "Weight must be a whole number of at least 1." });
    }
  });

  return issues;
}

/**
 * Whether a single assessment may be saved against its criterion. Enforces the
 * evidence rule, which is the only thing standing between a rubric and a wall
 * of unearned green.
 */
export function validateAssessment(
  criterion: RubricCriterion,
  assessment: Assessment,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (assessment.criterionId !== criterion.id) {
    issues.push({ path: "criterionId", message: "Assessment does not belong to this criterion." });
  }
  if (criterion.evidenceRequired && assessment.status === "met" && !assessment.evidence?.trim()) {
    issues.push({
      path: "evidence",
      message: `"${criterion.title}" needs evidence before it can be marked met.`,
    });
  }
  if (assessment.status === "waived" && !assessment.note?.trim()) {
    issues.push({ path: "note", message: "A waiver has to say why. Write the reason." });
  }
  if (assessment.status === "not_applicable" && !assessment.note?.trim()) {
    issues.push({ path: "note", message: "Say why this does not apply, so the next reader knows." });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

/**
 * Score one rubric across every project it is applied to.
 *
 * This is the view a studio actually runs on. Not "how is ZipQuarry doing" but
 * "which of the eight things we own still have no way to unsubscribe".
 */
export function portfolioRollup(
  rubric: Rubric,
  projects: readonly ProjectAssessments[],
): PortfolioRollup {
  const scored = projects.map((project) => ({
    projectId: project.projectId,
    projectName: project.projectName,
    score: scoreRubric(rubric, project.assessments),
  }));

  const criteria: CriterionRollup[] = rubric.criteria.map((criterion) => {
    const rollup: CriterionRollup = {
      criterion,
      met: 0,
      inProgress: 0,
      notStarted: 0,
      waived: 0,
      notApplicable: 0,
      blockedProjectIds: [],
      coverageBp: 0,
    };

    for (const project of projects) {
      const status =
        project.assessments.find((a) => a.criterionId === criterion.id)?.status ?? "not_started";

      switch (status) {
        case "met":
          rollup.met += 1;
          break;
        case "in_progress":
          rollup.inProgress += 1;
          break;
        case "waived":
          rollup.waived += 1;
          break;
        case "not_applicable":
          rollup.notApplicable += 1;
          break;
        case "not_started":
          rollup.notStarted += 1;
          break;
      }

      if (criterion.required && !isSettled(status)) {
        rollup.blockedProjectIds.push(project.projectId);
      }
    }

    const applicable = projects.length - rollup.notApplicable;
    rollup.coverageBp = applicable <= 0 ? BP : Math.round((rollup.met * BP) / applicable);
    return rollup;
  });

  // Worst coverage first. Required criteria break ties, because a required gap
  // costs more than an optional one at the same coverage.
  const weakest = [...criteria].sort(
    (a, b) =>
      a.coverageBp - b.coverageBp ||
      Number(b.criterion.required) - Number(a.criterion.required) ||
      b.criterion.weight - a.criterion.weight,
  );

  return { rubricId: rubric.id, rubricVersion: rubric.version, projects: scored, criteria, weakest };
}
