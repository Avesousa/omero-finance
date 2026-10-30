import { useTranslation } from "react-i18next";
import { formatMoneyCompact, formatPeriod } from "../../i18n/format";
import { Surface, Text, VStack } from "../atoms";
import { MiniBarChart } from "../molecules";

export interface WealthTrendCardProps {
  /** Patrimonio neto por mes, ya en `currency`; el último se resalta. */
  history: readonly { period: string; net: number }[];
  currency?: string;
}

/** "Cómo viene creciendo": barras del patrimonio neto de los últimos meses. */
export function WealthTrendCard({ history, currency = "ARS" }: WealthTrendCardProps) {
  const { t } = useTranslation("wealth");
  const data = history.map((h) => ({ key: h.period, label: formatPeriod(h.period, "short"), value: h.net }));
  const last = history[history.length - 1];
  return (
    <Surface testID="wealth-trend">
      <VStack gap={3}>
        <Text variant="bodyStrong">{t("trend.title")}</Text>
        <MiniBarChart data={data} highlightKey={last?.period} formatValue={(v) => formatMoneyCompact(v, currency)} />
      </VStack>
    </Surface>
  );
}
