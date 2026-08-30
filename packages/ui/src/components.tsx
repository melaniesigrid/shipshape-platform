import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "./cn.ts";

/**
 * Presentational primitives only — no hooks and no event handlers of their own.
 * That keeps every one of them usable from a server component without dragging
 * a `"use client"` boundary into this package.
 */

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-card font-medium " +
  "transition-[background-color,box-shadow,color,transform] duration-150 " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-45 select-none";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-sea text-card hover:bg-sea-deep shadow-card",
  secondary: "bg-raised text-ink ring-1 ring-hair hover:ring-hair-strong shadow-card",
  ghost: "bg-transparent text-ink-soft hover:text-ink hover:bg-sunk",
  danger: "bg-transparent text-blocked ring-1 ring-blocked/30 hover:bg-blocked-soft",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "text-[13px] px-3 py-1.5",
  md: "text-[14px] px-4 py-2",
};

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Panel({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("rounded-card bg-card ring-1 ring-hair shadow-card", className)}
      {...props}
    />
  );
}

export function SectionHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hair pb-2">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[15px]">{title}</h2>
        {detail ? <span className="text-[13px] text-ink-faint">{detail}</span> : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Empty states carry the next action, never just an apology. A screen that says
 * "No projects" and nothing else is a dead end.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-hair-strong px-6 py-10 text-center">
      <p className="font-display text-[15px] text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-[46ch] text-[13px] leading-relaxed text-ink-faint">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export type Readiness = "blocked" | "at_risk" | "on_track" | "ready";

const READINESS_LABEL: Record<Readiness, string> = {
  blocked: "Blocked",
  at_risk: "At risk",
  on_track: "On track",
  ready: "Ready",
};

const READINESS_CLASS: Record<Readiness, string> = {
  blocked: "bg-blocked-soft text-blocked",
  at_risk: "bg-at-risk-soft text-at-risk",
  on_track: "bg-on-track-soft text-on-track",
  ready: "bg-ready-soft text-ready",
};

const READINESS_BAR: Record<Readiness, string> = {
  blocked: "bg-blocked",
  at_risk: "bg-at-risk",
  on_track: "bg-on-track",
  ready: "bg-ready",
};

export function ReadinessPill({ readiness, count }: { readiness: Readiness; count?: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[12px] font-medium",
        READINESS_CLASS[readiness],
      )}
    >
      {READINESS_LABEL[readiness]}
      {readiness === "blocked" && count ? (
        <span className="font-mono text-[11px] opacity-80">{count}</span>
      ) : null}
    </span>
  );
}

/**
 * The score bar. Colour comes from readiness rather than from the percentage,
 * so a project at 96% that is missing a required criterion still reads red —
 * which is the whole argument of the product.
 */
export function ScoreBar({
  percentBp,
  readiness,
  showLabel = true,
}: {
  percentBp: number;
  readiness: Readiness;
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, percentBp / 100));
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-pill bg-sunk"
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${READINESS_LABEL[readiness]}, ${pct.toFixed(0)} percent`}
      >
        <div
          className={cn("h-full rounded-pill transition-[width] duration-500", READINESS_BAR[readiness])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? (
        <span className="w-11 shrink-0 text-right font-mono text-[12px] tabular-nums text-ink-soft">
          {pct.toFixed(0)}%
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Criterion status
// ---------------------------------------------------------------------------

export type CriterionStatus =
  | "not_started"
  | "in_progress"
  | "met"
  | "waived"
  | "not_applicable";

export const STATUS_LABEL: Record<CriterionStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  met: "Met",
  waived: "Waived",
  not_applicable: "N/A",
};

const STATUS_CLASS: Record<CriterionStatus, string> = {
  not_started: "bg-sunk text-ink-faint",
  in_progress: "bg-at-risk-soft text-at-risk",
  met: "bg-ready-soft text-ready",
  waived: "bg-waived-soft text-waived",
  not_applicable: "bg-sunk text-na",
};

export function StatusChip({ status }: { status: CriterionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-pill px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
        STATUS_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** A criterion key. Monospaced because it is an identifier, not prose. */
export function CriterionKey({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-sunk px-1.5 py-0.5 font-mono text-[11px] text-ink-faint">
      {children}
    </code>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">
      {children}
    </span>
  );
}

/** A required criterion, marked once and consistently. */
export function RequiredMark() {
  return (
    <span
      title="Required — an unmet required criterion blocks the project at any score"
      className="font-mono text-[12px] text-blocked"
      aria-label="Required"
    >
      *
    </span>
  );
}
