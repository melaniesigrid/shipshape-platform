/**
 * The theme contract, and every theme that satisfies it.
 *
 * One contract, several identities. A theme carries an **elevation model** as
 * well as a palette, so switching theme changes how a surface is constructed —
 * a hairline ring in a flat theme, a pair of opposed shadows in a soft one —
 * without a single component knowing which it is in. Components ask for
 * `var(--elev-raised)`; the theme decides what that means.
 *
 * That is the difference between a theming system and a set of colour variables.
 * Adding a fourth identity later is a new entry in `THEMES`, not a pass through
 * every stylesheet.
 *
 * Every value here is measured, not eyeballed — see `test/themes.test.ts`, which
 * fails the build if any text pair drops below WCAG AA. Soft themes need that
 * check most: low-contrast surfaces are the method, and unreadable text is the
 * failure mode one step beyond it.
 */

import { mix } from "./color.ts";

export type ThemeMode = "light" | "dark";

/**
 * How a surface separates from its ground.
 *
 * - `flat` — a hairline ring and a faint drop shadow. Reads as paper.
 * - `soft` — opposed light and dark shadows, the surface sharing the ground's
 *   colour. Reads as one moulded sheet. This only works when surface and ground
 *   are the same colour, which is why `surface` equals `ground` in every soft
 *   theme and why a soft theme cannot borrow a flat theme's palette.
 */
export type ElevationStyle = "flat" | "soft";

export interface ThemePalette {
  /** The page ground. */
  ground: string;
  /** Raised surfaces. Equal to `ground` in soft themes — see `ElevationStyle`. */
  surface: string;
  /** Recessed wells: board columns, progress tracks, inputs. */
  sunken: string;

  ink: string;
  /** Secondary prose. Held to AA against ground and surface. */
  inkSoft: string;
  /** Tertiary labels and metadata. Also held to AA — "faint" is not a licence. */
  inkFaint: string;
  /** Hairlines and dividers. */
  line: string;

  accent: string;
  /** What sits on top of a filled accent surface. */
  onAccent: string;

  // Readiness. Reserved: these never carry brand duty in any theme.
  blocked: string;
  atRisk: string;
  onTrack: string;
  ready: string;
  waived: string;
}

export interface Theme {
  id: string;
  /** Groups the light and dark variants of one identity. */
  family: string;
  name: string;
  description: string;
  mode: ThemeMode;
  elevation: ElevationStyle;
  palette: ThemePalette;
}

/**
 * The attribute the stylesheet keys on.
 *
 * Namespaced rather than a bare `data-theme` because host pages use that name
 * for their own light/dark switch — an embedded preview would end up fighting
 * its host for the same attribute, and whichever wrote last would win.
 */
export const THEME_ATTRIBUTE = "data-shipshape-theme";

/** Alpha used for every `-soft` tint (pill and chip backgrounds). */
export const SOFT_TINT = 0.14;

/**
 * The background a `-soft` tint actually composites to.
 *
 * Contrast has to be measured against what renders, not against the ground the
 * pill happens to sit on — a chip's text sits on ground-plus-14%-of-itself.
 */
