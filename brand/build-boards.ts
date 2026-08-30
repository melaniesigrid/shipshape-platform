/**
 * Builds the portfolio board from `docs/projects/*.md`.
 *
 * The markdown is the source of truth, not this script. Each project file
 * carries its own frontmatter, its written explanation, and its board as a
 * markdown checklist — which means updating a board is editing prose in a file
 * a human can read, and the explanation lives next to the work rather than in
 * someone's memory.
 *
 * That matters more than it sounds: the previous preview renamed every project
 * for publication, and the result was a board nobody could identify. Context is
 * a feature, so it gets a source file.
 *
 *   node brand/build-boards.ts
 *
 * Output is `brand/boards.html` — real portfolio data, so it is NOT published
 * to the public Pages repo. See build-public.mjs for why.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { allThemesCss } from "../packages/ui/src/theme-css.ts";
import { DEFAULT_THEME_ID, THEMES, THEME_ATTRIBUTE } from "../packages/ui/src/themes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(here, "..", "docs", "projects");

/** Every board shows the same four columns, so an empty one is visible as a gap. */
const COLUMNS = ["Backlog", "In progress", "Blocked", "Done"] as const;
const DONE_COLUMN = "Done";
const WIP_LIMITS: Record<string, number> = { "In progress": 3 };

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

interface Card {
  id: string;
  title: string;
  criterion: string | null;
  required: boolean;
  note: string | null;
  done: boolean;
}

interface Section {
  heading: string;
  html: string;
}

interface Project {
  slug: string;
  name: string;
  summary: string;
  status: string;
  color: string;
  rubric: string;
  score: number;
  readiness: string;
  blocking: number;
  production: string | null;
  needsDescription: boolean;
  sections: Section[];
  columns: Array<{ name: string; wipLimit: number | null; isDone: boolean; cards: Card[] }>;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Just enough markdown for the prose blocks: bold, inline code, links.
 *
 * Deliberately not a markdown library. The input is eight files written by one
 * person to a known shape; a parser that handles tables and footnotes would be
 * more code than the thing it renders.
 */
function inline(text: string): string {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

/** Blank-line-separated paragraphs, soft-wrapped lines rejoined. */
function paragraphs(block: string): string {
  return block
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s*\n\s*/g, " "))
    .filter(Boolean)
    .map((p) => `<p>${inline(p)}</p>`)
    .join("");
}

