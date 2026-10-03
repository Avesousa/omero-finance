import Link from "next/link";
import { ChevronRight, LayoutGrid, PiggyBank, Scale, Tags } from "lucide-react";
import { planContext, type PlanSearchParams } from "@/lib/plan/page";
import { currentPeriod } from "@/lib/plan/core";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: PlanSearchParams }) {
  const { period } = await planContext(searchParams);
  const query = period === currentPeriod() ? "" : `?period=${period}`;

  const items = [
    { href: `/plan/presupuesto${query}`, icon: PiggyBank, label: "Presupuesto", desc: "Cuánto pensás gastar por categoría y cómo venís" },
    { href: `/plan/patrimonio${query}`, icon: Scale, label: "Patrimonio y deudas", desc: "Lo que tenés, lo que debés y si el neto sube mes a mes" },
    { href: "/plan/categorias", icon: Tags, label: "Categorías", desc: "Las de gastos y las de ingresos" },
    { href: "/", icon: LayoutGrid, label: "App clásica", desc: "Volver a la versión anterior de Omero" },
  ];

  return (
    <>
      <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Más</h1>
      <div className="rounded-2xl border divide-y divide-[var(--border)] overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {items.map(({ href, icon: Icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-4 py-4 transition-opacity active:opacity-70"
            style={{ backgroundColor: "var(--bg-card)" }}
          >
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: "var(--bg-elevated)" }}>
              <Icon size={18} style={{ color: "var(--accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{desc}</p>
            </div>
            <ChevronRight size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          </Link>
        ))}
      </div>
    </>
  );
}
