/**
 * Generates two things from one source:
 *
 *   packages/ui/src/themes.generated.css  — the stylesheet the app consumes
 *   brand/kanban.html                     — a standalone preview of the board
 *
 * Both come out of `packages/ui/src/themes.ts`, so the preview cannot show a
 * palette the product does not have. A preview maintained by hand is a preview
 * that lies within a fortnight.
 *
 * The demo content is illustrative on purpose — this page is publishable, and
 * the real portfolio is not (see build-public.mjs for why).
 *
 *   node brand/build-kanban.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { allThemesCss } from "../packages/ui/src/theme-css.ts";
import { DEFAULT_THEME_ID, THEMES, THEME_ATTRIBUTE, type Theme } from "../packages/ui/src/themes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// ---------------------------------------------------------------------------
// Demo content
// ---------------------------------------------------------------------------

interface DemoCard {
  title: string;
  criterion?: string;
  labels?: string[];
  required?: boolean;
  note?: string;
}

interface DemoColumn {
  name: string;
  wipLimit?: number;
  done?: boolean;
  cards: DemoCard[];
}

const BOARD: DemoColumn[] = [
  {
    name: "Backlog",
    cards: [
      {
        title: "Live payment keys in production",
        criterion: "billing.live-keys",
        labels: ["billing"],
        required: true,
      },
      {
        title: "Errors reach a human",
        criterion: "infra.error-tracking",
        labels: ["infrastructure"],
        required: true,
      },
      {
        title: "A customer can get their data deleted",
        criterion: "legal.data-deletion",
        labels: ["legal"],
        required: true,
      },
      { title: "Self-serve cancellation", criterion: "billing.cancellation", labels: ["billing"] },
    ],
  },
  {
    name: "In progress",
    wipLimit: 2,
    cards: [
      {
        title: "Ship the unsubscribe endpoint",
        criterion: "email.unsubscribe",
        labels: ["email"],
        required: true,
      },
      {
        title: "Terms of service and privacy policy",
        criterion: "legal.terms-and-privacy",
        labels: ["legal"],
        required: true,
      },
      { title: "Rate limit the login route", criterion: "sec.rate-limiting", labels: ["security"] },
    ],
  },
  {
    name: "Blocked",
    cards: [
      {
        title: "SPF, DKIM and DMARC pass",
        criterion: "email.sender-auth",
        labels: ["email"],
        required: true,
        note: "Waiting on DNS access",
      },
    ],
  },
  {
    name: "Done",
    done: true,
    cards: [
      { title: "Core flow works end to end", criterion: "product.core-flow-works" },
      { title: "Backups tested", criterion: "infra.backups" },
      { title: "Usable on a phone", criterion: "product.mobile" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function renderCard(card: DemoCard): string {
  const labels = [
    ...(card.criterion ? [`<span class="tag tag-criterion">${esc(card.criterion)}</span>`] : []),
    ...(card.labels ?? []).map((l) => `<span class="tag">${esc(l)}</span>`),
    ...(card.required ? [`<span class="tag tag-required">required</span>`] : []),
  ].join("");

  return `
            <article class="card" draggable="true" tabindex="0">
              <p class="card-title">${esc(card.title)}</p>
              ${card.note ? `<p class="card-note">${esc(card.note)}</p>` : ""}
              <div class="tags">${labels}</div>
            </article>`;
}

function renderColumn(column: DemoColumn): string {
  const over = column.wipLimit !== undefined && column.cards.length > column.wipLimit;
  const count = column.wipLimit
    ? `${column.cards.length}/${column.wipLimit}`
    : String(column.cards.length);

  return `
        <section class="column${over ? " column-over" : ""}">
          <header class="column-head">
            <h3>${esc(column.name)}</h3>
            <span class="count${over ? " count-over" : ""}">${count}</span>
          </header>
          ${
            over
              ? `<p class="column-warn">Over the ${column.wipLimit} card limit. Finish something before starting more.</p>`
              : ""
          }
          <div class="column-body">${column.cards.map(renderCard).join("")}
          </div>
        </section>`;
}

function renderFamilyButtons(): string {
  const seen = new Map<string, Theme>();
  for (const theme of THEMES) if (!seen.has(theme.family)) seen.set(theme.family, theme);

  return [...seen.values()]
    .map(
      (theme) => `
            <button type="button" class="chip" data-family="${theme.family}" aria-pressed="false" title="${esc(theme.description)}">
              <span class="chip-dot" style="background: ${theme.palette.accent}"></span>${esc(theme.name)}
            </button>`,
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function page(): string {
  const themeCss = allThemesCss(THEMES);
  const themeIndex = JSON.stringify(
    THEMES.map((t) => ({ id: t.id, family: t.family, mode: t.mode })),
  );

  return `<!doctype html>
<html lang="en" ${THEME_ATTRIBUTE}="${DEFAULT_THEME_ID}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shipshape Board</title>
<meta name="description" content="A neumorphic kanban board under a theming system where every palette is contrast-tested.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Hanken+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* ===================================================================== */
/* GENERATED by brand/build-kanban.ts from packages/ui/src/themes.ts.     */
/* Do not edit. Every value below is derived: a soft theme's two shadows  */
/* are its ground mixed toward white and black, so they stay in step when */
/* the ground moves.                                                      */
/* ===================================================================== */

