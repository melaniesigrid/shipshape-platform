import { formatBp, suggestAll } from "@shipshape/core";
import {
  db,
  getBoardForProject,
  getProjectBySlug,
  listProjectRubrics,
  listRubrics,
  loadBoard,
  loadProjectRubric,
} from "@shipshape/db";
import {
  Button,
  EmptyState,
  Panel,
  ReadinessPill,
  ScoreBar,
  SectionHeading,
  type CriterionStatus,
} from "@shipshape/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";

import { applyRubricAction } from "../../actions";
import { CriterionRow } from "./criterion-row";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ r?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const session = await requireSession();
  const project = await getProjectBySlug(db(), session.tenant.id, slug);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const [{ slug }, query, session] = await Promise.all([params, searchParams, requireSession()]);

  const project = await getProjectBySlug(db(), session.tenant.id, slug);
  if (!project) notFound();

  const [applied, allRubrics, board] = await Promise.all([
    listProjectRubrics(db(), session.tenant.id, project.id),
    listRubrics(db(), session.tenant.id),
    getBoardForProject(db(), session.tenant.id, project.id),
  ]);

  // Default to the rubric with the most blockers: the one that needs looking at.
  const selectedId =
    query.r ??
    [...applied].sort((a, b) => b.blockingCount - a.blockingCount)[0]?.projectRubricId;

  const view = selectedId
    ? await loadProjectRubric(db(), session.tenant.id, selectedId)
    : undefined;

  // What the board implies about the rubric, from cards that name a criterion.
  const boardView = board ? await loadBoard(db(), session.tenant.id, board.id) : undefined;
  const suggestions =
    view && boardView
      ? new Map(
          suggestAll(view.rubric, boardView.board, boardView.cards, view.assessments).map((s) => [
            s.criterionId,
            { status: s.suggested, reason: s.reason },
          ]),
        )
      : new Map<string, { status: CriterionStatus; reason: string }>();

  const unapplied = allRubrics.filter((r) => !applied.some((a) => a.rubricId === r.id));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-3 rounded-pill"
              style={{ background: project.color }}
            />
            <h1 className="font-display text-[24px]">{project.name}</h1>
          </div>
          {project.summary ? (
            <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-ink-soft">
              {project.summary}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {project.productionUrl ? (
            <a
              href={project.productionUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-sea hover:underline"
            >
              Live site
            </a>
          ) : null}
          {board ? (
            <Link href={`/boards/${board.id}`}>
              <Button variant="secondary" size="sm">
                Open board
              </Button>
            </Link>
          ) : null}
        </div>
      </header>

      {applied.length > 1 ? (
        <nav className="flex flex-wrap gap-2">
          {applied.map((rubric) => {
            const active = rubric.projectRubricId === selectedId;
            return (
              <Link
                key={rubric.projectRubricId}
                href={`/projects/${project.slug}?r=${rubric.projectRubricId}`}
                className={
                  active
                    ? "rounded-pill bg-sea px-3 py-1 text-[13px] text-card"
                    : "rounded-pill bg-sunk px-3 py-1 text-[13px] text-ink-soft hover:text-ink"
                }
              >
                {rubric.rubricName}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {!view ? (
        <EmptyState
          title="No rubric applied"
          body="A rubric is the standard this project has to match. Apply one and every gap it finds becomes a card on the board, carrying the criterion's guidance as its acceptance criteria."
          action={
            unapplied[0] ? (
              <form action={applyRubricAction} className="flex items-center gap-3">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="rubricId" value={unapplied[0].id} />
                <input type="hidden" name="projectSlug" value={project.slug} />
                <input type="hidden" name="generateCards" value="on" />
                <Button type="submit">Apply {unapplied[0].name}</Button>
              </form>
            ) : null
          }
        />
      ) : (
        <>
          <Panel className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-[17px]">{view.rubric.name}</h2>
                <p className="mt-0.5 text-[13px] text-ink-faint">
                  v{view.rubric.version} · pass at {view.rubric.passThreshold}% · {view.rubric.criteria.length} criteria
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-[26px] tabular-nums">
                  {formatBp(view.score.percentBp, 0)}
                </span>
                <ReadinessPill
                  readiness={view.score.readiness}
                  count={view.score.blocking.length}
                />
              </div>
            </div>

            <div className="mt-4">
              <ScoreBar
                percentBp={view.score.percentBp}
                readiness={view.score.readiness}
                showLabel={false}
              />
            </div>

            {view.score.blocking.length > 0 ? (
              <div className="mt-4 rounded-card bg-blocked-soft px-4 py-3">
                <p className="text-[13px] font-medium text-blocked">
                  {view.score.blocking.length} required{" "}
                  {view.score.blocking.length === 1 ? "criterion is" : "criteria are"} unmet. The
                  score does not matter until {view.score.blocking.length === 1 ? "it is" : "they are"} settled.
                </p>
                <ul className="mt-2 space-y-0.5">
                  {view.score.blocking.map((criterion) => (
                    <li key={criterion.id} className="text-[13px] text-blocked/85">
                      {criterion.title}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {view.score.waived.length > 0 ? (
              <p className="mt-3 text-[13px] text-waived">
                {view.score.waived.length} waived:{" "}
                {view.score.waived.map((c) => c.title).join(", ")}. Earned, but on the record.
              </p>
            ) : null}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {view.score.sections.map((section) => (
                <div key={section.section} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-[13px] text-ink-soft">
                    {section.section}
                  </span>
                  <div className="flex-1">
                    <ScoreBar
                      percentBp={section.percentBp}
                      readiness={view.score.readiness}
                      showLabel
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {groupBySection(view.rubric.criteria).map(([section, criteria]) => (
            <section key={section} className="space-y-1">
              <SectionHeading
                title={section}
                detail={`${criteria.filter((c) => view.rows.get(c.id)?.status === "met").length} of ${criteria.length} met`}
              />
              <Panel className="px-5 py-1">
                {criteria.map((criterion) => {
                  const row = view.rows.get(criterion.id);
                  return (
                    <CriterionRow
                      key={criterion.id}
                      projectRubricId={view.projectRubricId}
                      projectSlug={project.slug}
                      criterionKey={criterion.id}
                      title={criterion.title}
                      guidance={criterion.guidance}
                      weight={criterion.weight}
                      required={criterion.required}
                      evidenceRequired={criterion.evidenceRequired ?? false}
                      status={(row?.status ?? "not_started") as CriterionStatus}
                      evidence={row?.evidence ?? null}
                      note={row?.note ?? null}
                      suggestion={suggestions.get(criterion.id) ?? null}
                    />
                  );
                })}
              </Panel>
            </section>
          ))}
        </>
      )}

      {unapplied.length > 0 && view ? (
        <section className="space-y-3">
          <SectionHeading title="Hold this project to another standard" />
          <div className="flex flex-wrap gap-3">
            {unapplied.map((rubric) => (
              <form key={rubric.id} action={applyRubricAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="rubricId" value={rubric.id} />
                <input type="hidden" name="projectSlug" value={project.slug} />
                <input type="hidden" name="generateCards" value="on" />
                <Button type="submit" variant="secondary" size="sm">
                  Apply {rubric.name}
                </Button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Preserve the rubric's own ordering rather than sorting sections alphabetically. */
function groupBySection<T extends { section: string }>(criteria: readonly T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const criterion of criteria) {
    const list = groups.get(criterion.section) ?? [];
    list.push(criterion);
    groups.set(criterion.section, list);
  }
  return [...groups.entries()];
}
