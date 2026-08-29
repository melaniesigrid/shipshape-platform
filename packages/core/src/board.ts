/**
 * Board rules, and the join between the board and the rubric.
 *
 * The reason this product is not two features bolted together: a card can name
 * the criterion it exists to satisfy. Move the last card for a criterion into a
 * done column and the rubric already knows. Apply a rubric to a project with
 * gaps and the board already has the work on it.
 */

import { byPosition, positionForDrop } from "./position.ts";
import type {
  Assessment,
  Board,
  BoardColumn,
  Card,
  CriterionStatus,
  Rubric,
  RubricCriterion,
} from "./types.ts";

/** A card, minus the fields only the database can supply. */
export type CardDraft = Omit<Card, "id" | "position"> & { position?: number };

export interface ColumnWithCards {
  column: BoardColumn;
  cards: Card[];
}

/** Live cards for each column, both lists in position order. Archived cards drop out. */
export function groupByColumn(board: Board, cards: readonly Card[]): ColumnWithCards[] {
  const live = cards.filter((card) => !card.archivedAt);
  return [...board.columns].sort(byPosition).map((column) => ({
    column,
    cards: live.filter((card) => card.columnId === column.id).sort(byPosition),
  }));
}

// ---------------------------------------------------------------------------
// Moving cards
// ---------------------------------------------------------------------------

export interface CardMove {
  cardId: string;
  columnId: string;
  position: number;
}

export interface WipViolation {
  columnId: string;
  columnName: string;
  limit: number;
  current: number;
}

export interface MoveResult {
  move: CardMove;
  /**
   * Set when the destination is already at its WIP limit. Advisory rather than
   * fatal: a limit that hard-blocks a drag gets deleted within the week, but one
   * that turns the column red gets respected. The caller decides.
   */
  violation: WipViolation | null;
}

/**
 * Where a card lands when dropped at `toIndex` of `toColumnId`.
 *
 * Pure: returns the single row to write rather than mutating anything. Throws
 * `PositionExhaustedError` when the gap has closed, which the caller answers by
 * rebalancing that column and calling again.
 */
export function moveCard(
  board: Board,
  cards: readonly Card[],
  cardId: string,
  toColumnId: string,
  toIndex: number,
): MoveResult {
  const card = cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`Card ${cardId} is not on this board`);

  const column = board.columns.find((c) => c.id === toColumnId);
  if (!column) throw new Error(`Column ${toColumnId} is not on board ${board.id}`);

  // The moving card must not be its own neighbour, or the midpoint comes back
  // equal to its current position and the drag appears to do nothing.
  const siblings = cards.filter(
    (c) => c.columnId === toColumnId && c.id !== cardId && !c.archivedAt,
  );

  const position = positionForDrop(siblings, toIndex);
  const violation = checkWipLimit(column, siblings.length + 1);

  return { move: { cardId, columnId: toColumnId, position }, violation };
}

/** Whether `count` cards would exceed the column's WIP limit. */
export function checkWipLimit(column: BoardColumn, count: number): WipViolation | null {
  if (column.wipLimit === null || count <= column.wipLimit) return null;
  return {
    columnId: column.id,
    columnName: column.name,
    limit: column.wipLimit,
    current: count,
  };
}

// ---------------------------------------------------------------------------
// Board to rubric
// ---------------------------------------------------------------------------

export interface CriterionSuggestion {
  criterionId: string;
  suggested: CriterionStatus;
  reason: string;
  cardIds: string[];
}

/**
 * What the board implies about a criterion, from the cards that name it.
 *
 * A suggestion, never an automatic write. "The work is done" and "the standard
 * is met" are different claims, and only a person gets to make the second one —
 * so this surfaces a prompt and a human confirms it.
 *
 * Returns `null` when no live card names the criterion, since silence from the
 * board is not evidence of anything.
 */
