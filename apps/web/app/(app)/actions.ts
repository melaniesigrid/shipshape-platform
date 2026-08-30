"use server";

import { PositionExhaustedError, type CriterionStatus } from "@shipshape/core";
import {
  applyRubricToProject,
  db,
  moveCardTo,
  rebalanceColumn,
  saveAssessment,
} from "@shipshape/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSession, signOut } from "@/lib/auth";

/**
 * Every action starts with `requireSession` and passes the tenant it returns
 * explicitly. Actions are public HTTP endpoints with a friendlier name, so the
 * ids in the form body are treated as untrusted input and re-scoped here —
 * never as proof the caller may touch that row.
 */

const assessmentSchema = z.object({
  projectRubricId: z.string().uuid(),
  criterionKey: z.string().min(1),
  status: z.enum(["not_started", "in_progress", "met", "waived", "not_applicable"]),
  evidence: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(2000).optional(),
  projectSlug: z.string().min(1),
});

export interface AssessmentResult {
  ok: boolean;
  /** Field-level messages from the domain validator, keyed by field. */
  errors?: Record<string, string>;
}

export async function setAssessment(
  _prev: AssessmentResult,
  formData: FormData,
): Promise<AssessmentResult> {
  const session = await requireSession();

  const parsed = assessmentSchema.safeParse({
    projectRubricId: formData.get("projectRubricId"),
    criterionKey: formData.get("criterionKey"),
    status: formData.get("status"),
    evidence: formData.get("evidence") || undefined,
    note: formData.get("note") || undefined,
    projectSlug: formData.get("projectSlug"),
  });

  if (!parsed.success) {
    return { ok: false, errors: { form: "That change could not be read. Reload and try again." } };
  }

  const result = await saveAssessment(db(), session.tenant.id, {
    projectRubricId: parsed.data.projectRubricId,
    criterionKey: parsed.data.criterionKey,
    status: parsed.data.status as CriterionStatus,
    evidence: parsed.data.evidence ?? null,
    note: parsed.data.note ?? null,
    actorId: session.user.id,
  });

  if (!result.ok) {
    return {
      ok: false,
      errors: Object.fromEntries(result.issues.map((issue) => [issue.path, issue.message])),
    };
  }

  revalidatePath(`/projects/${parsed.data.projectSlug}`);
  revalidatePath("/projects");
  revalidatePath("/rubrics");
  return { ok: true };
}

const moveSchema = z.object({
  boardId: z.string().uuid(),
  cardId: z.string().uuid(),
  toColumnId: z.string().uuid(),
  toIndex: z.coerce.number().int().min(0),
});

export async function moveCardAction(formData: FormData) {
  const session = await requireSession();
  const parsed = moveSchema.safeParse({
    boardId: formData.get("boardId"),
    cardId: formData.get("cardId"),
    toColumnId: formData.get("toColumnId"),
    toIndex: formData.get("toIndex"),
  });
  if (!parsed.success) return;

  const { boardId, cardId, toColumnId, toIndex } = parsed.data;

  try {
    await moveCardTo(db(), session.tenant.id, boardId, cardId, toColumnId, toIndex, session.user.id);
  } catch (error) {
    // The sparse gap between two neighbours has closed. Re-space that column
    // and retry once; a second failure is a real bug, not a full column.
    if (!(error instanceof PositionExhaustedError)) throw error;
    await rebalanceColumn(db(), session.tenant.id, toColumnId);
    await moveCardTo(db(), session.tenant.id, boardId, cardId, toColumnId, toIndex, session.user.id);
  }

  revalidatePath(`/boards/${boardId}`);
}

const applySchema = z.object({
  projectId: z.string().uuid(),
  rubricId: z.string().uuid(),
  projectSlug: z.string().min(1),
  generateCards: z.coerce.boolean().optional(),
});

export async function applyRubricAction(formData: FormData) {
  const session = await requireSession();
  const parsed = applySchema.safeParse({
    projectId: formData.get("projectId"),
    rubricId: formData.get("rubricId"),
    projectSlug: formData.get("projectSlug"),
    generateCards: formData.get("generateCards") === "on",
  });
  if (!parsed.success) return;

  await applyRubricToProject(
    db(),
    session.tenant.id,
    parsed.data.projectId,
    parsed.data.rubricId,
    { generateCards: parsed.data.generateCards ?? false, actorId: session.user.id },
  );

  revalidatePath(`/projects/${parsed.data.projectSlug}`);
  revalidatePath("/projects");
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}
