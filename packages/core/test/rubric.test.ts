import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BP,
  LAUNCH_READINESS,
  formatBp,
  portfolioRollup,
  scoreRubric,
  validateAssessment,
  validateRubric,
  type Assessment,
  type Rubric,
} from "../src/index.ts";

/** Four criteria, weights 10/10/5/5, one of them required. Total 30 points. */
const rubric: Rubric = {
  id: "test",
  name: "Test rubric",
  version: 1,
  description: "Fixture",
  passThreshold: 80,
  criteria: [
    {
      id: "a.required",
      section: "Alpha",
      title: "Required thing",
      guidance: "It is done.",
      weight: 10,
      required: true,
    },
    {
      id: "a.optional",
      section: "Alpha",
      title: "Optional thing",
      guidance: "It is done.",
      weight: 10,
      required: false,
    },
    {
      id: "b.one",
      section: "Beta",
      title: "Beta one",
      guidance: "It is done.",
      weight: 5,
      required: false,
    },
    {
      id: "b.two",
      section: "Beta",
      title: "Beta two",
      guidance: "It is done.",
      weight: 5,
      required: false,
      evidenceRequired: true,
    },
  ],
};

const at = (criterionId: string, status: Assessment["status"], extra: Partial<Assessment> = {}) =>
  ({ criterionId, status, ...extra }) as Assessment;

describe("scoreRubric", () => {
  it("scores an untouched project at zero and blocks it", () => {
    const score = scoreRubric(rubric, []);
    assert.equal(score.percentBp, 0);
    assert.equal(score.readiness, "blocked");
    assert.equal(score.passing, false);
    assert.deepEqual(score.unassessed.sort(), ["a.optional", "a.required", "b.one", "b.two"]);
  });

  it("treats a missing assessment as not started rather than skipping it", () => {
    // Without this rule a project reaches 100% by never being looked at.
    const partial = scoreRubric(rubric, [at("a.required", "met")]);
    assert.equal(partial.possible, 30 * BP);
    assert.equal(partial.earned, 10 * BP);
    assert.equal(partial.percentBp, 3_333);
  });

  it("gives half credit for work in progress", () => {
    const score = scoreRubric(rubric, [at("a.required", "in_progress")]);
    assert.equal(score.earned, 10 * 5_000);
    assert.equal(score.percentBp, 1_667);
  });

  it("blocks on an unmet required criterion however high the score", () => {
    const score = scoreRubric(rubric, [
      at("a.required", "in_progress"),
      at("a.optional", "met"),
      at("b.one", "met"),
      at("b.two", "met"),
    ]);
    assert.ok(score.percentBp > 8_000, "score is above the pass threshold");
    assert.equal(score.readiness, "blocked");
    assert.equal(score.passing, false);
    assert.deepEqual(
      score.blocking.map((c) => c.id),
      ["a.required"],
    );
  });

  it("removes not-applicable criteria from the denominator", () => {
    // Otherwise a rubric with an irrelevant criterion can never reach 100%.
    const score = scoreRubric(rubric, [
      at("a.required", "met"),
      at("a.optional", "met"),
      at("b.one", "not_applicable", { note: "No email in this product." }),
      at("b.two", "not_applicable", { note: "No email in this product." }),
    ]);
    assert.equal(score.possible, 20 * BP);
    assert.equal(score.percentBp, BP);
    assert.equal(score.readiness, "ready");
    assert.deepEqual(score.notApplicable.sort(), ["b.one", "b.two"]);
  });

  it("lets a waiver earn full credit and clear the block, but keeps it visible", () => {
    const score = scoreRubric(rubric, [
      at("a.required", "waived", { note: "Accepted for the pilot; revisit before GA." }),
      at("a.optional", "met"),
      at("b.one", "met"),
      at("b.two", "met"),
    ]);
    assert.equal(score.blocking.length, 0);
    assert.equal(score.percentBp, BP);
    assert.deepEqual(
      score.waived.map((c) => c.id),
      ["a.required"],
    );
  });

  it("returns 100% when every criterion is ruled out", () => {
    const score = scoreRubric(
      rubric,
      rubric.criteria.map((c) => at(c.id, "not_applicable", { note: "n/a" })),
    );
    assert.equal(score.possible, 0);
    assert.equal(score.percentBp, BP);
    assert.equal(score.readiness, "ready");
  });

  it("rolls sections up independently", () => {
    const score = scoreRubric(rubric, [at("a.required", "met"), at("a.optional", "met")]);
    const alpha = score.sections.find((s) => s.section === "Alpha");
    const beta = score.sections.find((s) => s.section === "Beta");
    assert.equal(alpha?.percentBp, BP);
    assert.equal(alpha?.metCount, 2);
    assert.equal(beta?.percentBp, 0);
    assert.equal(beta?.applicableCount, 2);
  });

  it("moves through the readiness bands as work lands", () => {
    const met = (ids: string[]) => scoreRubric(rubric, ids.map((id) => at(id, "met"))).readiness;
    assert.equal(met(["a.required"]), "at_risk"); // 33%
    assert.equal(met(["a.required", "a.optional"]), "on_track"); // 67%, pass is 80
    assert.equal(met(["a.required", "a.optional", "b.one", "b.two"]), "ready"); // 100%
  });

  it("keeps every score an integer so no rounding drifts", () => {
    const score = scoreRubric(rubric, [at("a.required", "in_progress"), at("b.one", "in_progress")]);
    for (const value of [score.earned, score.possible, score.percentBp]) {
      assert.ok(Number.isInteger(value), `${value} is an integer`);
    }
  });
});