${themeCss}

/* ===================================================================== */
/* Components. These reference only the contract above, never a literal   */
/* colour, which is why a new theme needs no changes down here.           */
/* ===================================================================== */

* { box-sizing: border-box; }

html { color-scheme: light; }

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

.app {
  min-height: 100vh;
  background: var(--ground);
  /* Colour and shadow move together on a theme change; without the
     transition the switch reads as a page reload rather than a setting. */
  transition: background-color 240ms ease, color 240ms ease;
}

.wrap { max-width: 1180px; margin: 0 auto; padding: 32px 24px 72px; }

h1, h2, h3 { font-family: "Fraunces", ui-serif, Georgia, serif; font-weight: 550; margin: 0; letter-spacing: -0.015em; }
p { margin: 0; }
code, .mono { font-family: "JetBrains Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }

/* --- Surfaces -------------------------------------------------------- */

.raised {
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: var(--elev-raised);
}

.well {
  background: var(--sunken);
  border-radius: var(--radius-card);
  box-shadow: var(--elev-inset);
}

/* --- Masthead -------------------------------------------------------- */

.masthead {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
}

.wordmark { font-size: 30px; letter-spacing: -0.03em; }
.lede { color: var(--ink-soft); font-size: 14px; margin-top: 2px; max-width: 56ch; }

.switcher { display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
.switch-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.switch-label {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-right: 2px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 13px;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  color: var(--ink-soft);
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--elev-raised-sm);
  transition: box-shadow 160ms ease, color 160ms ease;
}
.chip:hover { color: var(--ink); }
.chip:active { box-shadow: var(--elev-inset); }
/* Pressed is inset rather than filled: on a moulded surface, "selected"
   reads as pushed in. A filled pill would be borrowing a flat idiom. */
.chip[aria-pressed="true"] { box-shadow: var(--elev-inset); color: var(--accent); font-weight: 500; }
.chip[disabled] { opacity: 0.4; cursor: not-allowed; }

.chip-dot { width: 9px; height: 9px; border-radius: 999px; box-shadow: var(--elev-raised-sm); }

.mode-note { font-size: 12px; color: var(--ink-faint); }

/* --- Score card ------------------------------------------------------ */

.summary { display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; margin-bottom: 26px; }
@media (max-width: 800px) { .summary { grid-template-columns: 1fr; } }

.panel { padding: 20px; }

.summary-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.project { font-size: 17px; }
.rubric-name { font-size: 12px; color: var(--ink-faint); margin-top: 1px; }
.score { font-family: "Fraunces", serif; font-size: 34px; font-weight: 550; line-height: 1; color: var(--color-blocked); }

.bar { height: 8px; border-radius: 999px; background: var(--sunken); box-shadow: var(--elev-inset); overflow: hidden; margin: 14px 0 12px; }
.bar > span { display: block; height: 100%; border-radius: 999px; }

.pill {
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: var(--radius-pill);
  padding: 4px 11px; font-size: 12px; font-weight: 500;
}
.pill .n { font-family: "JetBrains Mono", monospace; font-size: 11px; opacity: 0.85; }

.pill-blocked { background: var(--color-blocked-soft); color: var(--color-blocked); }
.pill-at-risk { background: var(--color-at-risk-soft); color: var(--color-at-risk); }
.pill-on-track { background: var(--color-on-track-soft); color: var(--color-on-track); }
.pill-ready { background: var(--color-ready-soft); color: var(--color-ready); }
.pill-waived { background: var(--color-waived-soft); color: var(--color-waived); }

.fill-blocked { background: var(--color-blocked); }
.fill-at-risk { background: var(--color-at-risk); }
.fill-on-track { background: var(--color-on-track); }
.fill-ready { background: var(--color-ready); }

.blockers { margin-top: 14px; font-size: 13px; color: var(--color-blocked); }

.sections { display: flex; flex-direction: column; gap: 9px; }
.section-row { display: flex; align-items: center; gap: 12px; font-size: 13px; }
.section-row .name { width: 108px; flex: none; color: var(--ink-soft); }
.section-row .bar { flex: 1; margin: 0; height: 6px; }
.section-row .pct { width: 38px; text-align: right; font-family: "JetBrains Mono", monospace; font-size: 12px; color: var(--ink-faint); }

/* --- Board ----------------------------------------------------------- */

.board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
@media (max-width: 1000px) { .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .board { grid-template-columns: 1fr; } }

.column {
  background: var(--sunken);
  border-radius: var(--radius-card);
  box-shadow: var(--elev-inset);
  padding: 6px;
}
.column-over { box-shadow: var(--elev-inset), 0 0 0 1.5px var(--color-at-risk); }

.column-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 10px 12px 8px; }
.column-head h3 { font-size: 14px; }
.count { font-family: "JetBrains Mono", monospace; font-size: 11px; color: var(--ink-faint); }
.count-over { color: var(--color-at-risk); font-weight: 500; }

