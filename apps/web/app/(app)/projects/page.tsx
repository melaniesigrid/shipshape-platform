import { formatBp } from "@shipshape/core";
import { db, listProjectsWithScores, listRubrics } from "@shipshape/db";
import {
  EmptyState,
  Panel,
  ReadinessPill,
  ScoreBar,
  SectionHeading,
  type Readiness,
} from "@shipshape/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Projects" };

const STATUS_LABEL: Record<string, string> = {
  idea: "Idea",
  building: "Building",
  live: "Live",
  paused: "Paused",
  archived: "Archived",
};

export default async function ProjectsPage() {
  const session = await requireSession();
  const [projects, rubrics] = await Promise.all([
    listProjectsWithScores(db(), session.tenant.id),
    listRubrics(db(), session.tenant.id),
  ]);

  const blocked = projects.filter((p) => p.rubrics.some((r) => r.readiness === "blocked"));
  const totalBlockers = projects.reduce(
    (sum, p) => sum + p.rubrics.reduce((n, r) => n + r.blockingCount, 0),
    0,
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-[24px]">Projects</h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          {projects.length === 0
            ? "Nothing here yet."
            : totalBlockers === 0
              ? `${projects.length} projects, nothing blocking.`
              : `${projects.length} projects. ${totalBlockers} blocking ${
                  totalBlockers === 1 ? "criterion" : "criteria"
                } across ${blocked.length} of them.`}
        </p>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="A project is anything you hold to a standard — a product, a site, a client engagement. Add one, apply a rubric, and the gaps become cards on its board."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map(({ project, rubrics: applied }) => (
            <Panel key={project.id} className="p-5 transition-shadow hover:shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/projects/${project.slug}`}
                    className="flex items-center gap-2 font-display text-[17px] hover:text-sea"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-pill"
                      style={{ background: project.color }}
                    />
                    <span className="truncate">{project.name}</span>
                  </Link>
                  {project.summary ? (
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-faint">
                      {project.summary}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[11px] tracking-[0.08em] text-ink-faint uppercase">
                  {STATUS_LABEL[project.status] ?? project.status}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {applied.length === 0 ? (
                  <p className="text-[13px] text-ink-faint">
                    No rubric applied.{" "}
                    <Link href={`/projects/${project.slug}`} className="text-sea underline">
                      Hold it to one
                    </Link>
                    .
                  </p>
                ) : (
                  applied.map((rubric) => (
                    <div key={rubric.projectRubricId}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] text-ink-soft">
                          {rubric.rubricName}
                        </span>
                        <ReadinessPill
                          readiness={rubric.readiness as Readiness}
                          count={rubric.blockingCount}
                        />
                      </div>
                      <ScoreBar
                        percentBp={rubric.percentBp}
                        readiness={rubric.readiness as Readiness}
                      />
                    </div>
                  ))
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {rubrics.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading
            title="Rubrics"
            detail="The standards these projects are held to"
            action={
              <Link href="/rubrics" className="text-[13px] text-sea hover:underline">
                See all
              </Link>
            }
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {rubrics.map((rubric) => (
              <Link
                key={rubric.id}
                href={`/rubrics/${rubric.id}`}
                className="rounded-card bg-card p-4 ring-1 ring-hair transition-shadow hover:shadow-lift"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-[15px]">{rubric.name}</span>
                  <span className="font-mono text-[11px] text-ink-faint">v{rubric.version}</span>
                </div>
                <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-ink-faint">
                  {rubric.description}
                </p>
                <p className="mt-2 font-mono text-[11px] text-ink-faint">
                  Pass at {formatBp(rubric.passThreshold * 100, 0)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
