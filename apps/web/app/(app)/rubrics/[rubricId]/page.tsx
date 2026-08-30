import { formatBp } from "@shipshape/core";
import { db, loadPortfolio, loadRubric } from "@shipshape/db";
import {
  CriterionKey,
  EmptyState,
  Panel,
  ReadinessPill,
  RequiredMark,
  ScoreBar,
  SectionHeading,
} from "@shipshape/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";

interface PageProps {
  params: Promise<{ rubricId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { rubricId } = await params;
  const session = await requireSession();
  const loaded = await loadRubric(db(), session.tenant.id, rubricId);
  return { title: loaded?.row.name ?? "Rubric" };
}

/**
 * One rubric, every project held to it.
 *
 * The view the product exists for. A per-project score answers "how is this one
 * doing"; this answers "which of the eight things we own still cannot take a
 * payment", which is the question that actually changes what gets worked on.
 */
export default async function RubricPage({ params }: PageProps) {
  const [{ rubricId }, session] = await Promise.all([params, requireSession()]);

  const [loaded, rollup] = await Promise.all([
    loadRubric(db(), session.tenant.id, rubricId),
    loadPortfolio(db(), session.tenant.id, rubricId),
  ]);
  if (!loaded || !rollup) notFound();

  const projects = rollup.projects;
  const gaps = rollup.weakest.filter((c) => c.blockedProjectIds.length > 0).slice(0, 6);
  const projectName = new Map(projects.map((p) => [p.projectId, p.projectName]));

  return (
    <div className="space-y-8">
      <header>
        <Link href="/rubrics" className="text-[13px] text-ink-faint hover:text-ink">
          ← Rubrics
        </Link>
        <h1 className="mt-2 font-display text-[24px]">{loaded.row.name}</h1>
        <p className="mt-1 max-w-[75ch] text-[14px] leading-relaxed text-ink-soft">
          {loaded.row.description}
        </p>
        <p className="mt-2 font-mono text-[12px] text-ink-faint">
          v{loaded.row.version} · {loaded.domain.criteria.length} criteria ·{" "}
          {loaded.domain.criteria.filter((c) => c.required).length} required · pass at{" "}
          {loaded.row.passThreshold}%
        </p>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          title="Not applied to anything yet"
          body="Open a project and apply this rubric. Every gap it finds becomes a card on that project's board, carrying the criterion's guidance as acceptance criteria."
        />
      ) : (
        <>
          <section className="space-y-3">
            <SectionHeading
              title="Projects"
              detail={`${projects.filter((p) => p.score.passing).length} of ${projects.length} passing`}
            />
            <Panel className="divide-y divide-hair">
              {[...projects]
                .sort((a, b) => a.score.percentBp - b.score.percentBp)
                .map((project) => (
                  <div key={project.projectId} className="flex items-center gap-4 px-5 py-3">
                    <span className="w-40 shrink-0 truncate text-[14px] font-medium">
                      {project.projectName}
                    </span>
                    <div className="flex-1">
                      <ScoreBar
                        percentBp={project.score.percentBp}
                        readiness={project.score.readiness}
                      />
                    </div>
                    <div className="w-28 shrink-0 text-right">
                      <ReadinessPill
                        readiness={project.score.readiness}
                        count={project.score.blocking.length}
                      />
                    </div>
                  </div>
                ))}
            </Panel>
          </section>

          {gaps.length > 0 ? (
            <section className="space-y-3">
              <SectionHeading
                title="Where the portfolio is weakest"
                detail="Required criteria, worst coverage first"
              />
              <Panel className="divide-y divide-hair">
                {gaps.map((gap) => (
                  <div key={gap.criterion.id} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] font-medium">
                        {gap.criterion.title} <RequiredMark />
                      </span>
                      <span className="shrink-0 font-mono text-[12px] text-ink-faint">
                        {gap.met}/{projects.length - gap.notApplicable} met
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-blocked">
                      Blocking{" "}
                      {gap.blockedProjectIds
                        .map((id) => projectName.get(id) ?? id)
                        .join(", ")}
                      .
                    </p>
                    <p className="mt-1 max-w-[80ch] text-[12px] leading-relaxed text-ink-faint">
                      {gap.criterion.guidance}
                    </p>
                  </div>
                ))}
              </Panel>
            </section>
          ) : null}

          <section className="space-y-3">
            <SectionHeading
              title="Every criterion, every project"
              detail="Coverage across the portfolio"
            />
            <Panel className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <caption className="sr-only">
                  Coverage of each criterion across every project held to this rubric
                </caption>
                <thead>
                  <tr className="border-b border-hair">
                    <th scope="col" className="px-5 py-2.5 text-left font-medium">
                      Criterion
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      Coverage
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">
                      Met
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      In progress
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      Not started
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      N/A
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rollup.criteria.map((row) => (
                    <tr key={row.criterion.id} className="border-b border-hair last:border-0">
                      <th scope="row" className="max-w-[36ch] px-5 py-2.5 text-left font-normal">
                        <span className="block truncate">
                          {row.criterion.title}
                          {row.criterion.required ? <RequiredMark /> : null}
                        </span>
                        <CriterionKey>{row.criterion.id}</CriterionKey>
                      </th>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {formatBp(row.coverageBp, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ready">
                        {row.met || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-at-risk">
                        {row.inProgress || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-faint">
                        {row.notStarted || "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums text-na">
                        {row.notApplicable || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}
