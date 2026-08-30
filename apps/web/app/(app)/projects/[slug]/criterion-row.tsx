"use client";

import { CriterionKey, RequiredMark, STATUS_LABEL, type CriterionStatus } from "@shipshape/ui";
import { useActionState, useId, useState } from "react";

import { setAssessment, type AssessmentResult } from "../../actions";

const INITIAL: AssessmentResult = { ok: true };

const STATUSES: CriterionStatus[] = [
  "not_started",
  "in_progress",
  "met",
  "waived",
  "not_applicable",
];

export interface CriterionRowProps {
  projectRubricId: string;
  projectSlug: string;
  criterionKey: string;
  title: string;
  guidance: string;
  weight: number;
  required: boolean;
  evidenceRequired: boolean;
  status: CriterionStatus;
  evidence: string | null;
  note: string | null;
  /** What the board thinks, when open cards point at this criterion. */
  suggestion?: { status: CriterionStatus; reason: string } | null;
}

/**
 * One row of the rubric, and the only place a criterion changes.
 *
 * The evidence and note fields appear only for the statuses that require them,
 * because a form that always shows six fields teaches people to ignore all six.
 * The server validates the same rule regardless — this is a courtesy, not the
 * enforcement.
 */
export function CriterionRow(props: CriterionRowProps) {
  const [state, action, pending] = useActionState(setAssessment, INITIAL);
  const [status, setStatus] = useState<CriterionStatus>(props.status);
  const [open, setOpen] = useState(false);
  const id = useId();

  const needsEvidence = props.evidenceRequired && status === "met";
  const needsNote = status === "waived" || status === "not_applicable";
  const dirty = status !== props.status;

  return (
    <form
      action={action}
      className="border-b border-hair py-3 last:border-0"
      aria-busy={pending || undefined}
    >
      <input type="hidden" name="projectRubricId" value={props.projectRubricId} />
      <input type="hidden" name="criterionKey" value={props.criterionKey} />
      <input type="hidden" name="projectSlug" value={props.projectSlug} />

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-left text-[14px] font-medium hover:text-sea"
              aria-expanded={open}
              aria-controls={`${id}-guidance`}
            >
              {props.title}
            </button>
            {props.required ? <RequiredMark /> : null}
            <span className="font-mono text-[11px] text-ink-faint">{props.weight}pt</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CriterionKey>{props.criterionKey}</CriterionKey>
            {props.evidence ? (
              <span className="truncate text-[12px] text-ink-faint" title={props.evidence}>
                {props.evidence}
              </span>
            ) : null}
          </div>

          {open ? (
            <p
              id={`${id}-guidance`}
              className="mt-2 max-w-[70ch] rounded-card bg-sunk px-3 py-2 text-[13px] leading-relaxed text-ink-soft"
            >
              {props.guidance}
            </p>
          ) : null}

          {props.note ? (
            <p className="mt-1.5 max-w-[70ch] text-[12px] leading-relaxed text-ink-faint italic">
              {props.note}
            </p>
          ) : null}

          {/* The board's opinion, offered rather than applied. Marking a
              criterion met is a claim about a standard, and a person makes it. */}
          {props.suggestion ? (
            <p className="mt-2 rounded-card bg-on-track-soft px-3 py-1.5 text-[12px] text-on-track">
              The board suggests <strong>{STATUS_LABEL[props.suggestion.status]}</strong> —{" "}
              {props.suggestion.reason}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor={`${id}-status`}>
            Status for {props.title}
          </label>
          <select
            id={`${id}-status`}
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as CriterionStatus)}
            className="rounded-card bg-raised px-2.5 py-1.5 text-[13px] ring-1 ring-hair focus:ring-sea"
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={pending || (!dirty && !needsEvidence && !needsNote)}
            className="rounded-card px-2.5 py-1.5 text-[13px] text-sea transition-colors hover:bg-sea-soft disabled:pointer-events-none disabled:opacity-0"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {needsEvidence || needsNote ? (
        <div className="mt-2 space-y-2 pl-0">
          {needsEvidence ? (
            <div>
              <label htmlFor={`${id}-evidence`} className="text-[12px] text-ink-soft">
                Evidence — a link or a sentence proving it
              </label>
              <input
                id={`${id}-evidence`}
                name="evidence"
                defaultValue={props.evidence ?? ""}
                placeholder="https://… or what you checked"
                className="mt-1 w-full rounded-card bg-raised px-3 py-1.5 text-[13px] ring-1 ring-hair placeholder:text-ink-faint focus:ring-sea"
              />
            </div>
          ) : null}

          {needsNote ? (
            <div>
              <label htmlFor={`${id}-note`} className="text-[12px] text-ink-soft">
                {status === "waived"
                  ? "Why are you shipping without it?"
                  : "Why does this not apply?"}
              </label>
              <input
                id={`${id}-note`}
                name="note"
                defaultValue={props.note ?? ""}
                className="mt-1 w-full rounded-card bg-raised px-3 py-1.5 text-[13px] ring-1 ring-hair focus:ring-sea"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {state.errors
        ? Object.entries(state.errors).map(([field, message]) => (
            <p key={field} role="alert" className="mt-2 text-[12px] text-blocked">
              {message}
            </p>
          ))
        : null}
    </form>
  );
}