export function suggestCriterionStatus(
  criterionId: string,
  board: Board,
  cards: readonly Card[],
): CriterionSuggestion | null {
  const doneColumnIds = new Set(board.columns.filter((c) => c.isDone).map((c) => c.id));
  const linked = cards.filter((c) => c.criterionId === criterionId && !c.archivedAt);
  if (linked.length === 0) return null;

  const done = linked.filter((c) => doneColumnIds.has(c.columnId));
  const cardIds = linked.map((c) => c.id);

  if (done.length === linked.length) {
    return {
      criterionId,
      suggested: "met",
      reason:
        linked.length === 1
          ? "Its card reached a done column."
          : `All ${linked.length} of its cards reached a done column.`,
      cardIds,
    };
  }

  if (done.length > 0) {
    return {
      criterionId,
      suggested: "in_progress",
      reason: `${done.length} of ${linked.length} cards are done.`,
      cardIds,
    };
  }

  return {
    criterionId,
    suggested: "in_progress",
    reason: `${linked.length} card${linked.length === 1 ? " is" : "s are"} open against it.`,
    cardIds,
  };
}

/** Every suggestion the board can make, in rubric order. */
export function suggestAll(
  rubric: Rubric,
  board: Board,
  cards: readonly Card[],
  assessments: readonly Assessment[],
): CriterionSuggestion[] {
  const current = new Map(assessments.map((a) => [a.criterionId, a.status]));
  const suggestions: CriterionSuggestion[] = [];

  for (const criterion of rubric.criteria) {
    const suggestion = suggestCriterionStatus(criterion.id, board, cards);
    // Only surface a suggestion that would actually change something, and never
    // second-guess a deliberate waiver or a considered "does not apply".
    if (!suggestion) continue;
    const status = current.get(criterion.id) ?? "not_started";
    if (status === suggestion.suggested) continue;
    if (status === "waived" || status === "not_applicable") continue;
    suggestions.push(suggestion);
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Rubric to board
// ---------------------------------------------------------------------------

export interface GenerateCardsOptions {
  /** Column the generated cards land in. Usually the backlog. */
  columnId: string;
  /** Skip criteria that already have a live card pointing at them. */
  existingCards?: readonly Card[];
  /** Cover optional criteria too. Off by default: required gaps come first. */
  includeOptional?: boolean;
}

/**
 * Turn the gaps in a rubric into cards.
 *
 * This is the loop the product exists for. You define the standard once, apply
 * it to eight projects, and each one gets a board holding exactly the work that
 * standard implies, instead of a document somebody re-reads in a panic later.
 */
export function generateCardsForGaps(
  rubric: Rubric,
  assessments: readonly Assessment[],
  options: GenerateCardsOptions,
): CardDraft[] {
  const status = new Map(assessments.map((a) => [a.criterionId, a.status]));
  const covered = new Set(
    (options.existingCards ?? [])
      .filter((c) => !c.archivedAt && c.criterionId)
      .map((c) => c.criterionId as string),
  );

  return rubric.criteria
    .filter((criterion) => {
      if (covered.has(criterion.id)) return false;
      if (!criterion.required && !options.includeOptional) return false;
      const current = status.get(criterion.id) ?? "not_started";
      return current === "not_started" || current === "in_progress";
    })
    .map((criterion) => toCardDraft(criterion, options.columnId));
}

function toCardDraft(criterion: RubricCriterion, columnId: string): CardDraft {
  return {
    columnId,
    title: criterion.title,
    // The guidance is the acceptance criteria. Copying it onto the card means
    // whoever picks the work up knows what done looks like without a round trip.
    body: criterion.guidance,
    criterionId: criterion.id,
    labels: [criterion.section.toLowerCase(), criterion.required ? "required" : "optional"],
  };
}

// ---------------------------------------------------------------------------
// Default board shape
// ---------------------------------------------------------------------------

/**
 * The columns a new project board starts with. Deliberately short: a five-column
 * board on day one is a board nobody keeps current.
 */
export const DEFAULT_COLUMNS: ReadonlyArray<Omit<BoardColumn, "id">> = [
  { name: "Backlog", position: 65_536, isDone: false, wipLimit: null },
  { name: "In progress", position: 131_072, isDone: false, wipLimit: 3 },
  { name: "Blocked", position: 196_608, isDone: false, wipLimit: null },
  { name: "Done", position: 262_144, isDone: true, wipLimit: null },
];
