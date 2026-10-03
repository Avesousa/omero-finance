import { Suspense } from "react";
import { InstallHint, RefreshOnReturn } from "@/components/plan/app-shell";
import { PlanNav } from "@/components/plan/plan-nav";

/**
 * Plan simple — sección aparte con su propia navegación.
 * El contenedor y el encabezado vienen del layout raíz.
 */
export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-col gap-4 px-4 py-4 max-w-lg mx-auto">
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
