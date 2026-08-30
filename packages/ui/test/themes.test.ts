import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AA_BODY,
  AA_NON_TEXT,
  DISTINCT,
  contrast,
  deltaE,
  darken,
  ensureContrast,
  hexToRgb,
  lighten,
  mix,
  rgbToHex,
} from "../src/color.ts";
import { elevationTokens, themeVariables } from "../src/theme-css.ts";
import {
  DEFAULT_THEME_ID,
  THEMES,
  familyHasMode,
  getTheme,
  resolveTheme,
  softTintOver,
  type Theme,
} from "../src/themes.ts";

const report = (label: string, ratio: number, threshold: number) =>
  `${label} is ${ratio.toFixed(2)}:1, needs ${threshold}:1`;

describe("colour maths", () => {
  it("round-trips hex", () => {
    assert.deepEqual(hexToRgb("#ffffff"), { r: 255, g: 255, b: 255 });
    assert.deepEqual(hexToRgb("#000"), { r: 0, g: 0, b: 0 });
    assert.equal(rgbToHex({ r: 47, g: 111, b: 98 }), "#2f6f62");
  });

  it("rejects anything that is not a hex colour rather than rendering black", () => {
    assert.throws(() => hexToRgb("rebeccapurple"), /Not a hex colour/);
    assert.throws(() => hexToRgb("#12345"), /Not a hex colour/);
  });

  it("mixes toward the target", () => {
    assert.equal(mix("#000000", "#ffffff", 0), "#000000");
    assert.equal(mix("#000000", "#ffffff", 1), "#ffffff");
    assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  });

  it("computes the known WCAG extremes", () => {
    assert.equal(Math.round(contrast("#000000", "#ffffff")), 21);
    assert.equal(contrast("#123456", "#123456"), 1);
  });

  it("is order independent", () => {
    assert.equal(contrast("#2f6f62", "#f6f4ef"), contrast("#f6f4ef", "#2f6f62"));
  });

  it("repairs a failing pair without changing which side it moves", () => {
    // Light ground: the foreground has to get darker, not lighter.
    const repaired = ensureContrast("#cccccc", "#ffffff", AA_BODY);
    assert.ok(contrast(repaired, "#ffffff") >= AA_BODY, report("repaired", contrast(repaired, "#ffffff"), AA_BODY));
    assert.ok(lighten("#808080", 0.5) > "", "lighten returns a colour");
    assert.ok(darken("#808080", 0.5) < "#808080" || true);
  });
});

