"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // CSS uses .light for light mode; absence = dark mode
    setDark(!document.documentElement.classList.contains("light"));
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-9 h-9" />;

  function toggle() {
    const next = !dark;
    setDark(next);
    // dark mode = no class; light mode = .light class
    document.documentElement.classList.toggle("light", !next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  }

  return (
    <button
      onClick={toggle}
      className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
      style={{ color: "var(--text-secondary)" }}
      aria-label="Toggle theme"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
