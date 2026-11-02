"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface FinanceOption {
  id: string;
  label: string;
  role: string;
}

/** Selector de finanza del encabezado de /plan. Guarda la elección en la cookie `omero_finance` y recarga la página. */
export function FinanceSwitcher({ options, activeId }: { options: FinanceOption[]; activeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(id: string) {
    if (id === activeId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plan/finances/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo cambiar de finanza");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Finanza</span>
        <select
          aria-label="Finanza activa"
          value={activeId}
          disabled={busy}
          onChange={(e) => change(e.target.value)}
          className="min-h-11 flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} · {o.role}
            </option>
          ))}
        </select>
      </label>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
