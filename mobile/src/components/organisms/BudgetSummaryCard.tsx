import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney, formatPercent } from "../../i18n/format";
import { Button, Icon, Pill, ProgressBar, Surface, Text, VStack } from "../atoms";

export interface BudgetSummaryCardProps {
  /** Mes en minúscula ("noviembre"). */
  month: string;
  /** Todavía no hay presupuesto armado: muestra el CTA en vez de la barra. */
  empty?: boolean;
  /** Gastado en las categorías con tope variable. */
  spent: number;
  /** Suma de los topes de esas categorías (0 = sin topes de gasto). */
  budget: number;
  /** Categorías cerca del tope y pasadas (chip de aviso). */
  near?: number;
  over?: number;
  onPress: () => void;
}

/** Resumen chico del presupuesto para Inicio: "Gastaste $ X de $ Y" con barra y aviso. Todo el bloque se toca para abrir Presupuesto. */
export function BudgetSummaryCard({ month, empty = false, spent, budget, near = 0, over = 0, onPress }: BudgetSummaryCardProps) {
  const { t } = useTranslation("budget");
  const { space } = useTheme();
  const title = t("summary.title", { month });

  if (empty) {
    return (
      <Surface testID="budget-summary">
        <VStack gap={3}>
          <Text variant="cardTitle" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" tone="inkMuted">
            {t("summary.empty", { month })}
          </Text>
          <Button testID="budget-summary-cta" label={t("summary.emptyCta")} onPress={onPress} />
        </VStack>
      </Surface>
    );
  }

  const ratio = budget > 0 ? spent / budget : 0;
  const tone = ratio > 1 ? "danger" : ratio >= 0.85 ? "warning" : "primary";
  return (
    <Pressable
      testID="budget-summary"
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${budget > 0 ? t("summary.spent", { spent: formatMoney(spent), budget: formatMoney(budget) }) : formatMoney(spent)}`}
      accessibilityHint={t("summary.open", { month })}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Surface>
        <VStack gap={3}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
            <Text variant="cardTitle" style={{ flexShrink: 1 }}>
              {title}
            </Text>
            <Icon name="chevron-forward" size="sm" tone="inkMuted" />
          </View>
          {budget > 0 ? (
            <>
              <ProgressBar value={ratio} tone={tone} accessibilityLabel={t("summary.progress", { percent: formatPercent(ratio) })} />
              <Text variant="bodyStrong">{t("summary.spent", { spent: formatMoney(spent), budget: formatMoney(budget) })}</Text>
            </>
          ) : (
            <Text variant="bodyStrong">{t("summary.spentNoCap", { spent: formatMoney(spent) })}</Text>
          )}
          {near > 0 || over > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
              {over > 0 ? <Pill tone="danger" label={t("summary.over", { count: over })} /> : null}
              {near > 0 ? <Pill tone="warning" label={t("summary.near", { count: near })} /> : null}
            </View>
          ) : null}
        </VStack>
      </Surface>
    </Pressable>
  );
}