.column-warn { margin: 0 8px 8px; padding: 7px 10px; font-size: 12px; line-height: 1.4; color: var(--color-at-risk); background: var(--color-at-risk-soft); border-radius: var(--radius-control); }

.column-body { display: flex; flex-direction: column; gap: 10px; padding: 4px 6px 8px; min-height: 60px; }

.card {
  background: var(--surface);
  border-radius: var(--radius-control);
  box-shadow: var(--elev-raised-sm);
  padding: 12px;
  cursor: grab;
  transition: box-shadow 180ms ease, transform 180ms ease;
}
.card:hover { box-shadow: var(--elev-raised); transform: translateY(-1px); }
.card:active { cursor: grabbing; box-shadow: var(--elev-inset); transform: none; }

.card-title { font-size: 13.5px; font-weight: 500; line-height: 1.35; }
.card-note { font-size: 12px; color: var(--color-blocked); margin-top: 4px; }

.tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }
.tag { font-size: 10px; padding: 2px 7px; border-radius: 999px; background: var(--sunken); color: var(--ink-faint); box-shadow: var(--elev-inset); }
.tag-criterion { font-family: "JetBrains Mono", monospace; background: var(--accent-soft); color: var(--accent); box-shadow: none; }
.tag-required { background: var(--color-blocked-soft); color: var(--color-blocked); box-shadow: none; }

/* --- Component strip -------------------------------------------------- */

.strip { margin-top: 34px; }
.strip h2 { font-size: 17px; margin-bottom: 4px; }
.strip .lede { margin-bottom: 16px; }

.specimens { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; }
.specimen { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.specimen h3 { font-size: 13px; color: var(--ink-soft); font-family: inherit; font-weight: 600; }
.specimen-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }

.btn {
  font: inherit; font-size: 13px; border: 0; cursor: pointer;
  padding: 8px 15px; border-radius: var(--radius-control);
  background: var(--surface); color: var(--ink);
  box-shadow: var(--elev-raised-sm);
  transition: box-shadow 150ms ease;
}
.btn:active { box-shadow: var(--elev-inset); }
.btn-accent { background: var(--accent); color: var(--on-accent); }
.btn-accent:hover { background: var(--accent-hover); }

