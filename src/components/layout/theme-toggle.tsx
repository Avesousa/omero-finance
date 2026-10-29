"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

// El tema vive en la clase del <html>: sin clase = oscuro, con .light = claro.
// Lo pone /theme-init.js antes de pintar; acá solo se lee y se cambia.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const isDark = () => !document.documentElement.classList.contains("light");

export function ThemeToggle() {
  // En el servidor no se sabe el tema: null deja un lugar vacío hasta hidratar.
  const dark = useSyncExternalStore(subscribe, isDark, () => null);

  if (dark === null) return <div className="w-9 h-9" />;

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("light", !next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
    listeners.forEach((l) => l());
  }

  return (
    <button
      onClick={toggle}
      className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
      style={{ color: "var(--text-secondary)" }}
      aria-label={dark ? "Pasar a tema claro" : "Pasar a tema oscuro"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
