/**
 * Colour maths for the theming system.
 *
 * Exists so contrast is something the build checks rather than something a
 * designer squints at. Neumorphism's whole method is low-contrast surfaces, and
 * the failure mode is text that looks fine to the person who chose the palette
 * and is unreadable to everyone else — so every theme is measured, and a theme
 * that fails is a failing test rather than a support email.
 *
 * Pure functions, no dependencies, so `node --test` runs them with no install.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse `#rgb` or `#rrggbb`. Throws on anything else — a typo'd token should not silently render black. */
export function hexToRgb(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, "");

  if (value.length === 3) {
    const [r, g, b] = [...value].map((c) => Number.parseInt(c + c, 16));
    if ([r, g, b].some((n) => Number.isNaN(n))) throw new Error(`Not a hex colour: ${hex}`);
    return { r: r!, g: g!, b: b! };
  }

  if (value.length === 6) {
    const n = Number.parseInt(value, 16);
    if (Number.isNaN(n)) throw new Error(`Not a hex colour: ${hex}`);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  throw new Error(`Not a hex colour: ${hex}`);
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, "0")}`;
}

/** `rgba()` string at the given alpha. Used for the `-soft` tints behind pills and chips. */
export function alpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
}

/**
 * Mix two colours by weight. `t` of 0 returns `from`, 1 returns `to`.
 *
 * Neumorphic shadows are derived rather than hand-picked: the light and dark
 * shadow of a surface are that surface mixed toward white and black. Hand-picked
 * pairs drift out of step the moment the ground is adjusted.
 */
export function mix(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

export const lighten = (hex: string, t: number): string => mix(hex, "#ffffff", t);
export const darken = (hex: string, t: number): string => mix(hex, "#000000", t);

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 to 21. Order of arguments does not matter. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.1 thresholds. Large text is 18.66px bold or 24px regular. */
export const AA_BODY = 4.5;
export const AA_LARGE = 3;
/** Non-text: UI component boundaries, focus rings, chart marks. */
export const AA_NON_TEXT = 3;

export function meetsAA(foreground: string, background: string, threshold = AA_BODY): boolean {
  return contrast(foreground, background) >= threshold;
}

/**
 * Nudge `foreground` toward black or white until it clears `threshold` against
 * `background`, keeping its hue.
 *
 * A repair tool for authoring, not a runtime crutch — themes ship with values
 * that already pass. Returns the original when it cannot get there in range,
 * so the caller's test still fails loudly rather than receiving mud.
 */
export function ensureContrast(
  foreground: string,
  background: string,
  threshold = AA_BODY,
): string {
  if (contrast(foreground, background) >= threshold) return foreground;

  // Darken against a light ground, lighten against a dark one.
  const towardBlack = luminance(background) > 0.5;
  let best = foreground;

  for (let step = 1; step <= 20; step += 1) {
    const t = step / 20;
    const candidate = towardBlack ? darken(foreground, t) : lighten(foreground, t);
    best = candidate;
    if (contrast(candidate, background) >= threshold) return candidate;
  }

  return best;
}

// ---------------------------------------------------------------------------
// Perceptual distance
// ---------------------------------------------------------------------------

/**
 * CIE L*a*b*, D65.
 *
 * Needed because WCAG contrast measures *lightness* only. Two colours can be
 * obviously different hues and still score 1.1:1 against each other — which is
 * exactly what a red and an amber of equal lightness do. Asking "can these be
 * told apart" needs a perceptual metric, not a contrast ratio.
 */
export function toLab(hex: string): { L: number; a: number; b: number } {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];

  // sRGB to XYZ, then normalised against the D65 white point.
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;

  const d = 6 / 29;
  const f = (t: number) => (t > d ** 3 ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29);

  return { L: 116 * f(Y) - 16, a: 500 * (f(X) - f(Y)), b: 200 * (f(Y) - f(Z)) };
}

/**
 * CIE76 colour difference. Roughly: under 2.3 is imperceptible, around 10 is a
 * clear difference, 20+ is unmistakably a different colour.
 *
 * CIE76 rather than CIEDE2000 on purpose — it is a handful of lines instead of
 * fifty, and the question here is "obviously different or not", which does not
 * need the newer formula's accuracy near the just-noticeable threshold.
 */
export function deltaE(a: string, b: string): number {
  const x = toLab(a);
  const y = toLab(b);
  return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b);
}

/** Two colours a viewer can tell apart at a glance. */
export const DISTINCT = 20;
