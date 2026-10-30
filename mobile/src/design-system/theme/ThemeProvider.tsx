import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { prefGet, prefSet } from "../../../lib/storage";
import { radius } from "../tokens/radius";
import { sizes } from "../tokens/sizes";
import { spacing } from "../tokens/spacing";
import { themes, THEME_MODES, type ThemeColors, type ThemeEffects, type ThemeMode } from "../tokens/themes";
import { typography } from "../tokens/typography";

export const THEME_STORAGE_KEY = "omero_theme_mode";
export const DEFAULT_THEME_MODE: ThemeMode = "tranqui";

export interface Theme {
  mode: ThemeMode;
  /** true en Atrevido: habilita stickers, accesorios y brillos. */
  bold: boolean;
  colors: ThemeColors;
  effects: ThemeEffects;
  type: typeof typography;
  space: typeof spacing;
  radius: typeof radius;
  sizes: typeof sizes;
  statusBar: "dark" | "light";
}

export interface ThemeContextValue extends Theme {
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Provee el tema activo. El modo se guarda en AsyncStorage (default 'tranqui').
 * No renderiza hijos hasta leer el modo guardado, así no hay parpadeo de tema.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    prefGet(THEME_STORAGE_KEY).then((saved) => {
      if (!alive) return;
      if (saved && (THEME_MODES as readonly string[]).includes(saved)) setModeState(saved as ThemeMode);
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    prefSet(THEME_STORAGE_KEY, next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === "tranqui" ? "atrevido" : "tranqui";
      prefSet(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const def = themes[mode];
    return {
      mode,
      bold: def.bold,
      colors: def.colors,
      effects: def.effects,
      statusBar: def.statusBar,
      type: typography,
      space: spacing,
      radius,
      sizes,
      setMode,
      toggleMode,
    };
  }, [mode, setMode, toggleMode]);

  if (!hydrated) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
