"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Banknote, ChevronDown, Home, PiggyBank, Smartphone, TrendingUp, User, Wallet } from "lucide-react";
import type { ViewMode } from "./home-client";

const fmtArs = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

type AccountType = "CHECKING" | "SAVINGS" | "INVESTMENT" | "CASH" | "DIGITAL";

const TYPE_ICONS: Record<AccountType, React.ElementType> = {
  CHECKING:   Banknote,
  SAVINGS:    PiggyBank,
  INVESTMENT: TrendingUp,
  CASH:       Wallet,
  DIGITAL:    Smartphone,
};

interface AccountSnap {
  id: string; name: string; type: string; currency: string;
  balance: number; user: { name: string; avatarColor: string } | null;
}

interface BalanceCardProps {
  mode: ViewMode;
  onToggleMode: () => void;
  userName: string;
  month: string;
  year: number;
  accounts: AccountSnap[];
  // casa
  availableArs: number;
  committed: number;
  actualSpent: number;
  totalIncomeUsd: number;
  // personal
  myAvailableArs: number;
  myGastosLibres: number;
  personalOnlyIncomeArs: number;
  myPersonalSpentArs: number;
}

export function BalanceCard({
  mode, onToggleMode, userName, month, year, accounts,
  availableArs, committed, totalIncomeUsd,
  myAvailableArs, myGastosLibres, personalOnlyIncomeArs, myPersonalSpentArs,
}: BalanceCardProps) {
  const isPersonal = mode === "personal";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  function selectMode(m: ViewMode) {
    if (m !== mode) onToggleMode();
    setDropdownOpen(false);
  }

  // ── Derived values ──
  const mainBalance  = isPersonal ? myAvailableArs : availableArs;
  const isNegative   = mainBalance < 0;
  const projected    = availableArs - committed;
  const projIsNeg    = projected < 0;

  const arsAccounts = accounts.filter((a) => a.currency === "ARS");
  const usdAccounts = accounts.filter((a) => a.currency === "USD");
  const arsTotal    = arsAccounts.reduce((s, a) => s + a.balance, 0);
  const usdTotal    = usdAccounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* ── Gradient accent strip ── */}
      <div className="gradient-strip h-1 w-full" />

      {/* ── Main balance ── */}
      <div className="px-5 pt-4 pb-5 space-y-4">
        {/* Label + toggle */}
        <div className="flex items-center justify-between">
          <p
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            Disponible
          </p>

          {/* Mode dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor: "var(--bg-elevated)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {isPersonal ? <User size={10} /> : <Home size={10} />}
              {isPersonal ? userName : "Casa"}
              <ChevronDown
                size={10}
                style={{
                  transition: "transform 0.15s",
                  transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-50 min-w-[120px]"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {([
                  { key: "personal" as ViewMode, icon: <User size={11} />, label: userName },
                  { key: "casa"     as ViewMode, icon: <Home size={11} />, label: "Casa" },
                ] as const).map(({ key, icon, label }) => (
                  <button
                    key={key}
                    onClick={() => selectMode(key)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] font-medium transition-colors"
                    style={{
                      color: mode === key ? "var(--accent)" : "var(--text-primary)",
                      backgroundColor: mode === key ? "rgba(99,102,241,0.08)" : "transparent",
                    }}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Month badge */}
        <div className="flex items-center justify-between -mt-2">
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
            style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
          >
            {month} {year}
          </span>
        </div>

        {/* Primary balance */}
        <div>
          <p
            className="text-[2.75rem] font-bold tabular-nums leading-none tracking-tight"
            style={{
              color: isNegative ? "var(--accent-red)" : "var(--text-primary)",
              letterSpacing: "-0.03em",
            }}
          >
            {fmtArs(mainBalance)}
          </p>
          {!isPersonal && totalIncomeUsd > 0 && (
            <p
              className="text-base font-semibold tabular-nums mt-1"
              style={{ color: "var(--accent-green)" }}
            >
              {fmtUsd(totalIncomeUsd)} USD
            </p>
          )}
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            {isPersonal
              ? "Gastos libres + ingreso extra − gastos propios"
              : "Ingreso − gastos del mes"}
          </p>
        </div>

        {/* Stats row */}
        {isPersonal ? (
          <div className="grid grid-cols-2 gap-2.5">
            {/* Gastos libres (mi parte del hogar) */}
            <div
              className="rounded-xl px-3.5 py-3"
              style={{
                backgroundColor: "var(--accent-green-subtle)",
                border: "1px solid rgba(74,222,128,0.15)",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--accent-green)" }}>
                Gastos libres
              </p>
              <p className="text-base font-bold tabular-nums leading-none" style={{ color: "var(--accent-green)", letterSpacing: "-0.02em" }}>
                {fmtArs(myGastosLibres)}
              </p>
              {personalOnlyIncomeArs > 0 && (
                <p className="text-[10px] mt-1" style={{ color: "var(--accent-green)" }}>
                  +{fmtArs(personalOnlyIncomeArs)} extra
                </p>
              )}
              <p className="text-[10px] mt-1" style={{ color: "var(--text-secondary)" }}>
                Mi parte del hogar
              </p>
            </div>

            {/* Gastado personal */}
            <div
              className="rounded-xl px-3.5 py-3"
              style={{
                backgroundColor: "var(--accent-red-subtle)",
                border: "1px solid rgba(248,113,113,0.15)",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--accent-red)" }}>
                Gastado
              </p>
              <p className="text-base font-bold tabular-nums leading-none" style={{ color: "var(--accent-red)", letterSpacing: "-0.02em" }}>
                {fmtArs(myPersonalSpentArs)}
              </p>
              <p className="text-[10px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
                Gastos propios
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {/* Comprometido */}
            <div
              className="rounded-xl px-3.5 py-3"
              style={{
                backgroundColor: "var(--accent-amber-subtle)",
                border: "1px solid rgba(251,191,36,0.15)",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--accent-amber)" }}>
                Comprometido
              </p>
              <p className="text-base font-bold tabular-nums leading-none" style={{ color: "var(--accent-amber)", letterSpacing: "-0.02em" }}>
                {fmtArs(committed)}
              </p>
              <p className="text-[10px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
                Fijos + TDC pendiente
              </p>
            </div>

            {/* Proyectado */}
            <div
              className="rounded-xl px-3.5 py-3"
              style={{
                backgroundColor: projIsNeg ? "var(--accent-red-subtle)" : "var(--accent-green-subtle)",
                border: `1px solid ${projIsNeg ? "rgba(248,113,113,0.15)" : "rgba(74,222,128,0.15)"}`,
              }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
                style={{ color: projIsNeg ? "var(--accent-red)" : "var(--accent-green)" }}
              >
                Proyectado
              </p>
              <p
                className="text-base font-bold tabular-nums leading-none"
                style={{ color: projIsNeg ? "var(--accent-red)" : "var(--accent-green)", letterSpacing: "-0.02em" }}
              >
                {fmtArs(projected)}
              </p>
              <p className="text-[10px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
                Disp. − comprometido
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Accounts section ── */}
      {accounts.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              Cuentas
            </p>
            <div className="flex items-center gap-3">
              {arsTotal !== 0 && (
                <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {fmtArs(arsTotal)}
                </span>
              )}
              {usdTotal !== 0 && (
                <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--accent-green)" }}>
                  {fmtUsd(usdTotal)} USD
                </span>
              )}
              <Link
                href="/mas/cuentas"
                className="flex items-center gap-0.5 text-[11px] font-semibold"
                style={{ color: "var(--accent)" }}
              >
                Ver <ArrowRight size={11} />
              </Link>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto px-5 pb-4" style={{ scrollbarWidth: "none" }}>
            {accounts.map((a) => {
              const Icon = TYPE_ICONS[a.type as AccountType] ?? Wallet;
              return (
                <Link
                  key={a.id}
                  href="/mas/cuentas"
                  className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors"
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    minWidth: 128,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  >
                    <Icon size={13} style={{ color: "var(--text-secondary)" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {a.name}
                    </p>
                    <p
                      className="text-[11px] font-semibold tabular-nums"
                      style={{ color: a.currency === "USD" ? "var(--accent-green)" : "var(--text-secondary)" }}
                    >
                      {a.currency === "ARS" ? fmtArs(a.balance) : fmtUsd(a.balance) + " USD"}
                    </p>
                  </div>
                  {a.user && (
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white"
                      style={{ backgroundColor: a.user.avatarColor, fontSize: 8, fontWeight: 700 }}
                      title={a.user.name}
                    >
                      {a.user.name[0]}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {accounts.length === 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <Link
            href="/mas/cuentas"
            className="flex items-center justify-center gap-2 px-5 py-3.5"
            style={{ color: "var(--accent)" }}
          >
            <Wallet size={13} />
            <span className="text-xs font-semibold">Configurar cuentas</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
