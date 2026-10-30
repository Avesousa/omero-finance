import { useTranslation } from "react-i18next";
import { formatMoney, formatMoneyCompact } from "../../i18n/format";
import { Surface, Text, VStack } from "../atoms";
import { MiniBarChart, type MiniBarDatum } from "../molecules";

export interface CommittedMonthsCardProps {
  /** Un dato por mes: `label` ya formateado ("nov"), `value` en ARS. */
  data: readonly MiniBarDatum[];
  highlightKey?: string;
}

/** "Lo que ya comprometiste en cuotas": gráfico de barras por mes y el total del tramo. */
export function CommittedMonthsCard({ data, highlightKey }: CommittedMonthsCardProps) {
  const { t } = useTranslation("cards");
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <Surface testID="committed-card">
      <VStack gap={3}>
        <Text variant="cardTitle" accessibilityRole="header">
          {t("committed.title")}
        </Text>
        <MiniBarChart data={data} highlightKey={highlightKey} formatValue={(v) => formatMoneyCompact(v)} />
        <Text variant="secondaryStrong" tone="inkMuted">
          {t("committed.total", { amount: formatMoney(total) })}
        </Text>
      </VStack>
    </Surface>
  );
}
