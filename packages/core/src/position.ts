/**
 * Ordering for kanban columns and cards.
 *
 * Dragging a card must write one row, not renumber the whole column — a board
 * with 300 cards and two people dragging at once cannot afford a full rewrite
 * per move. So positions are sparse integers: new neighbours land at the
 * midpoint of the gap, and the gap only needs repairing when it closes.
 *
 * Integers rather than floats on purpose. Repeated midpoints of a float run out
 * of mantissa silently and start colliding; an integer gap runs out loudly, at
 * a point we can detect and repair.
 */

/** Spacing between freshly seeded positions. Allows 16 clean inserts anywhere. */
export const POSITION_GAP = 65_536;

/** Signals that `positionBetween` has no room and the list needs `rebalance`. */
export class PositionExhaustedError extends Error {
  // Declared and assigned rather than as constructor parameter properties:
  // Node runs this package's tests by stripping types, and that mode has no
  // way to emit the assignments a parameter property implies.
  readonly before: number;
  readonly after: number;

  constructor(before: number, after: number) {
    super(`No integer position available between ${before} and ${after}`);
    this.name = "PositionExhaustedError";
    this.before = before;
    this.after = after;
  }
}

/**
 * A position that sorts strictly between two neighbours.
 *
 * Pass `null` for `before` to insert at the head, `null` for `after` to append.
 * Throws {@link PositionExhaustedError} when the neighbours are adjacent
 * integers; the caller should `rebalance` that column and retry.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return POSITION_GAP;
  if (before === null) return (after as number) - POSITION_GAP;
  if (after === null) return before + POSITION_GAP;

  if (after <= before) {
    throw new RangeError(`Positions out of order: before=${before} after=${after}`);
  }
  if (after - before < 2) throw new PositionExhaustedError(before, after);

  // Floor of the midpoint. Guaranteed strictly between because the gap is >= 2.
  return before + Math.floor((after - before) / 2);
}

/** Evenly spaced positions for `count` items, starting at `POSITION_GAP`. */
export function seedPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_GAP);
}

/**
 * Re-space an ordered list. Returns only the items whose position changed, so
 * the caller can write the minimum number of rows.
 */
export function rebalance<T extends { id: string; position: number }>(
  items: readonly T[],
): Array<{ id: string; position: number }> {
  const ordered = [...items].sort(byPosition);
  const changed: Array<{ id: string; position: number }> = [];
  ordered.forEach((item, i) => {
    const next = (i + 1) * POSITION_GAP;
    if (item.position !== next) changed.push({ id: item.id, position: next });
  });
  return changed;
}

/**
 * Stable comparator. Ties break on `id` so two rows that somehow share a
 * position still render in the same order for every viewer.
 */
export function byPosition<T extends { id: string; position: number }>(a: T, b: T): number {
  return a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * The position a card should take when dropped at `toIndex` within `siblings`.
 *
 * `siblings` is every card already in the destination column, in any order, and
 * must NOT include the card being moved — callers filter it out first, because
 * a card that appears as its own neighbour produces a position equal to itself
 * and the drag silently does nothing.
 */
export function positionForDrop<T extends { id: string; position: number }>(
  siblings: readonly T[],
  toIndex: number,
): number {
  const ordered = [...siblings].sort(byPosition);
  const index = Math.max(0, Math.min(toIndex, ordered.length));
  const before = index === 0 ? null : (ordered[index - 1]?.position ?? null);
  const after = index >= ordered.length ? null : (ordered[index]?.position ?? null);
  return positionBetween(before, after);
}
