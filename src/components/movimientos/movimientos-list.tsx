"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, TrendingUp } from "lucide-react";
import { MONTH_NAMES, type MonthName } from "@/lib/months";
import type { Movimiento } from "@/app/movimientos/page";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtArs = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

function fmtDate(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Category config ───────────────────────────────────────────────────────────

type Category = Movimiento["category"];

const CAT_CONFIG: Record<Category, { label: string; emoji: string; color: string; bg: string }> = {
  mercado:  { label: "Mercado",  emoji: "🛒", color: "var(--accent-green)",  bg: "var(--accent-green-subtle)"  },
  general:  { label: "General",  emoji: "🏠", color: "var(--accent)",        bg: "var(--accent-subtle)"        },
  fijo:     { label: "Fijo",     emoji: "⚡", color: "var(--accent-amber)",  bg: "var(--accent-amber-subtle)"  },
  personal: { label: "Personal", emoji: "👤", color: "var(--accent)",        bg: "var(--accent-subtle)"        },
  ingreso:  { label: "Ingreso",  emoji: "💰", color: "var(--accent-green)",  bg: "var(--accent-green-subtle)"  },
};

const ALL_CATS: Category[] = ["mercado", "general", "fijo", "personal", "ingreso"];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  movimientos: Movimiento[];
  month: MonthName;
  year: number;
}

export function MovimientosList({ movimientos, month, year }: Props) {
  const router  = useRouter();
  const [search, setSearch]   = useState("");
  const [activeCat, setActiveCat] = useState<Category | "all">("all");

  // ── Month navigation ──────────────────────────────────────────────────────
  function navigate(dir: -1 | 1) {
    const idx = MONTH_NAMES.indexOf(month);
    let newIdx  = idx + dir;
    let newYear = year;
    if (newIdx < 0)  { newIdx = 11; newYear -= 1; }
    if (newIdx > 11) { newIdx = 0;  newYear += 1; }
    const p = new URLSearchParams({ month: MONTH_NAMES[newIdx], year: String(newYear) });
    router.push(`/movimientos?${p.toString()}`);
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movimientos.filter((m) => {
      if (activeCat !== "all" && m.category !== activeCat) return false;
      if (q && !m.description.toLowerCase().includes(q) && !m.createdBy.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [movimientos, activeCat, search]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const expenses  = filtered.filter((m) => m.category !== "ingreso");
  const totalArs  = expenses.reduce((s, m) => s + (m.currency === "ARS" ? m.amount : (m.amountArs ?? 0)), 0);
  const totalUsd  = expenses.filter((m) => m.currency === "USD" && !m.amountArs).reduce((s, m) => s + m.amount, 0);
  const incomeArs = filtered.filter((m) => m.category === "ingreso")
    .reduce((s, m) => s + (m.currency === "ARS" ? m.amount : (m.amountArs ?? 0)), 0);

  // ── Group by date ─────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const map = new Map<string, Movimiento[]>();
    for (const m of filtered) {
      const d = new Date(m.date);
      const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-3">
      {/* ── Month selector ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 rounded-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={15} />
        </button>
        <p className="text-sm font-semibold capitalize" style={{ color: "var(--text-primary)" }}>
          {month} {year}
        </p>
        <button
          onClick={() => navigate(1)}
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* ── Summary strip ── */}
      <div
        className="rounded-2xl px-4 py-3 grid grid-cols-3 gap-2 text-center"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
      >
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>Ingresos</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: "var(--accent-green)" }}>{fmtArs(incomeArs)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>Gastos ARS</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: "var(--accent-red)" }}>{fmtArs(totalArs)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>Gastos USD</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: totalUsd > 0 ? "var(--accent)" : "var(--text-secondary)" }}>
            {totalUsd > 0 ? fmtUsd(totalUsd) : "—"}
          </p>
        </div>
      </div>

      {/* ── Search ── */}
      <div
        className="flex items-center gap-2.5 px-3.5 h-10 rounded-xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <Search size={14} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Buscar por descripción o usuario…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--text-primary)" }}
        />
      </div>

      {/* ── Category filters ── */}
      <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {(["all", ...ALL_CATS] as const).map((cat) => {
          const isActive = activeCat === cat;
          const cfg      = cat !== "all" ? CAT_CONFIG[cat] : null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={{
                backgroundColor: isActive ? (cfg?.bg ?? "var(--accent-subtle)") : "var(--bg-elevated)",
                color:           isActive ? (cfg?.color ?? "var(--accent)") : "var(--text-secondary)",
                border:          isActive ? `1px solid ${cfg?.color ?? "var(--accent)"}33` : "1px solid transparent",
              }}
            >
              {cfg ? `${cfg.emoji} ${cfg.label}` : "✦ Todo"}
            </button>
          );
        })}
      </div>

      {/* ── Transaction groups ── */}
      {groups.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <TrendingUp size={32} style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
          <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>
            Sin movimientos para este período
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([dateKey, items]) => (
            <div key={dateKey} className="space-y-1.5">
              {/* Date header */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {dateKey}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
                <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  {items.length} mov.
                </span>
              </div>

              {/* Items */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
              >
                {items.map((m, i) => {
                  const cfg       = CAT_CONFIG[m.category];
                  const isIncome  = m.category === "ingreso";
                  const displayAmt = m.currency === "ARS"
                    ? fmtArs(m.amount)
                    : fmtUsd(m.amount) + " USD";
                  const arsEquiv = m.amountArs ? fmtArs(m.amountArs) : null;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{
                        borderTop: i > 0 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      {/* Category icon */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                        style={{ backgroundColor: cfg.bg }}
                      >
                        {cfg.emoji}
                      </div>

                      {/* Description + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight" style={{ color: "var(--text-primary)" }}>
                          {m.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                            {m.createdBy} · {fmtTime(m.date)}
                          </span>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right flex-shrink-0">
                        <p
                          className="text-sm font-bold tabular-nums"
                          style={{
                            color: isIncome ? "var(--accent-green)" : "var(--text-primary)",
                          }}
                        >
                          {isIncome ? "+" : "−"}{displayAmt}
                        </p>
                        {arsEquiv && (
                          <p className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
                            ≈ {arsEquiv}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
