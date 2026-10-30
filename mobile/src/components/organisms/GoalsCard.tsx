import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { formatMoney, formatPercent } from "../../i18n/format";
import { ProgressBar, Surface, Text, VStack } from "../atoms";

export interface GoalRow {
  id: string;
  name: string;
  target: number;
  saved: number;
  /** Aporte mensual; null = sin definir. */
  monthly: number | null;
  currency: string;
  /** 0..1 */
  ratio: number;
  /** Lo que falta (>= 0). */
  missing: number;
  /** Meses para llegar con el aporte actual; null si no hay aporte. */
  monthsLeft: number | null;
}

export interface GoalsCardProps {
  goals: readonly GoalRow[];
  testID?: string;
}

/** "Metas": nombre, "$ x de $ y", barra y cuánto falta o cuánto aportar por mes. */
export function GoalsCard({ goals, testID = "goals-card" }: GoalsCardProps) {
  const { t } = useTranslation("wealth");
  return (
    <Surface testID={testID}>
      <VStack gap={4}>
        <Text variant="bodyStrong">{t("goals.title")}</Text>
        {goals.map((g) => {
          const percent = formatPercent(g.ratio);
          const done = g.missing <= 0;
          const footer = done
            ? t("goals.reached")
            : g.monthly != null && g.monthsLeft != null
              ? t("goals.monthly", { amount: formatMoney(g.monthly, g.currency), count: g.monthsLeft })
              : t("goals.missing", { amount: formatMoney(g.missing, g.currency) });
          return (
            <VStack key={g.id} gap={2} testID={`goal-${g.id}`}>
              <Text variant="bodySemi">{g.name}</Text>
              <Text variant="secondary" tone="inkMuted">
                {t("goals.of", { saved: formatMoney(g.saved, g.currency), target: formatMoney(g.target, g.currency) })}
              </Text>
              <View>
                <ProgressBar tone="positive" value={g.ratio} accessibilityLabel={t("goals.progress", { percent, name: g.name })} />
              </View>
              <Text variant="secondaryStrong">{footer}</Text>
            </VStack>
          );
        })}
      </VStack>
    </Surface>
  );
}
