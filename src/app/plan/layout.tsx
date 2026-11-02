import { Suspense } from "react";
import { getServerSession } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/plan/access";
import { FINANCE_PALETTE, OMERO_PERSONAL, isPaletteKey, listFinancesFor } from "@/lib/plan/finances";
import { resolveActiveFinance } from "@/lib/plan/page";
import { InstallHint, RefreshOnReturn } from "@/components/plan/app-shell";
import { FinanceSwitcher } from "@/components/plan/finance-switcher";
import { PlanNav } from "@/components/plan/plan-nav";

/**
 * Plan simple — sección aparte con su propia navegación.
 * El contenedor y el encabezado vienen del layout raíz. Acá van el selector de finanza y el borde de color
 * (3 px, como en la app): en Personal el color de Omero, en un Hogar el de su paleta.
 */
export default async function PlanLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const active = session ? await resolveActiveFinance(session) : null;
  const finances = session ? await listFinancesFor(session.user.id) : [];
  const color = active && isPaletteKey(active.finance.color) && active.finance.kind === "SHARED"
    ? FINANCE_PALETTE[active.finance.color]
    : OMERO_PERSONAL;

  return (
    <>
      {active ? (
        <div
          aria-hidden
          data-testid="finance-frame"
          className="pointer-events-none fixed inset-0 z-50 border-[3px] border-[var(--fin-light)] dark:border-[var(--fin-dark)]"
          style={{ "--fin-light": color.light, "--fin-dark": color.dark } as React.CSSProperties}
        />
      ) : null}
      <div className="flex flex-col gap-4 px-4 py-4 max-w-lg mx-auto">
        {active && finances.length > 0 ? (
          <FinanceSwitcher
            activeId={active.householdId}
            options={finances.map((f) => ({
              id: f.id,
              label: f.kind === "PERSONAL" ? "Personal" : f.name,
              role: ROLE_LABEL[f.role],
            }))}
          />
        ) : null}
        <InstallHint />
        {children}
      </div>
      <RefreshOnReturn />
      <Suspense fallback={null}>
        <PlanNav />
      </Suspense>
    </>
  );
}
