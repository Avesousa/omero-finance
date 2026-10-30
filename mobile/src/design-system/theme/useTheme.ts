import { useContext } from "react";
import { ThemeContext, type ThemeContextValue } from "./ThemeProvider";

/** Tema activo: `{ mode, colors, type, space, radius, sizes, effects, bold, setMode, toggleMode }`. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("ThemeProvider faltante");
  return ctx;
}
