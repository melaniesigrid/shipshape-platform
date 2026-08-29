import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_COLUMNS,
  POSITION_GAP,
  PositionExhaustedError,
  byPosition,
  generateCardsForGaps,
  groupByColumn,
  moveCard,
  positionBetween,
  positionForDrop,
  rebalance,
  seedPositions,
  suggestAll,
  suggestCriterionStatus,
  type Assessment,
  type Board,
  type Card,
  type Rubric,
} from "../src/index.ts";

const board: Board = {
  id: "b1",
  projectId: "p1",
  name: "Board",
  columns: [
    { id: "backlog", name: "Backlog", position: 1_000, isDone: false, wipLimit: null },
    { id: "doing", name: "In progress", position: 2_000, isDone: false, wipLimit: 2 },
    { id: "done", name: "Done", position: 3_000, isDone: true, wipLimit: null },
  ],
};

const card = (id: string, columnId: string, position: number, extra: Partial<Card> = {}): Card => ({
  id,
  columnId,
  position,
  title: id,
  ...extra,
});

describe("positions", () => {
  it("seeds evenly spaced positions", () => {
    assert.deepEqual(seedPositions(3), [POSITION_GAP, POSITION_GAP * 2, POSITION_GAP * 3]);
  });

  it("inserts at the head, the tail, and the midpoint", () => {
    assert.equal(positionBetween(null, 1_000), 1_000 - POSITION_GAP);
    assert.equal(positionBetween(1_000, null), 1_000 + POSITION_GAP);
    assert.equal(positionBetween(1_000, 2_000), 1_500);
    assert.equal(positionBetween(null, null), POSITION_GAP);
  });

  it("always lands strictly between its neighbours", () => {
    // Repeated midpoints are the case that breaks naive float ordering.
    let before = 0;
    const after = 1_000_000;
    for (let i = 0; i < 15; i += 1) {
      const next = positionBetween(before, after);
      assert.ok(next > before && next < after, `${next} lies in (${before}, ${after})`);
      before = next;
    }
  });

  it("refuses to squeeze between adjacent integers instead of colliding silently", () => {
    assert.throws(() => positionBetween(10, 11), PositionExhaustedError);
  });

  it("rejects neighbours in the wrong order", () => {
    assert.throws(() => positionBetween(2_000, 1_000), RangeError);
  });

  it("rebalances only the rows that actually move", () => {
    const items = [
      { id: "a", position: POSITION_GAP },
      { id: "b", position: POSITION_GAP + 1 },
      { id: "c", position: POSITION_GAP * 3 },
    ];
    // Only b is crowded; a and c already sit on their rebalanced positions, so
    // a full renumber would have written two rows for no reason.
    const changed = rebalance(items);
    assert.deepEqual(changed, [{ id: "b", position: POSITION_GAP * 2 }]);
  });

  it("breaks position ties on id so every viewer sees the same order", () => {
    const tied = [
      { id: "b", position: 100 },
      { id: "a", position: 100 },
    ];
    assert.deepEqual([...tied].sort(byPosition).map((t) => t.id), ["a", "b"]);
  });

  it("drops at the requested index and clamps out-of-range ones", () => {
    const siblings = [card("x", "backlog", 1_000), card("y", "backlog", 2_000)];
    assert.ok(positionForDrop(siblings, 0) < 1_000);
    assert.equal(positionForDrop(siblings, 1), 1_500);
    assert.ok(positionForDrop(siblings, 99) > 2_000);
  });
});

describe("moveCard", () => {
  const cards = [
    card("c1", "backlog", 1_000),
    card("c2", "backlog", 2_000),
    card("c3", "doing", 1_000),
  ];

  it("moves a card into another column at the requested index", () => {
    const { move } = moveCard(board, cards, "c1", "doing", 1);
    assert.equal(move.columnId, "doing");
    assert.ok(move.position > 1_000);
  });

  it("reorders within a column without the card blocking its own move", () => {
    // If the moving card counts as its own neighbour the midpoint comes back
    // equal to where it already is, and the drag appears to do nothing.
    const { move } = moveCard(board, cards, "c1", "backlog", 1);
    assert.notEqual(move.position, 1_000);
    assert.ok(move.position > 2_000);
  });

  it("reports a WIP violation without refusing the move", () => {
    const full = [
      card("c3", "doing", 1_000),
      card("c4", "doing", 2_000),
      card("c1", "backlog", 1_000),
    ];
    const { move, violation } = moveCard(board, full, "c1", "doing", 2);
    assert.equal(move.columnId, "doing", "the move still resolves");
    assert.equal(violation?.limit, 2);
    assert.equal(violation?.current, 3);
  });

  it("stays quiet when the column has room or no limit", () => {
    assert.equal(moveCard(board, cards, "c1", "doing", 0).violation, null);
    assert.equal(moveCard(board, cards, "c3", "backlog", 0).violation, null);
  });

  it("rejects an unknown card or column", () => {
    assert.throws(() => moveCard(board, cards, "nope", "doing", 0), /not on this board/);
    assert.throws(() => moveCard(board, cards, "c1", "nope", 0), /not on board/);
  });
});

