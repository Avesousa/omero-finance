import { AlertTriangle, CreditCard } from "lucide-react";
import type { TdcAlert } from "@/lib/dashboard";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

export function TdcAlerts({ alerts }: { alerts: TdcAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p
        className="text-xs font-medium uppercase tracking-widest px-1"
        style={{ color: "var(--accent-amber)" }}
      >
        ⚠ Vencimientos próximos
      </p>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--accent-amber)",
            borderWidth: 1,
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "var(--accent-amber)" }}
          >
            <CreditCard size={16} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {alert.cardName}
            </p>
            <p className="text-xs" style={{ color: "var(--accent-amber)" }}>
              {alert.daysUntilDue === 0
                ? "Vence hoy"
                : alert.daysUntilDue === 1
                ? "Vence mañana"
                : `Vence en ${alert.daysUntilDue} días`}
            </p>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {fmt(alert.amountToPay)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
