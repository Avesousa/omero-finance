"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MONTH_NAMES, type MonthName } from "@/lib/months";

// ─── Types ───────────────────────────────────────────────

type Category =
  | "TDC" | "GASTOS_FIJOS" | "MERCADO"
  | "GASTOS_LIBRES" | "AHORRO_CASA" | "AHORRO_VACACIONES"
  | "INVERSION_AHORRO" | "OTROS";

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: "GASTOS_FIJOS",      label: "Gastos fijos",        emoji: "⚡" },
  { value: "TDC",               label: "Tarjetas de crédito", emoji: "💳" },
  { value: "MERCADO",           label: "Mercado",              emoji: "🛒" },
  { value: "AHORRO_CASA",       label: "Ahorro casa",          emoji: "🏦" },
  { value: "AHORRO_VACACIONES", label: "Ahorro vacaciones",    emoji: "✈️" },
  { value: "INVERSION_AHORRO",  label: "Inversión",            emoji: "📈" },
  { value: "GASTOS_LIBRES",     label: "Gastos libres",        emoji: "🎯" },
  { value: "OTROS",             label: "Otros",                emoji: "📦" },
];

type Mode = "pct" | "fixed";

interface Row {
  category: Category;
  mode:     Mode;
  value:    string; // % (0-100) or ARS amount as string
}

interface ApiConfig {
  category:         string;
  manualPercentage: number | null;
  manualAmount:     number | null;
  isReserved:       boolean;
}

// ─── Helpers ─────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n);
}

function rowToArs(row: Row, totalIncome: number): number {
  const v = parseFloat(row.value);
  if (isNaN(v) || v <= 0) return 0;
  return row.mode === "pct" ? (v / 100) * totalIncome : v;
}

// ─── Component ───────────────────────────────────────────

interface BudgetConfigEditorProps {
  initialMonth:  MonthName;
  initialYear:   number;
  totalIncome:   number;
}

