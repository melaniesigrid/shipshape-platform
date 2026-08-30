/**
 * Generate the public brand page from the private one.
 *
 * brand/index.html is scored against Northbound's *real* portfolio, which makes
 * it the honest version and exactly why it cannot go on a public URL: it states
 * that a named live product has no payment keys in production, no deployed
 * unsubscribe, and an unmet legal criterion. That is a disclosure of our own
 * compliance gaps to anyone who finds the page.
 *
 * So the design is published verbatim and only the *data* is swapped for an
 * illustrative portfolio. One source of truth for every colour, type and
 * component decision; no second copy of the markup to drift.
 *
 *   node brand/build-public.mjs
 *
 * Fails loudly if any substitution stops matching — a silent miss would leak
 * the exact sentence this script exists to remove.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, "index.html");
const OUT = join(here, "dist", "index.html");

/**
 * Real project names carry the disclosure, so every one is replaced. Scores and
 * colours are kept exactly as they are: the page exists to show how the palette
 * behaves across a spread of readiness states, and inventing a prettier spread
 * would make it a worse demonstration of the design.
 */
const PROJECTS = [
  // Context-scoped, so the studio attribution in the masthead and footer
  // survives: "Northbound Studio" is our byline there, not portfolio data.
  ['<div class="proof-name">Northbound Studio</div>', '<div class="proof-name">Atlas</div>'],
  ["Northbound Studio</td>", "Atlas</td>"],
  ["Quotefront", "Beacon"],
  ["ZipQuarry", "Cormorant"],
  ["Windward", "Meridian"],
  ["ReconAI", "Ledger"],
  ["Duebook", "Dovetail"],
  ["Millwright", "Tideline"],
  ["Shipshape</td>", "Sextant</td>"], // table row only — never the product's own name
];

/** Prose that describes the data as ours, plus the one project-specific note. */
const PROSE = [
  [
    "Eight real Northbound projects against three rubrics — the numbers the seed produces today, not a mockup. This is the view the studio runs on.",
    "Eight projects against three rubrics. Illustrative data, chosen to show how the palette behaves across the full spread of readiness states.",
  ],
  [
    "Scored 29 August 2026. Sorted worst first, because that is the order the work gets done in.",
    "Illustrative portfolio. Sorted worst first, because that is the order the work gets done in.",
  ],
  [
    "Nameservers stay put — moving them would kill @zipquarry.com mail.",
    "Nameservers stay put — moving them would break inbound mail.",
  ],
  [
    "Real criteria from the launch-readiness rubric, at three of the five statuses.",
    "Criteria from the built-in launch-readiness rubric, at four of the five statuses.",
  ],
  [
    "so it can be judged before the app builds.",
    "so the identity can be judged on its own.",
  ],
];

const source = await readFile(SOURCE, "utf8");
let out = source;
const missed = [];

for (const [from, to] of [...PROJECTS, ...PROSE]) {
  if (!out.includes(from)) {
    missed.push(from);
    continue;
  }
  out = out.replaceAll(from, to);
}

if (missed.length > 0) {
  console.error("Substitutions no longer match the source page:\n");
  for (const miss of missed) console.error(`  ${JSON.stringify(miss)}`);
  console.error("\nFix build-public.mjs before publishing — a silent miss leaks the line.");
  process.exit(1);
}

// Belt and braces. If any real project name survives the pass above, stop:
// this file's whole job is that none of them reach a public URL.
const LEAKS = ["ZipQuarry", "zipquarry", "Quotefront", "ReconAI", "Windward", "Duebook", "Millwright"];
const leaked = LEAKS.filter((name) => out.includes(name));
if (leaked.length > 0) {
  console.error(`Refusing to write: ${leaked.join(", ")} still present in the output.`);
  process.exit(1);
}

// The studio name is allowed, but only as a byline. Two occurrences, and
// neither of them inside the portfolio table or a scorecard.
const attributions = out.match(/Northbound Studio/g)?.length ?? 0;
const table = out.slice(out.indexOf("<table"), out.indexOf("</table>"));
if (attributions !== 2 || table.includes("Northbound Studio") || out.includes('proof-name">Northbound')) {
  console.error(
    `Refusing to write: expected the studio name twice as a byline, found ${attributions} and/or one inside the data.`,
  );
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, out, "utf8");

console.log(`Wrote ${OUT}`);
console.log(`${PROJECTS.length + PROSE.length} substitutions applied, no real project names remain.`);
