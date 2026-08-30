import { db, listRubrics } from "@shipshape/db";
import { EmptyState, Panel, SectionHeading } from "@shipshape/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Rubrics" };

export default async function RubricsPage() {
  const session = await requireSession();
  const rubrics = await listRubrics(db(), session.tenant.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[24px]">Rubrics</h1>
        <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-ink-soft">
          A rubric is a standard written once and applied to every project that should meet it.
          Open one to see which projects match it and which do not.
        </p>
      </header>

      {rubrics.length === 0 ? (
        <EmptyState
          title="No rubrics yet"
          body="Shipshape comes with three: launch readiness, a security and privacy baseline, and discovery. Run the seed to load them, or write your own."
        />
      ) : (
        <div className="space-y-3">
          {rubrics.map((rubric) => (
            <Link key={rubric.id} href={`/rubrics/${rubric.id}`} className="block">
              <Panel className="p-5 transition-shadow hover:shadow-lift">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-[17px]">{rubric.name}</h2>
                  <span className="shrink-0 font-mono text-[12px] text-ink-faint">
                    v{rubric.version} · pass at {rubric.passThreshold}%
                  </span>
                </div>
                <p className="mt-1.5 max-w-[80ch] text-[13px] leading-relaxed text-ink-soft">
                  {rubric.description}
                </p>
              </Panel>
            </Link>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <SectionHeading title="How scoring works" />
        <Panel className="space-y-2 p-5 text-[13px] leading-relaxed text-ink-soft">
          <p>
            Each criterion carries a weight in whole points. A met criterion earns all of them, one
            in progress earns half, and one not started earns none.
          </p>
          <p>
            <strong className="text-ink">Not applicable</strong> leaves the denominator entirely, so
            a rubric with a criterion that does not apply to a project can still reach 100%.{" "}
            <strong className="text-ink">Waived</strong> earns full credit and clears the block, but
            stays on the record — shipping without something is a decision worth being able to find
            again.
          </p>
          <p>
            A required criterion that is unmet blocks the project at any percentage. Nine tenths of
            a launch is not a launch.
          </p>
        </Panel>
      </section>
    </div>
  );
}