export function BudgetConfigEditor({
  initialMonth,
  initialYear,
  totalIncome: initialIncome,
}: BudgetConfigEditorProps) {
  const router = useRouter();

  const [month, setMonth]           = useState<MonthName>(initialMonth);
  const [year, setYear]             = useState(initialYear);
  const [totalIncome, setTotalIncome] = useState(initialIncome);
  const [tdcTotal, setTdcTotal]       = useState(0);
  const [fixedTotal, setFixedTotal]   = useState(0);
  const [usedAmounts, setUsedAmounts] = useState<Record<string, number>>({});
  const [rows, setRows]             = useState<Row[]>(
    CATEGORIES.map((c) => ({ category: c.value, mode: "pct", value: "" }))
  );
  const [inherited, setInherited]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [saved, setSaved]           = useState(false);

  // Load config whenever month/year changes
  useEffect(() => {
    setLoading(true);
    setError(null);

    // Also fetch income for the selected month
    Promise.all([
      fetch(`/api/budget-config?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/balance?month=${month}&year=${year}`).then((r) => r.json()),
    ])
      .then(([cfg, bal]) => {
        setInherited(cfg.inherited ?? false);
        setTotalIncome(bal.availableArs + /* re-add expenses so we get gross income */ 0);

        // Re-fetch gross income from balance endpoint — it returns net (income - expenses).
        // Use the income from the initial server render for now, or fetch separately.
        const apiConfigs: ApiConfig[] = cfg.configs ?? [];
        setRows(
          CATEGORIES.map((c) => {
            const found = apiConfigs.find((a) => a.category === c.value);
            if (!found) return { category: c.value, mode: "pct" as Mode, value: "" };
            if (found.manualPercentage !== null) {
              return { category: c.value, mode: "pct", value: String(Math.round(found.manualPercentage * 100)) };
            }
            return { category: c.value, mode: "fixed", value: String(found.manualAmount ?? "") };
          })
        );
      })
      .catch(() => setError("Error cargando la configuración"))
      .finally(() => setLoading(false));
  }, [month, year]);

  // Also fetch gross income + TDC total for selected month
  useEffect(() => {
    fetch(`/api/income-total?month=${month}&year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.total       !== undefined) setTotalIncome(d.total);
        if (d?.tdcTotal    !== undefined) setTdcTotal(d.tdcTotal);
        if (d?.fixedTotal  !== undefined) setFixedTotal(d.fixedTotal);
        if (d?.usedAmounts !== undefined) setUsedAmounts(d.usedAmounts);
      })
      .catch(() => {});
  }, [month, year]);

  function setRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  // Calculate totals — TDC + GASTOS_FIJOS are auto, GASTOS_LIBRES auto-fills with remanente
  const gastosLibresRow = rows.find((r) => r.category === "GASTOS_LIBRES")!;
  const manualRows      = rows.filter(
    (r) => r.category !== "GASTOS_LIBRES" && r.category !== "TDC" && r.category !== "GASTOS_FIJOS"
  );
  const manualArs       = manualRows.reduce((s, r) => s + rowToArs(r, totalIncome), 0);
  const otherArs        = manualArs + tdcTotal + fixedTotal;
  const remanente       = totalIncome - otherArs;
  const gastosLibresArs = gastosLibresRow.value
    ? rowToArs(gastosLibresRow, totalIncome)
    : Math.max(remanente, 0);
  const totalAllocated  = otherArs + gastosLibresArs;
  const remainder       = totalIncome - totalAllocated;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // TDC and GASTOS_FIJOS are auto — never saved as manual config entries
      const entries = rows
        .filter((r) => r.category !== "TDC" && r.category !== "GASTOS_FIJOS")
        .map((r) => ({
          category:         r.category,
          manualPercentage: r.mode === "pct"   && r.value ? parseFloat(r.value) / 100 : null,
          manualAmount:     r.mode === "fixed" && r.value ? parseFloat(r.value)        : null,
          isReserved:       true,
        }));

      const res = await fetch("/api/budget-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, entries }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setSaved(true);
      setInherited(false);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Month navigation
  function prevMonth() {
    const idx = MONTH_NAMES.indexOf(month);
    if (idx === 0) { setMonth(MONTH_NAMES[11]); setYear((y) => y - 1); }
    else setMonth(MONTH_NAMES[idx - 1]);
  }
  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && MONTH_NAMES.indexOf(month) >= now.getMonth())) return;
    const idx = MONTH_NAMES.indexOf(month);
    if (idx === 11) { setMonth(MONTH_NAMES[0]); setYear((y) => y + 1); }
    else setMonth(MONTH_NAMES[idx + 1]);
  }

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          ‹
        </button>
        <p className="text-sm font-semibold capitalize" style={{ color: "var(--text-primary)" }}>
          {month} {year}
        </p>
        <button
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          ›
        </button>
      </div>

      {/* Inherited notice */}
      {inherited && (
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: "rgba(99,102,241,0.08)", border: "1px solid var(--accent)" }}
        >
          <Info size={14} style={{ color: "var(--accent)", marginTop: 1, flexShrink: 0 }} />
          <p className="text-xs" style={{ color: "var(--accent)" }}>
            Cargando configuración del mes anterior. Guardá para aplicarla a {month} {year}.
          </p>
        </div>
      )}

      {/* Income summary */}
      <div
        className="rounded-2xl px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Ingreso del mes
        </p>
        <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {fmt(totalIncome)}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
        </div>
      ) : (
        <>
          {/* Category rows */}
          <div
            className="rounded-2xl border divide-y overflow-hidden"
            style={{ borderColor: "var(--border)", "--tw-divide-opacity": 1 } as React.CSSProperties}
          >
            {CATEGORIES.map((cat, idx) => {
              const row      = rows[idx];
              const arsValue = rowToArs(row, totalIncome);
              const isGastos  = cat.value === "GASTOS_LIBRES";
              const isTdc     = cat.value === "TDC";
              const isFixed   = cat.value === "GASTOS_FIJOS";
              const usedArs   = usedAmounts[cat.value] ?? 0;
              const budgetedArs = isTdc ? tdcTotal : isFixed ? fixedTotal : isGastos ? gastosLibresArs : arsValue;
              const usedPct   = budgetedArs > 0 ? Math.min(usedArs / budgetedArs, 1) : 0;
              const isOverspent = budgetedArs > 0 && usedArs > budgetedArs;

              return (
                <div
                  key={cat.value}
                  className="px-4 py-3 space-y-2"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {cat.emoji} {cat.label}
                      </p>
                      {(isTdc || isFixed) && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                          style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "var(--accent)" }}
                        >
                          auto
                        </span>
                      )}
                      {isGastos && !row.value && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                          style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "var(--accent-green)" }}
                        >
                          remanente
                        </span>
                      )}
                    </div>
                    {isTdc ? (
                      <p className="text-xs font-semibold tabular-nums" style={{ color: tdcTotal > 0 ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        {tdcTotal > 0 ? fmt(tdcTotal) : "Sin resúmenes"}
                      </p>
                    ) : isFixed ? (
                      <p className="text-xs font-semibold tabular-nums" style={{ color: fixedTotal > 0 ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        {fixedTotal > 0 ? fmt(fixedTotal) : "Sin gastos fijos"}
                      </p>
                    ) : isGastos ? (
                      <p className="text-xs tabular-nums" style={{ color: remanente >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {row.value ? fmt(arsValue) : `${fmt(gastosLibresArs)} (auto)`}
                      </p>
                    ) : arsValue > 0 ? (
                      <p className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {fmt(arsValue)}
                      </p>
                    ) : null}
                  </div>

                  {/* Progress bar: used vs budgeted */}
                  {(usedArs > 0 || budgetedArs > 0) && (
                    <div className="space-y-1">
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-elevated)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(usedPct * 100, 100)}%`,
                            backgroundColor: isOverspent ? "var(--accent-red)" : usedPct > 0.85 ? "var(--accent-amber)" : "var(--accent-green)",
                          }}
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px]" style={{ color: isOverspent ? "var(--accent-red)" : "var(--text-secondary)" }}>
                          Usado {fmt(usedArs)}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                          {(usedPct * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Auto rows: read-only info */}
                  {isTdc ? (
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                    >
                      Se toma del total de resúmenes TDC del mes. Editá desde Tarjetas.
                    </div>
                  ) : isFixed ? (
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                    >
                      Suma de todos los gastos fijos activos (alquiler, expensas, servicios…). Editá desde Gastos fijos.
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      {/* Mode toggle */}
                      <div
                        className="flex rounded-lg overflow-hidden border"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {(["pct", "fixed"] as Mode[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => setRow(idx, { mode: m, value: "" })}
                            className="px-2.5 py-1 text-xs font-semibold transition-colors"
                            style={{
                              backgroundColor: row.mode === m ? "var(--accent)" : "var(--bg-elevated)",
                              color:           row.mode === m ? "var(--accent-foreground)" : "var(--text-secondary)",
                            }}
                          >
                            {m === "pct" ? "%" : "$"}
                          </button>
                        ))}
                      </div>

                      {/* Value input */}
                      <div className="relative flex-1">
                        {row.mode === "fixed" && (
                          <span
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            $
                          </span>
                        )}
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder={isGastos && !row.value ? "Auto (remanente)" : row.mode === "pct" ? "0" : "0"}
                          value={row.value}
                          onChange={(e) => setRow(idx, { value: e.target.value })}
                          className={`h-9 text-sm ${row.mode === "fixed" ? "pl-6" : ""}`}
                          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                        />
                        {row.mode === "pct" && (
                          <span
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            %
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Remanente summary */}
          <div
            className="rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{
              backgroundColor: remainder >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${remainder >= 0 ? "var(--accent-green)" : "var(--accent-red)"}`,
            }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {remainder >= 0 ? "Sin asignar" : "Excede el ingreso"}
            </p>
            <p
              className="text-sm font-bold tabular-nums"
              style={{ color: remainder >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}
            >
              {fmt(Math.abs(remainder))}
            </p>
          </div>
        </>
      )}

      {error && <p className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving || loading}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold"
        style={{
          backgroundColor: saved ? "var(--accent-green)" : "var(--accent)",
          color: "var(--accent-foreground)",
        }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saved ? "✓ Guardado" : saving ? "Guardando…" : "Guardar presupuesto"}
      </button>
    </div>
  );
}
