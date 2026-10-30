import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { Amount, Surface, Text } from "../atoms";

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
  const { space } = useTheme();
  return (
    <Surface variant="hero" testID="cards-hero" style={{ gap: space[1] }}>
      <Text variant="label" tone="onPrimary">
        {t("summary.label")}
      </Text>
      <Amount testID="cards-hero-amount" variant="heroAmount" fitChars={9} tone="onPrimary" value={toPay} />
      <Text variant="secondaryStrong" tone="onPrimary" style={{ marginTop: space[2] }}>
        {t("summary.paid", { amount: formatMoney(paid) })}
      </Text>
      {estimated > 0 ? (
        <Text variant="secondaryStrong" tone="onPrimary">
          {t("summary.estimated", { amount: formatMoney(estimated) })}
        </Text>
      ) : null}
    </Surface>
  );
}