describe("validateRubric", () => {
  it("accepts every built-in template", () => {
    // A shipped template that fails its own validator is an embarrassment.
    assert.deepEqual(validateRubric(LAUNCH_READINESS), []);
  });

  it("rejects duplicate criterion ids", () => {
    const broken: Rubric = {
      ...rubric,
      criteria: [rubric.criteria[0]!, { ...rubric.criteria[1]!, id: "a.required" }],
    };
    const issues = validateRubric(broken);
    assert.ok(issues.some((i) => i.message.includes("Duplicate")));
  });

  it("rejects a criterion with no guidance", () => {
    const broken: Rubric = {
      ...rubric,
      criteria: [{ ...rubric.criteria[0]!, guidance: "  " }],
    };
    const issues = validateRubric(broken);
    assert.ok(issues.some((i) => i.path === "criteria[0].guidance"));
  });

  it("reports every problem at once rather than the first", () => {
    const broken: Rubric = { ...rubric, name: "", passThreshold: 140, criteria: [] };
    assert.equal(validateRubric(broken).length, 3);
  });
});

describe("validateAssessment", () => {
  const evidenceCriterion = rubric.criteria[3]!;

  it("refuses met without evidence when the criterion demands it", () => {
    const issues = validateAssessment(evidenceCriterion, at("b.two", "met"));
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.path, "evidence");
  });

  it("accepts met with evidence", () => {
    const issues = validateAssessment(
      evidenceCriterion,
      at("b.two", "met", { evidence: "https://example.com/receipt" }),
    );
    assert.deepEqual(issues, []);
  });

  it("demands a reason for a waiver and for not applicable", () => {
    assert.equal(validateAssessment(rubric.criteria[0]!, at("a.required", "waived")).length, 1);
    assert.equal(
      validateAssessment(rubric.criteria[0]!, at("a.required", "not_applicable")).length,
      1,
    );
  });
});

describe("portfolioRollup", () => {
  const projects = [
    { projectId: "p1", projectName: "One", assessments: [at("a.required", "met"), at("b.one", "met")] },
    { projectId: "p2", projectName: "Two", assessments: [at("a.required", "met")] },
    {
      projectId: "p3",
      projectName: "Three",
      assessments: [at("b.one", "not_applicable", { note: "n/a" })],
    },
  ];

  it("scores every project against the one rubric", () => {
    const rollup = portfolioRollup(rubric, projects);
    assert.equal(rollup.projects.length, 3);
    assert.equal(rollup.projects[2]?.score.readiness, "blocked");
  });

  it("counts coverage per criterion, excluding projects it does not apply to", () => {
    const rollup = portfolioRollup(rubric, projects);
    const bOne = rollup.criteria.find((c) => c.criterion.id === "b.one");
    assert.equal(bOne?.met, 1);
    assert.equal(bOne?.notApplicable, 1);
    // One of the two projects it applies to has it met.
    assert.equal(bOne?.coverageBp, 5_000);
  });

  it("lists which projects a required criterion is blocking", () => {
    const rollup = portfolioRollup(rubric, projects);
    const required = rollup.criteria.find((c) => c.criterion.id === "a.required");
    assert.deepEqual(required?.blockedProjectIds, ["p3"]);
  });

  it("sorts the weakest criteria first so the work queue writes itself", () => {
    const rollup = portfolioRollup(rubric, projects);
    assert.equal(rollup.weakest[0]?.coverageBp, 0);
    assert.ok(rollup.weakest[0]!.coverageBp <= rollup.weakest.at(-1)!.coverageBp);
  });
});

describe("formatBp", () => {
  it("renders basis points as a percentage", () => {
    assert.equal(formatBp(8_750), "87.5%");
    assert.equal(formatBp(BP, 0), "100%");
  });
});
