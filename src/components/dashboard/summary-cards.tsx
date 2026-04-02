import type { DashboardData } from "@/lib/dashboard";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

interface SummaryCardsProps {
  data: DashboardData;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const { totalIncomeArs, totalUsd, exchangeRate, surplusArs, users } = data;
  const isNegative = surplusArs < 0;

  return (
    <div className="space-y-3">
      {/* Main row: income + surplus */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Ingresos del mes"
          value={fmt(totalIncomeArs)}
          sub={totalUsd > 0 ? `+ ${fmtUsd(totalUsd)} USD sin convertir` : undefined}
          accent="var(--text-primary)"
        />
        <StatCard
          label="Sobrante"
          value={fmt(surplusArs)}
          accent={isNegative ? "var(--accent-red)" : "var(--accent-green)"}
          highlight={isNegative}
        />
      </div>

      {/* Exchange rate */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-2xl border"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Tipo de cambio
        </span>
        <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
          1 USD = {fmt(exchangeRate).replace("$", "$")}
        </span>
      </div>

      {/* Per-user split */}
      <div
        className="rounded-2xl border p-4 space-y-3"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
          Distribución por persona
        </p>
        {users.map((u) => (
          <div key={u.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: u.avatarColor }}
                >
                  {u.name[0]}
                </div>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {u.name}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                  {fmt(u.incomeArs)}
                </span>
                <span className="text-xs ml-2" style={{ color: "var(--text-secondary)" }}>
                  {(u.percentage * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            {/* Percentage bar */}
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-elevated)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${u.percentage * 100}%`, backgroundColor: u.avatarColor }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  highlight?: boolean;
}

function StatCard({ label, value, sub, accent, highlight }: StatCardProps) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: highlight ? "var(--accent-red)" : "var(--border)",
      }}
    >
      <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums leading-tight" style={{ color: accent ?? "var(--text-primary)" }}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] mt-1" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