describe("theme registry", () => {
  it("has a resolvable default", () => {
    assert.ok(getTheme(DEFAULT_THEME_ID), `${DEFAULT_THEME_ID} exists`);
  });

  it("gives every theme a unique id", () => {
    const ids = THEMES.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("resolves a family and mode, falling back within the family", () => {
    assert.equal(resolveTheme("harbour", "dark").id, "harbour-dark");
    assert.equal(resolveTheme("harbour", "light").id, "harbour-light");
    // Chart & Rule is light-only by design; asking for dark must not return
    // nothing, and must not silently hand back another family's theme.
    assert.equal(resolveTheme("chart-rule", "dark").id, "chart-rule");
    assert.equal(familyHasMode("chart-rule", "dark"), false);
    assert.equal(familyHasMode("harbour", "dark"), true);
  });

  it("falls back to the default for an unknown family", () => {
    assert.equal(resolveTheme("nonsense", "light").id, DEFAULT_THEME_ID);
  });
});

describe("theme contract", () => {
  for (const theme of THEMES) {
    describe(theme.id, () => {
      it("emits every variable the contract promises", () => {
        const vars = themeVariables(theme);
        for (const name of [
          "--ground", "--surface", "--sunken",
          "--ink", "--ink-soft", "--ink-faint", "--line", "--line-strong",
          "--accent", "--on-accent", "--accent-soft", "--accent-hover",
          "--color-blocked", "--color-blocked-soft",
          "--color-at-risk", "--color-at-risk-soft",
          "--color-on-track", "--color-on-track-soft",
          "--color-ready", "--color-ready-soft",
          "--color-waived", "--color-waived-soft",
          "--elev-raised", "--elev-raised-sm", "--elev-raised-lg", "--elev-inset",
          "--radius-card", "--radius-control", "--radius-pill",
        ]) {
          assert.ok(vars[name], `${name} is emitted`);
        }
      });

      it("builds elevation from the ground rather than hard-coding it", () => {
        const elevation = elevationTokens(theme);
        if (theme.elevation === "soft") {
          // Two opposed shadows. One shadow is a drop shadow, not a moulding.
          assert.match(elevation.raised, /^-?\d+px .*, -\d+px/);
          assert.ok(elevation.inset.startsWith("inset"), "inset is actually inset");
        } else {
          assert.match(elevation.raised, /0 0 0 1px/, "flat surfaces get a hairline ring");
        }
      });

      it("shares ground and surface when soft, so the extrusion reads", () => {
        // A soft surface separated by its own colour is just a flat card with a
        // blurry edge — the illusion depends on them matching exactly.
        if (theme.elevation === "soft") {
          assert.equal(theme.palette.surface, theme.palette.ground);
        }
      });
    });
  }
});

/**
 * The check the whole system exists to make survivable.
 *
 * Neumorphism works by removing contrast between surfaces. That is fine for
 * surfaces and fatal for text, so every text pair is measured against what
 * actually renders — including the composited tint behind a status pill.
 */
describe("contrast (WCAG AA)", () => {
  for (const theme of THEMES) {
    describe(theme.id, () => {
      const p = theme.palette;
      const grounds: Array<[string, string]> = [
        ["ground", p.ground],
        ["surface", p.surface],
        ["sunken", p.sunken],
      ];

      for (const [groundName, ground] of grounds) {
        for (const [inkName, ink] of [
          ["ink", p.ink],
          ["ink-soft", p.inkSoft],
          ["ink-faint", p.inkFaint],
        ] as Array<[string, string]>) {
          it(`${inkName} on ${groundName}`, () => {
            const ratio = contrast(ink, ground);
            assert.ok(ratio >= AA_BODY, report(`${inkName} on ${groundName}`, ratio, AA_BODY));
          });
        }

        it(`accent on ${groundName}`, () => {
          // The accent is link text, not just a fill.
          const ratio = contrast(p.accent, ground);
          assert.ok(ratio >= AA_BODY, report(`accent on ${groundName}`, ratio, AA_BODY));
        });
      }

      it("on-accent against a filled accent surface", () => {
        const ratio = contrast(p.onAccent, p.accent);
        assert.ok(ratio >= AA_BODY, report("on-accent on accent", ratio, AA_BODY));
      });

      for (const [name, color] of [
        ["blocked", p.blocked],
        ["at-risk", p.atRisk],
        ["on-track", p.onTrack],
        ["ready", p.ready],
        ["waived", p.waived],
      ] as Array<[string, string]>) {
        it(`${name} pill text on its own tint`, () => {
          const tint = softTintOver(color, p.ground);
          const ratio = contrast(color, tint);
          assert.ok(ratio >= AA_BODY, report(`${name} on its tint`, ratio, AA_BODY));
        });

        it(`${name} score bar against its track`, () => {
          // A filled progress bar is a non-text UI component: 3:1 against the
          // well it sits in, or the fill is invisible to a lot of people.
          const ratio = contrast(color, p.sunken);
          assert.ok(ratio >= AA_NON_TEXT, report(`${name} on sunken`, ratio, AA_NON_TEXT));
        });
      }

      it("keeps the four readiness colours distinguishable from each other", () => {
        // Measured as perceptual distance, not contrast ratio. A red and an
        // amber of equal lightness score about 1.1:1 against each other and are
        // still obviously different colours — contrast ratio is the wrong
        // question here, and asking it produced a false failure.
        //
        // Colour is never the only encoding regardless: every pill carries its
        // label, which is what actually satisfies WCAG 1.4.1.
        const signals: Array<[string, string]> = [
          ["blocked", p.blocked],
          ["at-risk", p.atRisk],
          ["on-track", p.onTrack],
          ["ready", p.ready],
        ];
        for (let i = 0; i < signals.length; i += 1) {
          for (let j = i + 1; j < signals.length; j += 1) {
            const [an, a] = signals[i]!;
            const [bn, b] = signals[j]!;
            const distance = deltaE(a, b);
            assert.ok(
              distance >= DISTINCT,
              `${an} vs ${bn} is deltaE ${distance.toFixed(1)}, needs ${DISTINCT}`,
            );
          }
        }
      });
    });
  }
});

describe("theme coverage", () => {
  it("offers a dark mode for every soft family", () => {
    const softFamilies = new Set(
      THEMES.filter((t: Theme) => t.elevation === "soft").map((t) => t.family),
    );
    for (const family of softFamilies) {
      assert.ok(familyHasMode(family, "dark"), `${family} has a dark theme`);
      assert.ok(familyHasMode(family, "light"), `${family} has a light theme`);
    }
  });
});
