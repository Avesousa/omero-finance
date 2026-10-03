"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, CreditCard, MoreHorizontal } from "lucide-react";
import { isValidPeriod } from "@/lib/plan/core";

const NAV_ITEMS = [
  { href: "/plan",          icon: CalendarDays,   label: "Mes"      },
  { href: "/plan/ingresos", icon: ArrowDownLeft,  label: "Ingresos" },
  { href: "/plan/gastos",   icon: ArrowUpRight,   label: "Gastos"   },
  { href: "/plan/tarjetas", icon: CreditCard,     label: "Tarjetas" },
  { href: "/plan/mas",      icon: MoreHorizontal, label: "Más"      },
] as const;

/** Navegación inferior de la sección /plan. Mantiene el mes elegido al cambiar de pantalla. */
export function PlanNav() {
  const pathname = usePathname();
  const period = useSearchParams().get("period");
  const query = isValidPeriod(period) ? `?period=${period}` : "";

  // "Más" también agrupa presupuesto, préstamos, patrimonio y categorías.
  const inMore = ["/plan/mas", "/plan/presupuesto", "/plan/prestamos", "/plan/patrimonio", "/plan/categorias", "/plan/exportar"]
    .some((p) => pathname.startsWith(p));

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))", paddingLeft: "1rem", paddingRight: "1rem" }}
    >
      <nav
        aria-label="Plan simple"
        className="glass w-full max-w-sm flex items-center justify-between px-1.5 py-2 rounded-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-nav)" }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = href === "/plan/mas" ? inMore : pathname === href;
          return (
            <Link
              key={href}
              href={`${href}${query}`}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-col items-center gap-1 px-1 py-1.5 rounded-xl transition-all flex-1 min-w-0"
              style={{
                color: active ? "var(--accent)" : "var(--text-secondary)",
                backgroundColor: active ? "var(--accent-subtle)" : "transparent",
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
              <span className="text-[10px] font-semibold tracking-wide leading-none" style={{ opacity: active ? 1 : 0.7 }}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
