"use client";

import { useState } from "react";

type ExchangeRate = {
  id: string;
  date: string;
  usdArs: number;
  source: "API" | "MANUAL";
};

type Props = {
  initialRates: ExchangeRate[];
};

function SourceBadge({ source }: { source: "API" | "MANUAL" }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{
        backgroundColor: source === "MANUAL" ? "var(--accent)" : "var(--bg-elevated)",
        color:           source === "MANUAL" ? "var(--accent-foreground)" : "var(--text-secondary)",
      }}
    >
      {source === "MANUAL" ? "Manual" : "API"}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function todayLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function TipoCambioClient({ initialRates }: Props) {
  const [rates, setRates]     = useState<ExchangeRate[]>(initialRates);
  const [date, setDate]       = useState(todayLocal());
  const [usdArs, setUsdArs]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const latest = rates[0] ?? null;

  async function handleSave() {
    setError(null);
    setSuccess(false);
    const parsed = parseFloat(usdArs);
    if (!usdArs || isNaN(parsed) || parsed <= 0) {
      setError("Ingresá un valor válido mayor a 0.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/exchange-rate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ usdArs: parsed, date }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Error al guardar.");
        return;
      }
      const saved: ExchangeRate = await res.json();
      // Refresh list: upsert locally
      setRates((prev) => {
        const filtered = prev.filter(
          (r) => r.date.slice(0, 10) !== saved.date.slice(0, 10)
        );
        return [saved, ...filtered]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10);
      });
      setUsdArs("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Current rate card */}
      <div
        className="rounded-2xl p-5 flex flex-col gap-2"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Tipo de cambio actual
        </p>
        {latest ? (
          <>
            <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              1 USD ={" "}
              <span style={{ color: "var(--accent)" }}>
                ${latest.usdArs.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS
              </span>
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {formatDate(latest.date)}
              </p>
              <SourceBadge source={latest.source} />
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Sin datos disponibles
          </p>
        )}
      </div>

      {/* Manual input form */}
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Ingresar tipo de cambio manualmente
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Fecha
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm w-full"
            style={{
              backgroundColor: "var(--bg-elevated)",
              color:           "var(--text-primary)",
              border:          "1px solid var(--border)",
              outline:         "none",
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            ARS por 1 USD
          </label>
          <input
            type="number"
            value={usdArs}
            onChange={(e) => setUsdArs(e.target.value)}
            placeholder="Ej: 1200.50"
            min="0"
            step="0.01"
            className="rounded-xl px-3 py-2.5 text-sm w-full"
            style={{
              backgroundColor: "var(--bg-elevated)",
              color:           "var(--text-primary)",
              border:          "1px solid var(--border)",
              outline:         "none",
            }}
          />
        </div>

        {error && (
          <p className="text-xs" style={{ color: "var(--accent-red)" }}>
            {error}
          </p>
        )}
        {success && (
          <p className="text-xs" style={{ color: "var(--accent)" }}>
            Tipo de cambio guardado correctamente.
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity active:opacity-70 disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {/* History list */}
      {rates.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden border divide-y"
          style={{ borderColor: "var(--border)" }}
        >
          <p
            className="px-4 py-3 text-xs font-semibold uppercase tracking-wide"
            style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
          >
            Historial reciente
          </p>
          {rates.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-4 py-3"
              style={{ backgroundColor: "var(--bg-card)" }}
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  1 USD = ${r.usdArs.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS
                </p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {formatDate(r.date)}
                </p>
              </div>
              <SourceBadge source={r.source} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
