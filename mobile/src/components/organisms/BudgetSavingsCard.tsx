import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney, formatPercent } from "../../i18n/format";
import { Button, Icon, ProgressBar, Surface, Text, VStack } from "../atoms";

export interface BudgetSavingsGoal {
  id: string;
  name: string;
  saved: number;
  target: number;
  currency: string;
  /** 0..1 */
  ratio: number;
}

export interface BudgetSavingsCardProps {
  /** Tope de ahorro del mes; 0 = sin definir. */
  budget: number;
  /** Lo apartado hasta ahora. */
  actual: number;
  /** Metas del nido, como referencia chica. */
  goals?: readonly BudgetSavingsGoal[];
  /** Tocar abre la edición del tope de ahorro (o "Definir ahorro" si no hay). */
  onPress: () => void;
  testID?: string;
}

/** "Ahorro primero": lo primero que se aparta del mes, grande, con su barra, y debajo (chiquito) las metas del nido. */
export function BudgetSavingsCard({ budget, actual, goals = [], onPress, testID }: BudgetSavingsCardProps) {
  const { t } = useTranslation("budget");
  const { space } = useTheme();
  const ratio = budget > 0 ? actual / budget : 0;
  const detail = t("savings.of", { actual: formatMoney(actual), budget: formatMoney(budget) });
  return (
    <Surface testID="budget-savings">
      <VStack gap={3}>
        <View>
          <Text variant="cardTitle" accessibilityRole="header">
            {t("savings.title")}
          </Text>
          <Text variant="secondary" tone="inkMuted">
            {t("savings.hint")}
          </Text>
        </View>
        {budget > 0 ? (
          <Pressable
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={`${t("savings.title")}. ${detail}`}
            accessibilityHint={t("savings.edit")}
            onPress={onPress}
            style={({ pressed }) => ({ gap: space[2], opacity: pressed ? 0.85 : 1 })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
              <Text variant="screenTitle" style={{ flexShrink: 1 }}>
                {formatMoney(budget)}
              </Text>
              <Icon name="create-outline" size="sm" tone="inkMuted" />
            </View>
            <ProgressBar value={ratio} tone="positive" accessibilityLabel={t("variable.progress", { name: t("savings.title"), percent: formatPercent(ratio) })} />
            <Text variant="secondary" tone="inkMuted">
              {detail}
            </Text>
          </Pressable>
        ) : (
          <VStack gap={3}>
            <Text variant="body">{t("savings.empty")}</Text>
            <Button testID={testID} label={t("savings.define")} onPress={onPress} />
          </VStack>
        )}
        {goals.length > 0 ? (
          <VStack gap={2} testID="budget-goals">
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
        ) : null}
      </VStack>
    </Surface>
  );
}
