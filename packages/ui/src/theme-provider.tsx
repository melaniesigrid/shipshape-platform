"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_THEME_ID,
  THEMES,
  THEME_ATTRIBUTE,
  familyHasMode,
  getTheme,
  resolveTheme,
  type Theme,
  type ThemeMode,
} from "./themes.ts";

/**
 * Runtime theming.
 *
 * Two independent choices, because they are two different questions:
 *
 *   family — which identity (Harbour, Sage, Dusk, Chart & Rule)
 *   mode   — light, dark, or follow the operating system
 *
 * Collapsing them into one flat list of seven themes is the usual shortcut and
 * it breaks the moment someone picks Sage and then their machine goes dark at
 * sunset: they wanted Sage, not Sage-light forever.
 */

export type ModePreference = ThemeMode | "system";

const STORAGE_FAMILY = "shipshape.theme.family";
const STORAGE_MODE = "shipshape.theme.mode";

export interface ThemeContextValue {
  theme: Theme;
  family: string;
  /** What the user asked for, which may be "system". */
  modePreference: ModePreference;
  /** What "system" currently resolves to. */
  resolvedMode: ThemeMode;
  setFamily: (family: string) => void;
  setModePreference: (mode: ModePreference) => void;
  families: Array<{ id: string; name: string; description: string; hasDark: boolean }>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Every distinct family, in registry order, with its display copy. */
function familyList() {
  const seen = new Map<string, Theme>();
  for (const theme of THEMES) if (!seen.has(theme.family)) seen.set(theme.family, theme);
  return [...seen.values()].map((theme) => ({
    id: theme.family,
    name: theme.name,
    description: theme.description,
    hasDark: familyHasMode(theme.family, "dark"),
  }));
}

function readStored(key: string): string | null {
  // Private windows, cleared site data, and browsers set to block storage all
  // throw here rather than returning null. A theme preference is never worth
  // taking the page down for.
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Preference is not persisted this session. The page still works. */
  }
}

export function ThemeProvider({
  children,
  initialFamily,
}: {
  children: React.ReactNode;
  /** Server-rendered default. The client corrects it after hydration. */
  initialFamily?: string;
}) {
  const fallback = getTheme(DEFAULT_THEME_ID)!;

  const [family, setFamilyState] = useState<string>(initialFamily ?? fallback.family);
  const [modePreference, setModeState] = useState<ModePreference>("system");
  const [systemMode, setSystemMode] = useState<ThemeMode>("light");

  // Restore the stored preference once, after mount. Reading localStorage during
  // render would make the first client render disagree with the server's.
  useEffect(() => {
    const storedFamily = readStored(STORAGE_FAMILY);
    const storedMode = readStored(STORAGE_MODE);
    if (storedFamily && THEMES.some((t) => t.family === storedFamily)) setFamilyState(storedFamily);
    if (storedMode === "light" || storedMode === "dark" || storedMode === "system") {
      setModeState(storedMode);
    }
  }, []);

  // Follow the OS while the preference is "system" — and keep following it, so
  // the page flips at sunset rather than at the next reload.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemMode(query.matches ? "dark" : "light");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const resolvedMode: ThemeMode = modePreference === "system" ? systemMode : modePreference;
  const theme = useMemo(() => resolveTheme(family, resolvedMode), [family, resolvedMode]);

  // One attribute, one source of truth. The stylesheet only ever answers
  // `[data-theme="..."]`; it never re-derives the choice from a media query.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, theme.id);
    root.style.colorScheme = theme.mode;
  }, [theme]);

  const setFamily = useCallback((next: string) => {
    setFamilyState(next);
    writeStored(STORAGE_FAMILY, next);
  }, []);

  const setModePreference = useCallback((next: ModePreference) => {
    setModeState(next);
    writeStored(STORAGE_MODE, next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      family,
      modePreference,
      resolvedMode,
      setFamily,
      setModePreference,
      families: familyList(),
    }),
    [theme, family, modePreference, resolvedMode, setFamily, setModePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside a ThemeProvider");
  return context;
}

/**
 * Inline script for the document head, before any paint.
 *
 * Without it the page renders the server's default theme and then corrects
 * itself on hydration — a white flash for anyone who chose dark, which is
 * exactly the person who minds most. It has to be synchronous, inline, and in
 * `<head>`; deferring it defeats the point.
 *
 * Written as a string rather than a component so it can be injected with
 * `dangerouslySetInnerHTML` and stay out of the React tree entirely.
 */
export const themeScript = `(function(){try{
var f=localStorage.getItem("${STORAGE_FAMILY}")||"${getTheme(DEFAULT_THEME_ID)!.family}";
var m=localStorage.getItem("${STORAGE_MODE}")||"system";
if(m==="system"){m=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
var t=${JSON.stringify(THEMES.map((t) => ({ i: t.id, f: t.family, m: t.mode })))};
var hit=t.filter(function(x){return x.f===f;});
var pick=hit.filter(function(x){return x.m===m;})[0]||hit[0]||{i:"${DEFAULT_THEME_ID}",m:"light"};
document.documentElement.setAttribute("${THEME_ATTRIBUTE}",pick.i);
document.documentElement.style.colorScheme=pick.m;
}catch(e){}})();`;
