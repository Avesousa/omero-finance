import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { Surface, Text, VStack } from "../atoms";
import { LegendItem, StackedBar } from "../molecules";

export interface SpendingItem {
  id: string;
  /** Etiqueta ya traducida. */
  label: string;
  amount: number;
}

export interface SpendingBreakdownCardProps {
  items: readonly SpendingItem[];
  /** Suma de los gastos (para la descripción accesible de la barra). */
  total: number;
}

/** "En qué se va el mes": barra apilada con los colores de gráfico del tema y leyenda con montos. */
export function SpendingBreakdownCard({ items, total }: SpendingBreakdownCardProps) {
  const { t } = useTranslation("home");
  const { colors } = useTheme();
  const colorAt = (i: number) => colors.chart[Math.min(i, colors.chart.length - 1)];
  const lastIndex = colors.chart.length - 1;
  return (
    <Surface testID="spending-card">
      <VStack gap={3}>
        <Text variant="cardTitle" accessibilityRole="header">
          {t("spending.title")}
        </Text>
        <StackedBar
          accessibilityLabel={`${t("spending.summary")}. ${t("spending.total", { amount: formatMoney(total) })}`}
          segments={items.map((item, i) => ({ value: item.amount, color: colorAt(i) }))}
        />
        <VStack gap={1}>
          {items.map((item, i) => (
            <LegendItem key={item.id} color={colorAt(i)} outlined={i >= lastIndex} label={item.label} value={formatMoney(item.amount)} />
          ))}
        </VStack>
      </VStack>
    </Surface>
  );
}
