"use client";

import { byPosition, checkWipLimit, type BoardColumn, type Card } from "@shipshape/core";
import { cn } from "@shipshape/ui";
import { useState, useTransition } from "react";

import { moveCardAction } from "../../actions";

export interface BoardClientProps {
  boardId: string;
  columns: BoardColumn[];
  cards: Card[];
  /** Criterion key per card id, so a card can show what standard it serves. */
  criterionKeys: Record<string, string>;
}

/**
 * The board.
 *
 * Drag and drop is the browser's own HTML5 API rather than a library: the whole
 * interaction is four handlers, and it adds nothing to the bundle. Its one real
 * weakness is touch, which is why every card also has keyboard-reachable move
 * buttons — those are the accessible path regardless, since a drag is not
 * something a keyboard user can perform.
 *
 * Moves apply locally first and are reconciled by the server action's
 * revalidation. A board that waits for a round trip before the card lands feels
 * broken even when it is working.
 */
export function BoardClient({ boardId, columns, cards, criterionKeys }: BoardClientProps) {
  const [items, setItems] = useState<Card[]>(cards);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ columnId: string; index: number } | null>(null);
  const [, startTransition] = useTransition();

  const ordered = [...columns].sort(byPosition);
  const inColumn = (columnId: string) => items.filter((c) => c.columnId === columnId).sort(byPosition);

  function commit(cardId: string, toColumnId: string, toIndex: number) {
    const card = items.find((c) => c.id === cardId);
    if (!card) return;

    const siblings = inColumn(toColumnId).filter((c) => c.id !== cardId);
    const before = siblings[toIndex - 1]?.position ?? null;
    const after = siblings[toIndex]?.position ?? null;
    // A local position good enough to render in the right place. The server
    // computes the authoritative one, and revalidation replaces this.
    const optimistic =
      before === null && after === null
        ? 65_536
        : before === null
          ? after! - 65_536
          : after === null
            ? before + 65_536
            : Math.floor((before + after) / 2);

    setItems((current) =>
      current.map((c) => (c.id === cardId ? { ...c, columnId: toColumnId, position: optimistic } : c)),
    );

    const formData = new FormData();
    formData.set("boardId", boardId);
    formData.set("cardId", cardId);
    formData.set("toColumnId", toColumnId);
    formData.set("toIndex", String(toIndex));
    startTransition(() => {
      void moveCardAction(formData);
    });
  }

  function move(cardId: string, direction: -1 | 1) {
    const card = items.find((c) => c.id === cardId);
    if (!card) return;
    const index = ordered.findIndex((c) => c.id === card.columnId);
    const next = ordered[index + direction];
    if (!next) return;
    commit(cardId, next.id, inColumn(next.id).length);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {ordered.map((column) => {
        const columnCards = inColumn(column.id);
        const violation = checkWipLimit(column, columnCards.length);

        return (
          <section
            key={column.id}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-card bg-sunk/60 ring-1 transition-colors",
              violation ? "ring-at-risk/50" : "ring-hair",
              dropTarget?.columnId === column.id && "bg-sea-soft",
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget({ columnId: column.id, index: columnCards.length });
            }}
            onDrop={(event) => {
              event.preventDefault();
              const cardId = event.dataTransfer.getData("text/plain") || dragging;
              const index = dropTarget?.columnId === column.id ? dropTarget.index : columnCards.length;
              if (cardId) commit(cardId, column.id, index);
              setDragging(null);
              setDropTarget(null);
            }}
          >
            <header className="flex items-baseline justify-between gap-2 border-b border-hair px-3 py-2.5">
              <h2 className="text-[13px] font-medium">{column.name}</h2>
              <span
                className={cn(
                  "font-mono text-[11px]",
                  violation ? "text-at-risk" : "text-ink-faint",
                )}
                title={
                  column.wipLimit
                    ? `${columnCards.length} of a ${column.wipLimit} card limit`
                    : undefined
                }
              >
                {columnCards.length}
                {column.wipLimit ? `/${column.wipLimit}` : ""}
              </span>
            </header>

            {violation ? (
              <p className="border-b border-hair bg-at-risk-soft px-3 py-1.5 text-[12px] text-at-risk">
                Over the {violation.limit} card limit. Finish something before starting more.
              </p>
            ) : null}

            <div className="flex min-h-24 flex-col gap-2 p-2">
              {columnCards.length === 0 ? (
                <p className="px-1 py-4 text-center text-[12px] text-ink-faint">
                  {column.isDone ? "Nothing finished yet." : "Nothing here."}
                </p>
              ) : null}

              {columnCards.map((card, index) => (
                <article
                  key={card.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", card.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDragging(card.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setDropTarget(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDropTarget({ columnId: column.id, index });
                  }}
                  className={cn(
                    "group cursor-grab rounded-card bg-card p-3 ring-1 ring-hair transition-shadow active:cursor-grabbing",
                    dragging === card.id ? "opacity-40" : "hover:shadow-lift",
                    dropTarget?.columnId === column.id &&
                      dropTarget.index === index &&
                      "ring-2 ring-sea",
                  )}
                >
                  <p className="text-[13px] leading-snug font-medium">{card.title}</p>

                  {card.body ? (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-faint">
                      {card.body}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {criterionKeys[card.id] ? (
                      <code
                        className="rounded bg-sea-soft px-1.5 py-0.5 font-mono text-[10px] text-sea"
                        title="This card exists to satisfy a rubric criterion"
                      >
                        {criterionKeys[card.id]}
                      </code>
                    ) : null}
                    {(card.labels ?? [])
                      .filter((label) => label !== "required")
                      .map((label) => (
                        <span
                          key={label}
                          className="rounded bg-sunk px-1.5 py-0.5 text-[10px] text-ink-faint"
                        >
                          {label}
                        </span>
                      ))}
                    {(card.labels ?? []).includes("required") ? (
                      <span className="rounded bg-blocked-soft px-1.5 py-0.5 text-[10px] text-blocked">
                        required
                      </span>
                    ) : null}
                  </div>

                  {/* The keyboard path. Always rendered so it is reachable by
                      tab; only visually revealed on hover or focus. */}
                  <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => move(card.id, -1)}
                      disabled={ordered[0]?.id === column.id}
                      className="rounded px-1.5 py-0.5 text-[11px] text-ink-faint hover:bg-sunk hover:text-ink disabled:opacity-30"
                      aria-label={`Move ${card.title} to the previous column`}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => move(card.id, 1)}
                      disabled={ordered.at(-1)?.id === column.id}
                      className="rounded px-1.5 py-0.5 text-[11px] text-ink-faint hover:bg-sunk hover:text-ink disabled:opacity-30"
                      aria-label={`Move ${card.title} to the next column`}
                    >
                      →
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
