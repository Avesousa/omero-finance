"use client";

import Link from "next/link";
import { Banknote, PiggyBank, Smartphone, TrendingUp, Wallet } from "lucide-react";

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
  id:       string;
  name:     string;
  type:     string;
  currency: string;
  balance:  number;
  user:     { name: string; avatarColor: string } | null;
}

interface BalanceCardProps {
  availableArs:    number;
  committed:       number;
  actualSpent:     number;
  totalIncomeUsd:  number;
  accounts:        AccountSnap[];
  month:           string;
  year:            number;
}

export function BalanceCard({
  availableArs, committed, actualSpent, totalIncomeUsd, accounts, month, year,
}: BalanceCardProps) {
  const isNegative  = availableArs < 0;
  const projected   = availableArs - committed;
  const projIsNeg   = projected < 0;

  const arsAccounts = accounts.filter((a) => a.currency === "ARS");
  const usdAccounts = accounts.filter((a) => a.currency === "USD");
  const arsTotal    = arsAccounts.reduce((s, a) => s + a.balance, 0);
  const usdTotal    = usdAccounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div
      className="rounded-2xl border space-y-0 overflow-hidden"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      {/* ── Main balance ── */}
      <div className="px-5 pt-5 pb-4 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "var(--text-secondary)" }}>
            Disponible · {month} {year}
          </p>

          {/* ARS + USD side by side */}
          <div className="flex items-end gap-4">
            <p
              className="text-4xl font-bold tabular-nums leading-none"
              style={{ color: isNegative ? "var(--accent-red)" : "var(--text-primary)" }}
            >
              {fmtArs(availableArs)}
            </p>
            {totalIncomeUsd > 0 && (
              <p className="text-lg font-semibold tabular-nums leading-none pb-0.5"
                style={{ color: "var(--accent-green)" }}>
                {fmtUsd(totalIncomeUsd)} USD
              </p>
            )}
          </div>

          <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>
            Ingreso del mes menos lo ya gastado/pagado
          </p>
        </div>

        {/* Comprometido + Proyectado */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--bg-elevated)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>
              Comprometido
            </p>
            <p className="text-sm font-bold tabular-nums" style={{ color: "var(--accent-amber)" }}>
              {fmtArs(committed)}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Fijos + TDC pendiente
            </p>
          </div>
          <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--bg-elevated)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>
              Proyectado libre
            </p>
            <p className="text-sm font-bold tabular-nums"
              style={{ color: projIsNeg ? "var(--accent-red)" : "var(--accent-green)" }}>
              {fmtArs(projected)}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Disponible − comprometido
            </p>
          </div>
        </div>
      </div>

      {/* ── Accounts strip ── */}
      {accounts.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {/* Totals row */}
          <div className="flex items-center justify-between px-5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
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
                className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
              >
                Ver →
              </Link>
            </div>
          </div>

          {/* Account pills */}
          <div className="flex gap-2 overflow-x-auto px-5 pb-4" style={{ scrollbarWidth: "none" }}>
            {accounts.map((a) => {
              const Icon = TYPE_ICONS[a.type as AccountType] ?? Wallet;
              return (
                <Link
                  key={a.id}
                  href="/mas/cuentas"
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ backgroundColor: "var(--bg-elevated)", minWidth: 120 }}
                >
                  <Icon size={14} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                    <p className="text-[10px] tabular-nums" style={{ color: a.currency === "USD" ? "var(--accent-green)" : "var(--text-secondary)" }}>
                      {a.currency === "ARS" ? fmtArs(a.balance) : fmtUsd(a.balance) + " USD"}
                    </p>
                  </div>
                  {a.user && (
                    <div
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0 ml-auto"
                      style={{ backgroundColor: a.user.avatarColor }}
                      title={a.user.name}
                    />
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
            className="flex items-center justify-center gap-2 px-5 py-3"
            style={{ color: "var(--text-secondary)" }}
          >
            <Wallet size={14} />
            <span className="text-xs">Configurar cuentas →</span>
          </Link>
        </div>
      )}
    </div>
  );
}