describe("groupByColumn", () => {
  it("orders columns and cards, and hides archived cards", () => {
    const cards = [
      card("c2", "backlog", 2_000),
      card("c1", "backlog", 1_000),
      card("old", "backlog", 500, { archivedAt: "2026-01-01T00:00:00Z" }),
    ];
    const grouped = groupByColumn(board, cards);
    assert.deepEqual(grouped.map((g) => g.column.id), ["backlog", "doing", "done"]);
    assert.deepEqual(grouped[0]?.cards.map((c) => c.id), ["c1", "c2"]);
  });
});

describe("suggestCriterionStatus", () => {
  it("says nothing when no card names the criterion", () => {
    assert.equal(suggestCriterionStatus("x", board, []), null);
  });

  it("suggests met once every linked card is done", () => {
    const cards = [
      card("c1", "done", 1_000, { criterionId: "x" }),
      card("c2", "done", 2_000, { criterionId: "x" }),
    ];
    const suggestion = suggestCriterionStatus("x", board, cards);
    assert.equal(suggestion?.suggested, "met");
    assert.deepEqual(suggestion?.cardIds, ["c1", "c2"]);
  });

  it("suggests in progress while any linked card is still open", () => {
    const cards = [
      card("c1", "done", 1_000, { criterionId: "x" }),
      card("c2", "doing", 2_000, { criterionId: "x" }),
    ];
    assert.equal(suggestCriterionStatus("x", board, cards)?.suggested, "in_progress");
  });

  it("ignores archived cards", () => {
    const cards = [card("c1", "doing", 1_000, { criterionId: "x", archivedAt: "2026-01-01" })];
    assert.equal(suggestCriterionStatus("x", board, cards), null);
  });
});

const rubric: Rubric = {
  id: "r1",
  name: "R",
  version: 1,
  description: "",
  passThreshold: 80,
  criteria: [
    { id: "one", section: "S", title: "One", guidance: "Do one.", weight: 5, required: true },
    { id: "two", section: "S", title: "Two", guidance: "Do two.", weight: 5, required: true },
    { id: "three", section: "S", title: "Three", guidance: "Do three.", weight: 5, required: false },
  ],
};

describe("suggestAll", () => {
  it("only surfaces suggestions that would change something", () => {
    const cards = [
      card("c1", "done", 1_000, { criterionId: "one" }),
      card("c2", "done", 2_000, { criterionId: "two" }),
    ];
    const assessments: Assessment[] = [{ criterionId: "one", status: "met" }];
    const suggestions = suggestAll(rubric, board, cards, assessments);
    assert.deepEqual(suggestions.map((s) => s.criterionId), ["two"]);
  });

  it("never second-guesses a waiver or a deliberate not applicable", () => {
    const cards = [card("c1", "done", 1_000, { criterionId: "one" })];
    const waived: Assessment[] = [{ criterionId: "one", status: "waived", note: "later" }];
    assert.deepEqual(suggestAll(rubric, board, cards, waived), []);
  });
});

describe("generateCardsForGaps", () => {
  it("makes a card for each unmet required criterion", () => {
    const drafts = generateCardsForGaps(rubric, [], { columnId: "backlog" });
    assert.deepEqual(drafts.map((d) => d.criterionId), ["one", "two"]);
    assert.equal(drafts[0]?.columnId, "backlog");
  });

  it("copies the guidance onto the card as acceptance criteria", () => {
    const [draft] = generateCardsForGaps(rubric, [], { columnId: "backlog" });
    assert.equal(draft?.body, "Do one.");
    assert.deepEqual(draft?.labels, ["s", "required"]);
  });

  it("skips criteria that are already met, waived, or ruled out", () => {
    const assessments: Assessment[] = [
      { criterionId: "one", status: "met" },
      { criterionId: "two", status: "not_applicable", note: "n/a" },
    ];
    assert.deepEqual(generateCardsForGaps(rubric, assessments, { columnId: "backlog" }), []);
  });

  it("does not duplicate a card that already points at the criterion", () => {
    const existing = [card("c1", "backlog", 1_000, { criterionId: "one" })];
    const drafts = generateCardsForGaps(rubric, [], { columnId: "backlog", existingCards: existing });
    assert.deepEqual(drafts.map((d) => d.criterionId), ["two"]);
  });

  it("covers optional criteria only when asked", () => {
    const drafts = generateCardsForGaps(rubric, [], {
      columnId: "backlog",
      includeOptional: true,
    });
    assert.deepEqual(drafts.map((d) => d.criterionId), ["one", "two", "three"]);
  });

  it("still generates for work already under way, since it is not finished", () => {
    const assessments: Assessment[] = [{ criterionId: "one", status: "in_progress" }];
    const drafts = generateCardsForGaps(rubric, assessments, { columnId: "backlog" });
    assert.deepEqual(drafts.map((d) => d.criterionId), ["one", "two"]);
  });
});

describe("DEFAULT_COLUMNS", () => {
  it("has exactly one done column and ascending positions", () => {
    assert.equal(DEFAULT_COLUMNS.filter((c) => c.isDone).length, 1);
    const positions = DEFAULT_COLUMNS.map((c) => c.position);
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  });
});
