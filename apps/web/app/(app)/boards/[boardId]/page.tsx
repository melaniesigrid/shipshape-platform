import { db, loadBoard } from "@shipshape/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";

import { BoardClient } from "./board-client";

interface PageProps {
  params: Promise<{ boardId: string }>;
}

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({ params }: PageProps) {
  const [{ boardId }, session] = await Promise.all([params, requireSession()]);

  const view = await loadBoard(db(), session.tenant.id, boardId);
  if (!view) notFound();

  const total = view.cards.length;
  const linked = view.cards.filter((card) => card.criterionId).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px]">{view.board.name}</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {total} {total === 1 ? "card" : "cards"}
            {linked > 0 ? `, ${linked} tied to a rubric criterion` : ""}.
          </p>
        </div>
        {view.board.projectId ? (
          <Link
            href={`/projects`}
            className="text-[13px] text-sea hover:underline"
          >
            Back to projects
          </Link>
        ) : null}
      </header>

      <BoardClient
        boardId={boardId}
        columns={view.board.columns}
        cards={view.cards}
        criterionKeys={Object.fromEntries(view.criterionKeys)}
      />

      <p className="text-[12px] leading-relaxed text-ink-faint">
        Drag a card, or use the arrows on it to move between columns. Moving every card that names
        a criterion into a done column makes Shipshape suggest that criterion as met — it never
        marks it for you.
      </p>
    </div>
  );
}