export function softTintOver(color: string, ground: string, amount = SOFT_TINT): string {
  return mix(ground, color, amount);
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

/**
 * Chart & Rule — the original flat identity. Kept as a first-class theme rather
 * than replaced: it is the one that reads like a document, and the soft themes
 * are a different argument, not a correction.
 */
const CHART_AND_RULE: Theme = {
  id: "chart-rule",
  family: "chart-rule",
  name: "Chart & Rule",
  description: "Warm chart paper and hairline rules. Reads like a survey document.",
  mode: "light",
  elevation: "flat",
  palette: {
    ground: "#f6f4ef",
    surface: "#fffdf9",
    sunken: "#eceae3",
    ink: "#14211e",
    inkSoft: "#47544f",
    inkFaint: "#626c68",
    line: "#d5d2ca",
    accent: "#2b6559",
    onAccent: "#fffdf9",
    blocked: "#a83f2a",
    atRisk: "#7d5410",
    onTrack: "#2b627f",
    ready: "#2a6f47",
    waived: "#5f5280",
  },
};

/**
 * Harbour — cool blue-grey, the calm of overcast water. The default soft theme:
 * the least saturated of the three, so it stays quiet under a full board.
 */
const HARBOUR_LIGHT: Theme = {
  id: "harbour-light",
  family: "harbour",
  name: "Harbour",
  description: "Cool blue-grey. Soft moulded surfaces on overcast water.",
  mode: "light",
  elevation: "soft",
  palette: {
    ground: "#e3e9f0",
    surface: "#e3e9f0",
    sunken: "#d7dee7",
    ink: "#16202b",
    inkSoft: "#3f4c5b",
    inkFaint: "#556374",
    line: "#c5cfdb",
    accent: "#356484",
    onAccent: "#ffffff",
    blocked: "#9e3b25",
    atRisk: "#7a530c",
    onTrack: "#2b5f7d",
    ready: "#286744",
    waived: "#584a7c",
  },
};

const HARBOUR_DARK: Theme = {
  id: "harbour-dark",
  family: "harbour",
  name: "Harbour",
  description: "Cool blue-grey after dark. The same moulding, lit from above.",
  mode: "dark",
  elevation: "soft",
  palette: {
    ground: "#232b35",
    surface: "#232b35",
    sunken: "#1c232b",
    ink: "#e8edf3",
    inkSoft: "#b7c2cf",
    inkFaint: "#95a3b3",
    line: "#333d4a",
    accent: "#89b1d4",
    onAccent: "#141d27",
    blocked: "#e98a71",
    atRisk: "#d8a64c",
    onTrack: "#82b2d6",
    ready: "#79c497",
    waived: "#b0a2d8",
  },
};

/** Sage — muted green-grey. The warmest of the soft set without going beige. */
const SAGE_LIGHT: Theme = {
  id: "sage-light",
  family: "sage",
  name: "Sage",
  description: "Muted green-grey. Quiet, botanical, low saturation.",
  mode: "light",
  elevation: "soft",
  palette: {
    ground: "#e7ebe4",
    surface: "#e7ebe4",
    sunken: "#dbe0d7",
    ink: "#1b241d",
    inkSoft: "#414d43",
    inkFaint: "#586457",
    line: "#c9d1c5",
    accent: "#3f6249",
    onAccent: "#ffffff",
    blocked: "#9f3b26",
    atRisk: "#78520c",
    onTrack: "#2b5f7d",
    ready: "#296845",
    waived: "#584a7c",
  },
};

const SAGE_DARK: Theme = {
  id: "sage-dark",
  family: "sage",
  name: "Sage",
  description: "Muted green-grey after dark. Moss under a low lamp.",
  mode: "dark",
  elevation: "soft",
  palette: {
    ground: "#242a25",
    surface: "#242a25",
    sunken: "#1d221e",
    ink: "#e9eee7",
    inkSoft: "#b8c2b8",
    inkFaint: "#96a296",
    line: "#343b35",
    accent: "#93b89b",
    onAccent: "#161f19",
    blocked: "#e98a71",
    atRisk: "#d8a64c",
    onTrack: "#82b2d6",
    ready: "#7cc79b",
    waived: "#b0a2d8",
  },
};

/** Dusk — soft lavender-grey. The most distinctive, and the least neutral. */
const DUSK_LIGHT: Theme = {
  id: "dusk-light",
  family: "dusk",
  name: "Dusk",
  description: "Soft lavender-grey. Cool light half an hour after sunset.",
  mode: "light",
  elevation: "soft",
  palette: {
    ground: "#ebe8ef",
    surface: "#ebe8ef",
    sunken: "#e0dce6",
    ink: "#211b28",
    inkSoft: "#4a4356",
    inkFaint: "#5f576c",
    line: "#d0cad9",
    accent: "#544878",
    onAccent: "#ffffff",
    blocked: "#9f3b26",
    atRisk: "#78520c",
    onTrack: "#2b5f7d",
    ready: "#296845",
    waived: "#584a7c",
  },
};

const DUSK_DARK: Theme = {
  id: "dusk-dark",
  family: "dusk",
  name: "Dusk",
  description: "Soft lavender-grey after dark. Deep, cool, unhurried.",
  mode: "dark",
  elevation: "soft",
  palette: {
    ground: "#2a2632",
    surface: "#2a2632",
    sunken: "#221f29",
    ink: "#ede9f2",
    inkSoft: "#beb7c9",
    inkFaint: "#9d94aa",
    line: "#3b3546",
    accent: "#af9fd8",
    onAccent: "#1c1724",
    blocked: "#e98a71",
    atRisk: "#d8a64c",
    onTrack: "#82b2d6",
    ready: "#7cc79b",
    waived: "#c4b8e4",
  },
};

export const THEMES: readonly Theme[] = [
  CHART_AND_RULE,
  HARBOUR_LIGHT,
  HARBOUR_DARK,
  SAGE_LIGHT,
  SAGE_DARK,
  DUSK_LIGHT,
  DUSK_DARK,
];

/** The theme a first-time visitor gets, before any stored preference. */
export const DEFAULT_THEME_ID = "harbour-light";

export const THEME_FAMILIES: readonly string[] = [
  ...new Set(THEMES.map((theme) => theme.family)),
];

export function getTheme(id: string): Theme | undefined {
  return THEMES.find((theme) => theme.id === id);
}

/**
 * The theme for a family in a given mode, falling back to the family's only
 * variant. Chart & Rule ships light-only on purpose, so asking it for dark
 * returns its light theme rather than nothing.
 */
export function resolveTheme(family: string, mode: ThemeMode): Theme {
  const inFamily = THEMES.filter((theme) => theme.family === family);
  return (
    inFamily.find((theme) => theme.mode === mode) ??
    inFamily[0] ??
    getTheme(DEFAULT_THEME_ID)!
  );
}

/** Whether a family offers both modes. Drives whether the mode toggle is shown. */
export function familyHasMode(family: string, mode: ThemeMode): boolean {
  return THEMES.some((theme) => theme.family === family && theme.mode === mode);
}
