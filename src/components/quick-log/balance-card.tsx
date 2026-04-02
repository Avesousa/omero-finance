"use client";

interface BalanceCardProps {
  availableArs: number;
  availableUsd: number;
  month: string;
  year: number;
}

export function BalanceCard({ availableArs, availableUsd, month, year }: BalanceCardProps) {
  const formattedArs = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(availableArs);

  const isNegative = availableArs < 0;

  return (
    <div
      className="rounded-2xl p-5 border"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "var(--text-secondary)" }}>
        Disponible · {month} {year}
      </p>
      <p
        className="text-4xl font-bold tabular-nums leading-none"
        style={{ color: isNegative ? "var(--accent-red)" : "var(--text-primary)" }}
      >
        {formattedArs}
      </p>
      {availableUsd !== 0 && (
        <p className="mt-2 text-sm tabular-nums" style={{ color: "var(--accent-green)" }}>
          💵{" "}
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
          }).format(availableUsd)}{" "}
          USD
        </p>
      )}
    </div>
  );
}