function parseFrontmatter(raw: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  if (!match) throw new Error("Missing frontmatter");
  const out: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    out[line.slice(0, at).trim()] = line
      .slice(at + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

function parseProject(file: string, raw: string): Project {
  const front = parseFrontmatter(raw);
  const body = raw.slice(raw.indexOf("\n---\n") + 5);

  const required = ["name", "slug", "status", "color", "rubric", "score", "readiness", "blocking"];
  for (const key of required) {
    if (!front[key]) throw new Error(`${file}: frontmatter is missing "${key}"`);
  }

  // Split on level-2 headings. Everything before the first one is preamble.
  const parts = body.split(/^## /m).slice(1);
  const sections: Section[] = [];
  const byColumn = new Map<string, Card[]>();

  for (const part of parts) {
    const newline = part.indexOf("\n");
    const heading = part.slice(0, newline).trim();
    const content = part.slice(newline + 1);

    if (heading !== "Board") {
      sections.push({ heading, html: paragraphs(content) });
      continue;
    }

    for (const chunk of content.split(/^### /m).slice(1)) {
      const nl = chunk.indexOf("\n");
      const column = chunk.slice(0, nl).trim();
      const cards: Card[] = [];

      const lines = chunk.slice(nl + 1).split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        const item = /^- \[([ x])\] (.+)$/.exec(lines[i]!.trim());
        if (!item) continue;

        let title = item[2]!;
        const criterion = /`([^`]+)`/.exec(title)?.[1] ?? null;
        const isRequired = title.includes("!required");
        title = title.replace(/`[^`]+`/, "").replace(/!required/, "").trim();

        // An indented blockquote on the next line is the card's note.
        const next = lines[i + 1] ?? "";
        const note = /^\s+> (.+)$/.exec(next)?.[1] ?? null;
        if (note) i += 1;

        cards.push({
          id: `${front.slug}-${column.toLowerCase().replace(/\s+/g, "-")}-${cards.length}`,
          title,
          criterion,
          required: isRequired,
          note,
          done: item[1] === "x",
        });
      }

      byColumn.set(column, cards);
    }
  }

  return {
    slug: front.slug!,
    name: front.name!,
    summary: front.summary ?? "",
    status: front.status!,
    color: front.color!,
    rubric: front.rubric!,
    score: Number(front.score),
    readiness: front.readiness!,
    blocking: Number(front.blocking),
    production: front.production ?? null,
    needsDescription: front.needs_description === "true",
    sections,
    // Render all four columns always, so an empty one shows as a gap rather
    // than silently disappearing.
    columns: COLUMNS.map((name) => ({
      name,
      wipLimit: WIP_LIMITS[name] ?? null,
      isDone: name === DONE_COLUMN,
      cards: byColumn.get(name) ?? [],
    })),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const READINESS_LABEL: Record<string, string> = {
  blocked: "Blocked",
  at_risk: "At risk",
  on_track: "On track",
  ready: "Ready",
};

/**
 * JSON for embedding inside a `<script>` block.
 *
 * The project prose is rendered to HTML before it gets here, so it carries tags
 * like `</strong>`. None of them is `</script>` today, but one `</script` in a
 * future project description would end the block early and break the page — so
 * every `<` is escaped rather than relying on that staying true.
 */
function embed(value: unknown): string {
  // Doubled backslash on purpose. A single one is a TypeScript escape that
  // resolves back to "<", which makes this call a no-op that reads as
  // correct — it was exactly that until this commit.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function page(projects: Project[]): string {
  const data = embed(projects);
  const themeIndex = embed(THEMES.map((t) => ({ id: t.id, family: t.family, mode: t.mode })));
  const families = [...new Map(THEMES.map((t) => [t.family, t])).values()];

  const totals = {
    projects: projects.length,
    blocking: projects.reduce((n, p) => n + p.blocking, 0),
    cards: projects.reduce((n, p) => n + p.columns.reduce((m, c) => m + c.cards.length, 0), 0),
    undocumented: projects.filter((p) => p.needsDescription).length,
  };

  return `<!doctype html>
<html lang="en" ${THEME_ATTRIBUTE}="${DEFAULT_THEME_ID}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Northbound Portfolio</title>
<meta name="description" content="Every Northbound project, its readiness rubric, and the board of work that would clear it.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Hanken+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* ================================================================== */
/* Theme contract — GENERATED from packages/ui/src/themes.ts.          */
/* ================================================================== */

${allThemesCss(THEMES)}

/* ================================================================== */
/* Application                                                         */
/* ================================================================== */

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
  font-size: 15px; line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
h1,h2,h3,h4 { font-family: "Fraunces", ui-serif, Georgia, serif; font-weight: 550; margin: 0; letter-spacing: -0.015em; }
p { margin: 0; }
a { color: var(--accent); }
code { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 0.86em; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 5px; }

.app { min-height: 100vh; background: var(--ground); transition: background-color 240ms ease; }
.shell { display: grid; grid-template-columns: 268px minmax(0, 1fr); gap: 26px; max-width: 1440px; margin: 0 auto; padding: 24px; }
@media (max-width: 900px) { .shell { grid-template-columns: 1fr; } }

/* --- Rail ---------------------------------------------------------- */

.rail { display: flex; flex-direction: column; gap: 14px; align-self: start; position: sticky; top: 24px; }
@media (max-width: 900px) { .rail { position: static; } }

.brand { padding: 2px 4px 0; }
.brand h1 { font-size: 23px; letter-spacing: -0.03em; }
.brand p { font-size: 12.5px; color: var(--ink-faint); margin-top: 1px; }

.rail-list { display: flex; flex-direction: column; gap: 7px; }

.rail-item {
  display: block; width: 100%; text-align: left; border: 0; cursor: pointer;
  font: inherit; color: var(--ink);
  background: var(--surface); border-radius: var(--radius-control);
  box-shadow: var(--elev-raised-sm); padding: 11px 13px;
  transition: box-shadow 160ms ease, transform 160ms ease;
}
.rail-item:hover { transform: translateY(-1px); box-shadow: var(--elev-raised); }
.rail-item[aria-current="true"] { box-shadow: var(--elev-inset); transform: none; }

.rail-top { display: flex; align-items: center; gap: 8px; }
.dot { width: 9px; height: 9px; border-radius: 999px; flex: none; }
.rail-name { font-size: 13.5px; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rail-score { font-family: "JetBrains Mono", monospace; font-size: 11.5px; color: var(--ink-faint); font-variant-numeric: tabular-nums; }
.rail-bar { height: 4px; border-radius: 999px; background: var(--sunken); box-shadow: var(--elev-inset); overflow: hidden; margin-top: 8px; }
.rail-bar > span { display: block; height: 100%; border-radius: 999px; }

/* --- Switcher ------------------------------------------------------ */

.switcher { display: flex; flex-direction: column; gap: 8px; padding: 13px; }
.switch-label { font-family: "JetBrains Mono", monospace; font-size: 9.5px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-faint); }
.switch-row { display: flex; flex-wrap: wrap; gap: 6px; }

.chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 11px; border: 0; cursor: pointer; font: inherit; font-size: 12.5px;
  color: var(--ink-soft); background: var(--surface);
  border-radius: var(--radius-pill); box-shadow: var(--elev-raised-sm);
  transition: box-shadow 160ms ease, color 160ms ease;
}
.chip:hover { color: var(--ink); }
/* Pressed reads as pushed in. On a moulded surface a filled pill would be
   borrowing a flat idiom. */
.chip[aria-pressed="true"] { box-shadow: var(--elev-inset); color: var(--accent); font-weight: 500; }
.chip[disabled] { opacity: 0.38; cursor: not-allowed; }
.chip-dot { width: 8px; height: 8px; border-radius: 999px; }

.mode-note { font-size: 11.5px; color: var(--ink-faint); }

/* --- Panels -------------------------------------------------------- */

.panel { background: var(--surface); border-radius: var(--radius-card); box-shadow: var(--elev-raised); }
.pad { padding: 20px; }

.main { display: flex; flex-direction: column; gap: 18px; min-width: 0; }

.head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; }
.head h2 { font-size: 25px; display: flex; align-items: center; gap: 10px; }
.head .summary { color: var(--ink-soft); font-size: 14px; margin-top: 5px; max-width: 62ch; }

.meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
.tagline { font-family: "JetBrains Mono", monospace; font-size: 11px; color: var(--ink-faint); }

.scoreblock { text-align: right; flex: none; }
.scoreblock .n { font-family: "Fraunces", serif; font-size: 40px; font-weight: 550; line-height: 1; font-variant-numeric: tabular-nums; }
.scoreblock .rubric { font-size: 11.5px; color: var(--ink-faint); margin-top: 3px; }

.bar { height: 8px; border-radius: 999px; background: var(--sunken); box-shadow: var(--elev-inset); overflow: hidden; }
.bar > span { display: block; height: 100%; border-radius: 999px; transition: width 500ms ease; }

.pill { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--radius-pill); padding: 4px 11px; font-size: 12px; font-weight: 500; }
.pill .n { font-family: "JetBrains Mono", monospace; font-size: 11px; opacity: 0.85; }

.pill-blocked, .fillwrap-blocked { background: var(--color-blocked-soft); color: var(--color-blocked); }
.pill-at-risk { background: var(--color-at-risk-soft); color: var(--color-at-risk); }
.pill-on-track { background: var(--color-on-track-soft); color: var(--color-on-track); }
.pill-ready { background: var(--color-ready-soft); color: var(--color-ready); }
.pill-neutral { background: var(--sunken); color: var(--ink-faint); box-shadow: var(--elev-inset); }

.fill-blocked { background: var(--color-blocked); }
.fill-at-risk { background: var(--color-at-risk); }
.fill-on-track { background: var(--color-on-track); }
.fill-ready { background: var(--color-ready); }

/* --- Context ------------------------------------------------------- */

.context { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.context section { padding: 18px 20px; }
.context h3 { font-size: 14px; margin-bottom: 7px; }
.context p { font-size: 13.5px; line-height: 1.6; color: var(--ink-soft); }
.context p + p { margin-top: 9px; }
.context code { background: var(--sunken); padding: 1px 5px; border-radius: 4px; box-shadow: var(--elev-inset); }

.warn {
  padding: 13px 16px; border-radius: var(--radius-card);
  background: var(--color-at-risk-soft); color: var(--color-at-risk);
  font-size: 13.5px; line-height: 1.5;
}

details.context-toggle > summary {
  cursor: pointer; list-style: none; font-size: 12px;
  font-family: "JetBrains Mono", monospace; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--ink-faint); padding: 4px 0;
}
details.context-toggle > summary::-webkit-details-marker { display: none; }
details.context-toggle > summary:hover { color: var(--ink); }
details.context-toggle[open] > summary { margin-bottom: 12px; }

/* --- Board --------------------------------------------------------- */

.board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; align-items: start; }
@media (max-width: 1180px) { .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .board { grid-template-columns: 1fr; } }

.column { background: var(--sunken); border-radius: var(--radius-card); box-shadow: var(--elev-inset); padding: 6px; transition: box-shadow 160ms ease; }
.column.over { box-shadow: var(--elev-inset), 0 0 0 1.5px var(--color-at-risk); }
.column.dragover { box-shadow: var(--elev-inset), 0 0 0 2px var(--accent); }

.col-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 9px 11px 7px; }
.col-head h4 { font-size: 13px; }
.count { font-family: "JetBrains Mono", monospace; font-size: 11px; color: var(--ink-faint); }
.count.over { color: var(--color-at-risk); font-weight: 500; }
.col-warn { margin: 0 7px 7px; padding: 6px 9px; font-size: 11.5px; line-height: 1.4; color: var(--color-at-risk); background: var(--color-at-risk-soft); border-radius: var(--radius-control); }
.col-body { display: flex; flex-direction: column; gap: 9px; padding: 3px 6px 7px; min-height: 52px; }
.col-empty { padding: 16px 8px; text-align: center; font-size: 12px; color: var(--ink-faint); }

.card {
  background: var(--surface); border-radius: var(--radius-control);
  box-shadow: var(--elev-raised-sm); padding: 11px; cursor: grab;
  transition: box-shadow 170ms ease, transform 170ms ease, opacity 170ms ease;
}
.card:hover { box-shadow: var(--elev-raised); transform: translateY(-1px); }
.card.dragging { opacity: 0.4; }
.card.done .card-title { color: var(--ink-faint); }
.card-title { font-size: 13px; font-weight: 500; line-height: 1.4; }
.card-note { font-size: 11.5px; line-height: 1.45; color: var(--ink-faint); margin-top: 5px; }
.tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.tag { font-size: 10px; padding: 2px 7px; border-radius: 999px; background: var(--sunken); color: var(--ink-faint); box-shadow: var(--elev-inset); }
.tag-criterion { font-family: "JetBrains Mono", monospace; background: var(--accent-soft); color: var(--accent); box-shadow: none; }
.tag-required { background: var(--color-blocked-soft); color: var(--color-blocked); box-shadow: none; }

.move { display: flex; gap: 3px; margin-top: 7px; opacity: 0; transition: opacity 150ms ease; }
.card:hover .move, .card:focus-within .move { opacity: 1; }
.move button { border: 0; background: transparent; cursor: pointer; font: inherit; font-size: 12px; color: var(--ink-faint); padding: 2px 7px; border-radius: 6px; }
.move button:hover:not(:disabled) { background: var(--sunken); color: var(--ink); }
.move button:disabled { opacity: 0.25; cursor: not-allowed; }

/* --- Portfolio ----------------------------------------------------- */

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(268px, 1fr)); gap: 15px; }
.pcard { padding: 17px; cursor: pointer; border: 0; text-align: left; font: inherit; color: var(--ink); background: var(--surface); border-radius: var(--radius-card); box-shadow: var(--elev-raised); transition: transform 170ms ease, box-shadow 170ms ease; width: 100%; }
.pcard:hover { transform: translateY(-2px); box-shadow: var(--elev-raised-lg); }
.pcard h3 { font-size: 16px; display: flex; align-items: center; gap: 8px; }
.pcard .summary { font-size: 12.5px; color: var(--ink-faint); margin-top: 5px; min-height: 34px; line-height: 1.45; }
.pcard .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 13px; }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 13px; }
.stat { padding: 15px 17px; }
.stat .k { font-family: "JetBrains Mono", monospace; font-size: 9.5px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-faint); }
.stat .v { font-family: "Fraunces", serif; font-size: 28px; font-weight: 550; line-height: 1.1; margin-top: 3px; font-variant-numeric: tabular-nums; }

footer { grid-column: 1 / -1; font-size: 12px; color: var(--ink-faint); line-height: 1.6; padding: 8px 4px 0; max-width: 84ch; }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; } }
</style>
</head>
<body>
<div class="app">
  <div class="shell">

    <aside class="rail">
      <div class="brand">
        <h1>Shipshape</h1>
        <p>Northbound portfolio</p>
      </div>

      <div class="rail-list">
        <button type="button" class="rail-item" data-view="portfolio" aria-current="true">
          <span class="rail-top"><span class="rail-name">All projects</span>
          <span class="rail-score">${totals.projects}</span></span>
        </button>
      </div>

      <div class="rail-list" id="rail"></div>

      <div class="panel switcher">
        <span class="switch-label">Theme</span>
        <div class="switch-row">${families
          .map(
            (t) =>
              `<button type="button" class="chip" data-family="${t.family}" title="${esc(t.description)}"><span class="chip-dot" style="background:${t.palette.accent}"></span>${esc(t.name)}</button>`,
          )
          .join("")}</div>
        <span class="switch-label" style="margin-top:4px">Mode</span>
        <div class="switch-row">
          <button type="button" class="chip" data-mode="light">Light</button>
          <button type="button" class="chip" data-mode="dark">Dark</button>
          <button type="button" class="chip" data-mode="system">System</button>
        </div>
        <p class="mode-note" id="mode-note"></p>
      </div>
    </aside>

    <main class="main" id="main"></main>

    <footer>
      Generated by <code>brand/build-boards.ts</code> from <code>docs/projects/*.md</code> —
      eight files carrying each project's frontmatter, its written explanation, and its board as
      a markdown checklist. Card moves are saved to this browser only.
      Real portfolio data: not published publicly.
    </footer>

  </div>
</div>

<script>
(function () {
  var ATTR = ${embed(THEME_ATTRIBUTE)};
  var THEME_LIST = ${themeIndex};
  var PROJECTS = ${data};
  var TOTALS = ${embed(totals)};
  var READINESS = ${embed(READINESS_LABEL)};

  var K_FAMILY = "shipshape.theme.family";
  var K_MODE = "shipshape.theme.mode";
  var K_BOARD = "shipshape.boards.v1";

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var family = read(K_FAMILY) || "harbour";
  var modePref = read(K_MODE) || "system";
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  var view = "portfolio";
  var current = PROJECTS[0].slug;

  // Restore any moved cards. Board state is per browser: this is a preview, and
  // the real board lives in Postgres.
  try {
    var saved = JSON.parse(read(K_BOARD) || "{}");
    PROJECTS.forEach(function (p) {
      var s = saved[p.slug];
      if (!s) return;
      var all = {};
      p.columns.forEach(function (c) { c.cards.forEach(function (card) { all[card.id] = card; }); });
      p.columns.forEach(function (c) { c.cards = []; });
      Object.keys(s).forEach(function (cardId) {
        var card = all[cardId];
        var col = p.columns.filter(function (c) { return c.name === s[cardId]; })[0];
        if (card && col) { col.cards.push(card); delete all[cardId]; }
      });
      // Anything the save did not mention (a card added since) goes back to its
      // original column rather than vanishing.
      Object.keys(all).forEach(function (id) {
        var origin = id.split("-").slice(1, -1).join(" ");
        var col = p.columns.filter(function (c) { return c.name.toLowerCase() === origin; })[0] || p.columns[0];
        col.cards.push(all[id]);
      });
    });
  } catch (e) {}

  function saveBoards() {
    var out = {};
    PROJECTS.forEach(function (p) {
      out[p.slug] = {};
      p.columns.forEach(function (c) {
        c.cards.forEach(function (card) { out[p.slug][card.id] = c.name; });
      });
    });
    write(K_BOARD, JSON.stringify(out));
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function project(slug) { return PROJECTS.filter(function (p) { return p.slug === slug; })[0]; }
  function readinessClass(r) { return r.replace("_", "-"); }

  // --- Theme -------------------------------------------------------------

  function resolvedMode() { return modePref === "system" ? (media.matches ? "dark" : "light") : modePref; }

  function applyTheme() {
    var inFamily = THEME_LIST.filter(function (t) { return t.family === family; });
    var mode = resolvedMode();
    var theme = inFamily.filter(function (t) { return t.mode === mode; })[0] || inFamily[0] || THEME_LIST[0];

    document.documentElement.setAttribute(ATTR, theme.id);
    document.documentElement.style.colorScheme = theme.mode;

    document.querySelectorAll("[data-family]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.family === family));
    });

    var hasDark = THEME_LIST.some(function (t) { return t.family === family && t.mode === "dark"; });
    var hasLight = THEME_LIST.some(function (t) { return t.family === family && t.mode === "light"; });
    document.querySelectorAll("[data-mode]").forEach(function (b) {
      var dead = (b.dataset.mode === "dark" && !hasDark) || (b.dataset.mode === "light" && !hasLight);
      b.disabled = dead;
      b.setAttribute("aria-pressed", String(b.dataset.mode === modePref));
    });

    var note = document.getElementById("mode-note");
    note.textContent = (!hasDark || !hasLight)
      ? "This theme is " + theme.mode + "-only by design."
      : (modePref === "system" ? "Following your system: " + resolvedMode() + "." : "");
  }

  // --- Rail --------------------------------------------------------------

  function renderRail() {
    document.getElementById("rail").innerHTML = PROJECTS.map(function (p) {
      return '<button type="button" class="rail-item" data-project="' + p.slug + '" aria-current="' +
        (view === "project" && p.slug === current) + '">' +
        '<span class="rail-top"><span class="dot" style="background:' + p.color + '"></span>' +
        '<span class="rail-name">' + esc(p.name) + '</span>' +
        '<span class="rail-score">' + p.score + '%</span></span>' +
        '<span class="rail-bar"><span class="fill-' + readinessClass(p.readiness) +
        '" style="width:' + p.score + '%"></span></span></button>';
    }).join("");

    document.querySelector('[data-view="portfolio"]').setAttribute("aria-current", String(view === "portfolio"));
  }

  // --- Views -------------------------------------------------------------

  function renderPortfolio() {
    var worst = PROJECTS.slice().sort(function (a, b) { return a.score - b.score; });

    return '<div class="head"><div><h2>Every project</h2>' +
      '<p class="summary">Eight projects, three rubrics, one standard each. Sorted worst first, because that is the order the work gets done in.</p></div></div>' +

      '<div class="stats">' +
      stat("Projects", TOTALS.projects) +
      stat("Blocking criteria", TOTALS.blocking) +
      stat("Cards", TOTALS.cards) +
      stat("Undocumented", TOTALS.undocumented) +
      '</div>' +

      (TOTALS.undocumented > 0
        ? '<div class="warn"><strong>' + TOTALS.undocumented + ' projects have no written description.</strong> ' +
          'A paused project nobody can describe is one that should be picked up or killed. ' +
          'Open them below and fill in <code>docs/projects/&lt;slug&gt;.md</code>.</div>'
        : "") +

      '<div class="grid">' + worst.map(function (p) {
        return '<button type="button" class="pcard" data-project="' + p.slug + '">' +
          '<h3><span class="dot" style="background:' + p.color + '"></span>' + esc(p.name) + '</h3>' +
          '<p class="summary">' + esc(p.summary) + '</p>' +
          '<div class="bar"><span class="fill-' + readinessClass(p.readiness) + '" style="width:' + p.score + '%"></span></div>' +
          '<div class="foot"><span class="pill pill-' + readinessClass(p.readiness) + '">' +
          (READINESS[p.readiness] || p.readiness) +
          (p.blocking ? ' <span class="n">' + p.blocking + '</span>' : "") + '</span>' +
          '<span class="rail-score">' + p.score + '%</span></div></button>';
      }).join("") + '</div>';
  }

  function stat(k, v) {
    return '<div class="panel stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  }

  function renderProject(p) {
    var context = p.sections.map(function (s) {
      return '<section class="panel"><h3>' + esc(s.heading) + '</h3>' + s.html + '</section>';
    }).join("");

    return '<div class="head">' +
      '<div><h2><span class="dot" style="background:' + p.color + '"></span>' + esc(p.name) + '</h2>' +
      '<p class="summary">' + esc(p.summary) + '</p>' +
      '<div class="meta">' +
      '<span class="pill pill-neutral">' + esc(p.status) + '</span>' +
      '<span class="pill pill-' + readinessClass(p.readiness) + '">' + (READINESS[p.readiness] || p.readiness) +
      (p.blocking ? ' <span class="n">' + p.blocking + '</span>' : "") + '</span>' +
      (p.production ? '<a class="tagline" href="' + p.production + '" target="_blank" rel="noreferrer">' + esc(p.production) + '</a>' : "") +
      '</div></div>' +
      '<div class="scoreblock"><div class="n" style="color:var(--color-' + readinessClass(p.readiness) + ')">' + p.score + '%</div>' +
      '<div class="rubric">' + esc(p.rubric) + '</div></div>' +
      '</div>' +

      (p.needsDescription
        ? '<div class="warn"><strong>This project has no description.</strong> Nobody can tell you what it is, ' +
          'which is itself the finding. Write it into <code>docs/projects/' + p.slug + '.md</code>.</div>'
        : "") +

      '<div class="panel pad"><div class="bar"><span class="fill-' + readinessClass(p.readiness) +
      '" style="width:' + p.score + '%"></span></div></div>' +

      '<details class="context-toggle" open><summary>Context</summary>' +
      '<div class="context">' + context + '</div></details>' +

      '<div class="board">' + p.columns.map(renderColumn).join("") + '</div>';
  }

  function renderColumn(col) {
    var over = col.wipLimit !== null && col.cards.length > col.wipLimit;
    var count = col.wipLimit !== null ? col.cards.length + "/" + col.wipLimit : String(col.cards.length);

    return '<section class="column' + (over ? " over" : "") + '" data-column="' + esc(col.name) + '">' +
      '<div class="col-head"><h4>' + esc(col.name) + '</h4>' +
      '<span class="count' + (over ? " over" : "") + '">' + count + '</span></div>' +
      (over ? '<p class="col-warn">Over the ' + col.wipLimit + ' card limit. Finish something before starting more.</p>' : "") +
      '<div class="col-body">' +
      (col.cards.length ? col.cards.map(function (c) { return renderCard(c, col); }).join("")
        : '<p class="col-empty">' + (col.isDone ? "Nothing finished yet." : "Nothing here.") + '</p>') +
      '</div></section>';
  }

  function renderCard(card, col) {
    var tags = "";
    if (card.criterion) tags += '<span class="tag tag-criterion">' + esc(card.criterion) + '</span>';
    if (card.required) tags += '<span class="tag tag-required">required</span>';

    return '<article class="card' + (col.isDone ? " done" : "") + '" draggable="true" tabindex="0" data-card="' + card.id + '">' +
      '<p class="card-title">' + esc(card.title) + '</p>' +
      (card.note ? '<p class="card-note">' + esc(card.note) + '</p>' : "") +
      (tags ? '<div class="tags">' + tags + '</div>' : "") +
      '<div class="move">' +
      '<button type="button" data-move="-1" aria-label="Move left">&larr;</button>' +
      '<button type="button" data-move="1" aria-label="Move right">&rarr;</button>' +
      '</div></article>';
  }

  // --- Card movement ------------------------------------------------------

  function moveCard(cardId, toColumnName) {
    var p = project(current);
    var card = null;
    p.columns.forEach(function (c) {
      var i = c.cards.findIndex(function (x) { return x.id === cardId; });
      if (i > -1) card = c.cards.splice(i, 1)[0];
    });
    if (!card) return;
    var target = p.columns.filter(function (c) { return c.name === toColumnName; })[0] || p.columns[0];
    target.cards.push(card);
    saveBoards();
    render();
  }

  function shift(cardId, direction) {
    var p = project(current);
    var from = -1;
    p.columns.forEach(function (c, i) {
      if (c.cards.some(function (x) { return x.id === cardId; })) from = i;
    });
    var to = p.columns[from + direction];
    if (to) moveCard(cardId, to.name);
  }

  // --- Wiring -------------------------------------------------------------

  function render() {
    renderRail();
    var main = document.getElementById("main");
    main.innerHTML = view === "portfolio" ? renderPortfolio() : renderProject(project(current));
    if (view === "project") wireBoard();
  }

  function wireBoard() {
    var dragged = null;

    document.querySelectorAll(".card").forEach(function (el) {
      el.addEventListener("dragstart", function (e) {
        dragged = el.dataset.card;
        e.dataTransfer.setData("text/plain", dragged);
        e.dataTransfer.effectAllowed = "move";
        el.classList.add("dragging");
      });
      el.addEventListener("dragend", function () {
        el.classList.remove("dragging");
        document.querySelectorAll(".column").forEach(function (c) { c.classList.remove("dragover"); });
      });
    });

    document.querySelectorAll(".column").forEach(function (col) {
      col.addEventListener("dragover", function (e) { e.preventDefault(); col.classList.add("dragover"); });
      col.addEventListener("dragleave", function () { col.classList.remove("dragover"); });
      col.addEventListener("drop", function (e) {
        e.preventDefault();
        col.classList.remove("dragover");
        var id = e.dataTransfer.getData("text/plain") || dragged;
        if (id) moveCard(id, col.dataset.column);
      });
    });

    // The keyboard path. A drag is not something a keyboard user can perform,
    // so these are the accessible route, not a fallback.
    document.querySelectorAll("[data-move]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        shift(b.closest(".card").dataset.card, Number(b.dataset.move));
      });
    });
  }

  document.addEventListener("click", function (e) {
    var pick = e.target.closest("[data-project]");
    if (pick) { current = pick.dataset.project; view = "project"; render(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }

    var all = e.target.closest('[data-view="portfolio"]');
    if (all) { view = "portfolio"; render(); return; }

    var fam = e.target.closest("[data-family]");
    if (fam) { family = fam.dataset.family; write(K_FAMILY, family); applyTheme(); return; }

    var mode = e.target.closest("[data-mode]");
    if (mode && !mode.disabled) { modePref = mode.dataset.mode; write(K_MODE, modePref); applyTheme(); }
  });

  media.addEventListener("change", function () { if (modePref === "system") applyTheme(); });

  applyTheme();
  render();
})();
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------

const files = (await readdir(PROJECT_DIR)).filter((f) => f.endsWith(".md")).sort();
const projects: Project[] = [];

for (const file of files) {
  const raw = await readFile(join(PROJECT_DIR, file), "utf8");
  try {
    projects.push(parseProject(file, raw));
  } catch (error) {
    console.error(`Failed to parse ${file}: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Worst first — the order the work gets done in.
projects.sort((a, b) => a.score - b.score);

const out = join(here, "boards.html");
await writeFile(out, page(projects), "utf8");

const cards = projects.reduce((n, p) => n + p.columns.reduce((m, c) => m + c.cards.length, 0), 0);
console.log(`Wrote ${out}`);
console.log(`${projects.length} projects, ${cards} cards.`);
for (const p of projects) {
  const counts = p.columns.map((c) => `${c.name} ${c.cards.length}`).join(", ");
  console.log(`  ${p.name.padEnd(19)} ${String(p.score).padStart(3)}%  ${counts}`);
}
