import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney, formatPercent } from "../../i18n/format";
import { Pill, ProgressBar, Surface, Text, VStack } from "../atoms";

export type BudgetRowStatus = "ok" | "near" | "over" | "unbudgeted" | "unused";

export interface BudgetRowCardProps {
  name: string;
  spent: number;
  /** Tope del mes; 0 = sin tope. */
  budget: number;
  status: BudgetRowStatus;
  /** Tocar abre la edición del tope. */
  onPress: () => void;
  testID?: string;
}

const PILL = { ok: "positive", near: "warning", over: "danger", unbudgeted: "neutral", unused: "neutral" } as const;
const BAR = { ok: "primary", near: "warning", over: "danger", unbudgeted: "primary", unused: "primary" } as const;

/** Una categoría con tope: nombre, "$ gastado de $ tope", barra con tono por estado y píldora de estado (siempre con palabra). */
export function BudgetRowCard({ name, spent, budget, status, onPress, testID }: BudgetRowCardProps) {
  const { t } = useTranslation("budget");
  const { space } = useTheme();
  const ratio = budget > 0 ? spent / budget : 0;
  const detail = budget > 0 ? t("variable.of", { spent: formatMoney(spent), budget: formatMoney(budget) }) : t("variable.noCap", { spent: formatMoney(spent) });
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${detail}. ${t(`status.${status}`)}`}
      accessibilityHint={t("variable.edit", { name })}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Surface>
        <VStack gap={2}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
            <Text variant="bodyStrong" style={{ flexShrink: 1 }} numberOfLines={2}>
              {name}
            </Text>
            <Pill label={t(`status.${status}`)} tone={PILL[status]} />
          </View>
          <Text variant="secondary" tone="inkMuted">
            {detail}
          </Text>
          {budget > 0 ? (
            <ProgressBar value={ratio} tone={BAR[status]} accessibilityLabel={t("variable.progress", { name, percent: formatPercent(ratio) })} />
          ) : null}
        </VStack>
      </Surface>
    </Pressable>
  );
}
