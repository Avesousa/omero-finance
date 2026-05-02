import Link from "next/link";
import { BarChart2, Banknote, ChevronRight, Home, ListOrdered, PiggyBank, UserCircle, Wallet, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

const MENU_ITEMS = [
  {
    href:  "/mas/dashboard",
    icon:  BarChart2,
    label: "Dashboard mensual",
    desc:  "Resumen del mes: ingresos, presupuesto y gastos por categoría",
  },
  {
    href:  "/movimientos",
    icon:  ListOrdered,
    label: "Movimientos",
    desc:  "Todos los gastos e ingresos del mes para conciliar",
  },
  {
    href:  "/mas/presupuesto",
    icon:  PiggyBank,
    label: "Presupuesto mensual",
    desc:  "Distribuí el ingreso por categoría",
  },
  {
    href:  "/mas/gastos-fijos",
    icon:  Zap,
    label: "Gastos fijos",
    desc:  "Administrá gastos recurrentes (alquiler, servicios…)",
  },
  {
    href:  "/mas/cuentas",
    icon:  Wallet,
    label: "Cuentas",
    desc:  "Saldos, transferencias y cuenta default por perfil",
  },
  {
    href:  "/mas/ahorros",
    icon:  PiggyBank,
    label: "Ahorros",
    desc:  "Registrá ahorros, viajes e inversiones",
  },
  {
    href:  "/mas/alquiler",
    icon:  Home,
    label: "Alquiler y expensas",
    desc:  "Registrá alquiler, expensas y trabajos del departamento",
  },
  {
    href:  "/mas/prestamos",
    icon:  Banknote,
    label: "Préstamos y deudas",
    desc:  "Préstamos dados y tomados, deudas a cobrar",
  },
  {
    href:  "/mas/perfil",
    icon:  UserCircle,
    label: "Perfil",
    desc:  "Editá tu nombre, email, contraseña y color de avatar",
  },
];

export default function MasPage() {
  return (
    <div className="flex flex-col gap-5 px-4 py-4 max-w-lg mx-auto">
      <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        Más
      </h1>

      <div
        className="rounded-2xl border divide-y overflow-hidden"
        style={{ borderColor: "var(--border)" }}
      >
        {MENU_ITEMS.map(({ href, icon: Icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-4 py-4 transition-opacity active:opacity-70"
            style={{ backgroundColor: "var(--bg-card)" }}
          >
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ backgroundColor: "var(--bg-elevated)" }}
            >
              <Icon size={18} style={{ color: "var(--accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {desc}
              </p>
            </div>
            <ChevronRight size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
