import { useTranslation } from "react-i18next";
import { formatMoney } from "../../i18n/format";
import { Text } from "../atoms";
import { MoneyHero } from "./MoneyHero";

export interface CardsSummaryHeroProps {
  /** Lo que falta pagar del mes (resúmenes sin pagar + estimados). */
  toPay: number;
  paid: number;
  /** Parte de `toPay` que es estimada por cuotas. */
  estimated: number;
}

/** Héroe de Tarjetas: "ESTE MES PAGÁS", el monto grande y el pie con lo pagado y lo estimado. */
export function CardsSummaryHero({ toPay, paid, estimated }: CardsSummaryHeroProps) {
  const { t } = useTranslation("cards");
  return (
    <MoneyHero
      testID="cards-hero"
      label={t("summary.label")}
      amount={toPay}
      amountTestID="cards-hero-amount"
      caption={
        <>
          <Text variant="secondaryStrong" tone="onPrimary">
            {t("summary.paid", { amount: formatMoney(paid) })}
          </Text>
          {estimated > 0 ? (
            <Text variant="secondaryStrong" tone="onPrimary">
              {t("summary.estimated", { amount: formatMoney(estimated) })}
            </Text>
          ) : null}
        </>
      }
    />
  );
}
