import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney, formatPercent } from "../../i18n/format";
import { ProgressBar, Surface, Text, VStack } from "../atoms";

export interface BudgetGoal {
  id: string;
  name: string;
  saved: number;
  target: number;
  currency: string;
  /** 0..1 */
  ratio: number;
}

export interface BudgetGoalsCardProps {
  goals: readonly BudgetGoal[];
  testID?: string;
}

/** Metas del nido como referencia chica debajo de "Ahorro primero". */
export function BudgetGoalsCard({ goals, testID = "budget-goals" }: BudgetGoalsCardProps) {
  const { t } = useTranslation("budget");
  const { space } = useTheme();
  return (
    <Surface testID={testID}>
      <VStack gap={2}>
        <Text variant="label" tone="inkMuted">
          {t("savings.goals").toUpperCase()}
        </Text>
        {goals.map((g) => (
          <VStack key={g.id} gap={1}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
              <Text variant="secondaryStrong" style={{ flexShrink: 1 }} numberOfLines={1}>
                {g.name}
              </Text>
              <Text variant="secondary" tone="inkMuted">
                {t("savings.goalOf", { saved: formatMoney(g.saved, g.currency), target: formatMoney(g.target, g.currency) })}
              </Text>
            </View>
            <ProgressBar value={g.ratio} tone="positive" accessibilityLabel={t("savings.goalProgress", { name: g.name, percent: formatPercent(g.ratio) })} />
          </VStack>
        ))}
      </VStack>
    </Surface>
  );
}
