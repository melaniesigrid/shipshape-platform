/**
 * Turns a `Theme` into CSS custom properties.
 *
 * Every derived value is computed here and nowhere else. A neumorphic surface's
 * two shadows are its ground mixed toward white and black, not a hand-picked
 * pair — pick them by hand and they drift out of step the first time the ground
 * is nudged, and the extrusion stops reading.
 *
 * The output is the whole contract a component may rely on. If a value is not
 * emitted here, no stylesheet may reference it.
 */

import { alpha, darken, lighten } from "./color.ts";
import { SOFT_TINT, THEME_ATTRIBUTE, type Theme } from "./themes.ts";

/**
 * How far the shadow colours travel from the ground.
 *
 * Light and dark modes are not symmetrical, and treating them as if they were
 * is the usual reason a dark neumorphic theme looks like flat mud: on a dark
 * ground the highlight has very little room above it, while the shadow has
 * plenty below, so the pair has to be biased.
 */
const SHADOW_TRAVEL = {
  light: { highlight: 0.75, shadow: 0.17 },
  dark: { highlight: 0.1, shadow: 0.42 },
} as const;

/** Corner radius per elevation style. Soft surfaces need room for the falloff. */
const RADIUS = {
  flat: { card: "6px", control: "6px" },
  soft: { card: "16px", control: "12px" },
} as const;

export interface ElevationTokens {
  raised: string;
  raisedSm: string;
  /** Hover/lifted. */
  raisedLg: string;
  /** Wells, tracks, inputs, and the pressed state of a button. */
  inset: string;
  /** Neither raised nor inset — flush with the ground. */
  flush: string;
}

/**
 * The elevation contract. Both styles answer the same five names, which is what
 * lets a component say `box-shadow: var(--elev-raised)` and stay correct in a
 * theme it has never heard of.
 */
export function elevationTokens(theme: Theme): ElevationTokens {
  const { ground } = theme.palette;

  if (theme.elevation === "flat") {
    const ring = alpha(theme.palette.line, 1);
    const cast = theme.mode === "light" ? alpha("#14211e", 0.06) : alpha("#000000", 0.4);
    return {
      raised: `0 0 0 1px ${ring}, 0 1px 2px ${cast}, 0 8px 24px ${cast}`,
      raisedSm: `0 0 0 1px ${ring}`,
      raisedLg: `0 0 0 1px ${ring}, 0 2px 4px ${cast}, 0 16px 40px ${cast}`,
      inset: `inset 0 1px 2px ${cast}`,
      flush: "none",
    };
  }

  const travel = SHADOW_TRAVEL[theme.mode];
  const hi = lighten(ground, travel.highlight);
  const lo = darken(ground, travel.shadow);

  return {
    raised: `6px 6px 14px ${lo}, -6px -6px 14px ${hi}`,
    raisedSm: `3px 3px 7px ${lo}, -3px -3px 7px ${hi}`,
    raisedLg: `10px 10px 24px ${lo}, -10px -10px 24px ${hi}`,
    inset: `inset 4px 4px 9px ${lo}, inset -4px -4px 9px ${hi}`,
    flush: "none",
  };
}

/**
 * Every custom property a theme defines.
 *
 * Type is deliberately absent: the three faces are constant across themes. The
 * voice stays the same while the material changes, which is what keeps seven
 * themes reading as one product rather than seven.
 */
export function themeVariables(theme: Theme): Record<string, string> {
  const p = theme.palette;
  const elevation = elevationTokens(theme);
  const radius = RADIUS[theme.elevation];

  const signal = (name: string, value: string) => ({
    [`--color-${name}`]: value,
    // The tint a chip or pill sits on. Contrast is measured against the
    // composite of this over the ground, not against the ground alone.
    [`--color-${name}-soft`]: alpha(value, SOFT_TINT),
  });

  return {
    "--ground": p.ground,
    "--surface": p.surface,
    "--sunken": p.sunken,

    "--ink": p.ink,
    "--ink-soft": p.inkSoft,
    "--ink-faint": p.inkFaint,
    "--line": p.line,
    "--line-strong": theme.mode === "light" ? darken(p.line, 0.12) : lighten(p.line, 0.12),

    "--accent": p.accent,
    "--on-accent": p.onAccent,
    "--accent-soft": alpha(p.accent, SOFT_TINT),
    "--accent-hover": theme.mode === "light" ? darken(p.accent, 0.12) : lighten(p.accent, 0.12),

    ...signal("blocked", p.blocked),
    ...signal("at-risk", p.atRisk),
    ...signal("on-track", p.onTrack),
    ...signal("ready", p.ready),
    ...signal("waived", p.waived),

    "--elev-raised": elevation.raised,
    "--elev-raised-sm": elevation.raisedSm,
    "--elev-raised-lg": elevation.raisedLg,
    "--elev-inset": elevation.inset,
    "--elev-flush": elevation.flush,

    "--radius-card": radius.card,
    "--radius-control": radius.control,
    "--radius-pill": "999px",

    // Read by components that must adapt structurally rather than just
    // recolour — the board's column wells are inset in a soft theme and
    // outlined in a flat one.
    "--elevation-style": theme.elevation,
    "--color-scheme": theme.mode,
  };
}

/** One theme as a CSS rule. */
export function themeCss(theme: Theme, selector: string): string {
  const declarations = Object.entries(themeVariables(theme))
    .map(([property, value]) => `  ${property}: ${value};`)
    .join("\n");
  return `${selector} {\n  color-scheme: ${theme.mode};\n${declarations}\n}`;
}

/**
 * The full stylesheet: every theme, addressed by `[data-shipshape-theme]`.
 *
 * A single flat list rather than nested media queries. Which theme applies is
 * decided once, in one place, by the resolver in `theme-provider` — a stylesheet
 * that also tries to decide gives you two sources of truth that disagree the
 * moment a user picks something their OS did not.
 */
export function allThemesCss(themes: readonly Theme[]): string {
  return themes
    .map((theme) => themeCss(theme, `[${THEME_ATTRIBUTE}="${theme.id}"]`))
    .join("\n\n");
}