.field {
  width: 100%; font: inherit; font-size: 13px;
  padding: 9px 12px; border: 0; border-radius: var(--radius-control);
  background: var(--sunken); color: var(--ink);
  box-shadow: var(--elev-inset);
}
.field::placeholder { color: var(--ink-faint); }

footer { margin-top: 40px; font-size: 12.5px; color: var(--ink-faint); line-height: 1.6; max-width: 78ch; }
footer code { font-size: 11.5px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
</style>
</head>
<body>
<div class="app">
  <div class="wrap">

    <header class="masthead">
      <div>
        <h1 class="wordmark">Shipshape</h1>
        <p class="lede">
          One board, seven themes, one contract. Every palette below is checked against
          WCAG AA in the test suite — including the tint behind each status pill.
        </p>
      </div>

      <div class="switcher">
        <div class="switch-row">
          <span class="switch-label">Theme</span>${renderFamilyButtons()}
        </div>
        <div class="switch-row">
          <span class="switch-label">Mode</span>
          <button type="button" class="chip" data-mode="light" aria-pressed="false">Light</button>
          <button type="button" class="chip" data-mode="dark" aria-pressed="false">Dark</button>
          <button type="button" class="chip" data-mode="system" aria-pressed="true">System</button>
        </div>
        <p class="mode-note" id="mode-note"></p>
      </div>
    </header>

    <div class="summary">
      <div class="raised panel">
        <div class="summary-top">
          <div>
            <h2 class="project">Atlas</h2>
            <p class="rubric-name">Launch readiness &middot; v1 &middot; pass at 85%</p>
          </div>
          <span class="score">93%</span>
        </div>
        <div class="bar"><span class="fill-blocked" style="width: 93%"></span></div>
        <div class="switch-row">
          <span class="pill pill-blocked">Blocked <span class="n">1</span></span>
          <span class="pill pill-waived">1 waived</span>
        </div>
        <p class="blockers">
          Terms of service and privacy policy is required and still in progress. The score
          does not matter until it is settled.
        </p>
      </div>

      <div class="raised panel">
        <h2 class="project" style="font-size: 15px; margin-bottom: 14px;">By section</h2>
        <div class="sections">
          <div class="section-row"><span class="name">Product</span><div class="bar"><span class="fill-ready" style="width:100%"></span></div><span class="pct">100%</span></div>
          <div class="section-row"><span class="name">Billing</span><div class="bar"><span class="fill-ready" style="width:100%"></span></div><span class="pct">100%</span></div>
          <div class="section-row"><span class="name">Legal</span><div class="bar"><span class="fill-at-risk" style="width:66%"></span></div><span class="pct">66%</span></div>
          <div class="section-row"><span class="name">Email</span><div class="bar"><span class="fill-on-track" style="width:78%"></span></div><span class="pct">78%</span></div>
          <div class="section-row"><span class="name">Infrastructure</span><div class="bar"><span class="fill-ready" style="width:92%"></span></div><span class="pct">92%</span></div>
        </div>
      </div>
    </div>

    <div class="board">${BOARD.map(renderColumn).join("")}
    </div>

    <section class="strip">
      <h2>Controls</h2>
      <p class="lede">
        Raised is the resting state; pressed is inset. On a moulded surface &ldquo;selected&rdquo;
        reads as pushed in, so nothing here fills with colour to show state.
      </p>
      <div class="specimens">
        <div class="raised specimen">
          <h3>Buttons</h3>
          <div class="specimen-row">
            <button type="button" class="btn">Secondary</button>
            <button type="button" class="btn btn-accent">Apply rubric</button>
          </div>
        </div>
        <div class="raised specimen">
          <h3>Input</h3>
          <input class="field" placeholder="Search criteria…" aria-label="Search criteria">
        </div>
        <div class="raised specimen">
          <h3>Readiness</h3>
          <div class="specimen-row">
            <span class="pill pill-blocked">Blocked</span>
            <span class="pill pill-at-risk">At risk</span>
            <span class="pill pill-on-track">On track</span>
            <span class="pill pill-ready">Ready</span>
          </div>
        </div>
        <div class="raised specimen">
          <h3>Progress</h3>
          <div class="bar" style="margin:0"><span class="fill-blocked" style="width:93%"></span></div>
          <div class="bar" style="margin:0"><span class="fill-at-risk" style="width:46%"></span></div>
          <div class="bar" style="margin:0"><span class="fill-ready" style="width:100%"></span></div>
        </div>
      </div>
    </section>

    <footer>
      Generated from <code>packages/ui/src/themes.ts</code> by <code>brand/build-kanban.ts</code>.
      A theme carries an elevation model as well as a palette, so components ask for
      <code>var(--elev-raised)</code> and the theme decides whether that is a pair of opposed
      shadows or a hairline ring — which is why Chart &amp; Rule, the original flat identity,
      is still one of the seven rather than something that had to be thrown away.
      Illustrative data.
    </footer>

  </div>
</div>

<script>
(function () {
  var ATTR = ${JSON.stringify(THEME_ATTRIBUTE)};
  var THEMES = ${themeIndex};
  var KEY_FAMILY = "shipshape.theme.family";
  var KEY_MODE = "shipshape.theme.mode";

  var family = read(KEY_FAMILY) || ${JSON.stringify(THEMES.find((t) => t.id === DEFAULT_THEME_ID)!.family)};
  var modePref = read(KEY_MODE) || "system";
  var media = window.matchMedia("(prefers-color-scheme: dark)");

  // Storage throws in a private window or with site data blocked. A theme
  // preference is never worth taking the page down for.
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function resolvedMode() {
    return modePref === "system" ? (media.matches ? "dark" : "light") : modePref;
  }

  function pick() {
    var inFamily = THEMES.filter(function (t) { return t.family === family; });
    var mode = resolvedMode();
    return inFamily.filter(function (t) { return t.mode === mode; })[0] || inFamily[0] || THEMES[0];
  }

  function apply() {
    var theme = pick();
    document.documentElement.setAttribute(ATTR, theme.id);
    document.documentElement.style.colorScheme = theme.mode;

    document.querySelectorAll("[data-family]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.family === family));
    });
    document.querySelectorAll("[data-mode]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.mode === modePref));
    });

    // A family with only one mode must say so and disable the toggle, rather
    // than leaving a dead control the viewer assumes is broken.
    var hasDark = THEMES.some(function (t) { return t.family === family && t.mode === "dark"; });
    var hasLight = THEMES.some(function (t) { return t.family === family && t.mode === "light"; });

    document.querySelectorAll("[data-mode]").forEach(function (b) {
      var unavailable =
        (b.dataset.mode === "dark" && !hasDark) || (b.dataset.mode === "light" && !hasLight);
      b.disabled = unavailable;
      b.title = unavailable ? "Not available in this theme" : "";
    });

    var note = document.getElementById("mode-note");
    if (!hasDark || !hasLight) {
      note.textContent = "This theme is " + theme.mode + "-only by design.";
    } else if (modePref === "system") {
      note.textContent = "Following your system: " + resolvedMode() + ".";
    } else {
      note.textContent = "";
    }
  }

  document.querySelectorAll("[data-family]").forEach(function (b) {
    b.addEventListener("click", function () { family = b.dataset.family; write(KEY_FAMILY, family); apply(); });
  });
  document.querySelectorAll("[data-mode]").forEach(function (b) {
    b.addEventListener("click", function () { modePref = b.dataset.mode; write(KEY_MODE, modePref); apply(); });
  });
  media.addEventListener("change", function () { if (modePref === "system") apply(); });

  apply();
})();
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------

const cssOut = join(root, "packages", "ui", "src", "themes.generated.css");
const htmlOut = join(here, "kanban.html");

await mkdir(dirname(cssOut), { recursive: true });
await writeFile(
  cssOut,
  `/*\n * GENERATED by brand/build-kanban.ts from src/themes.ts. Do not edit.\n *\n * Regenerate with:  node brand/build-kanban.ts\n */\n\n${allThemesCss(THEMES)}\n`,
  "utf8",
);
await writeFile(htmlOut, page(), "utf8");

console.log(`Wrote ${cssOut}`);
console.log(`Wrote ${htmlOut}`);
console.log(`${THEMES.length} themes, ${BOARD.reduce((n, c) => n + c.cards.length, 0)} cards.`);
