import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SpendingItem } from "../../components/organisms";
import type { HomeSummary } from "../../data";

/** Tramos de "En qué se va el mes" con la etiqueta traducida (`labelKey` de i18n o el nombre que viene del plan). Lo usan Inicio y Presupuesto. */
export function useSpendingItems(data: Pick<HomeSummary, "spendingByCategory"> | undefined): SpendingItem[] {
  const { t } = useTranslation("home");
  return useMemo(
    () =>
      (data?.spendingByCategory ?? []).map((c) => ({
        id: c.id,
        label: c.labelKey ? (t as unknown as (k: string) => string)(c.labelKey) : (c.name ?? c.id),
        amount: c.amount,
      })),
    [data, t],
  );
}
