import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { Divider, Icon, Pill, ProgressBar, Surface, Text, VStack } from "../atoms";

export interface CommittedItem {
  id: string;
  name: string;
  /** Lo que sale este mes en la categoría. */
  amount: number;
  /** Lo ya pagado (0..amount). */
  paidAmount: number;
  /** Cuántos fijos / cuotas / tarjetas se pagaron de cuántos hay. */
  paid: number;
  total: number;
  /** De dónde sale, para la explicación al tocar. */
  source: "fixed" | "cards";
  /** Tope puesto igual (se muestra como dato, no se edita acá). */
  cap?: number;
}

export interface BudgetCommittedCardProps {
  items: readonly CommittedItem[];
  testID?: string;
}

/** "Sale solo": fijos, cuotas y tarjetas del mes. Sin edición; tocar una fila explica de dónde sale. */
export function BudgetCommittedCard({ items, testID = "budget-committed" }: BudgetCommittedCardProps) {
  const { t } = useTranslation("budget");
  const { space } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Surface testID={testID}>
      <VStack gap={3}>
        <View>
          <Text variant="cardTitle" accessibilityRole="header">
            {t("committed.title")}
          </Text>
          <Text variant="secondary" tone="inkMuted">
            {t("committed.hint")}
          </Text>
        </View>
        <VStack gap={1}>
          {items.map((item, i) => {
            const expanded = open === item.id;
            const done = item.total > 0 && item.paid >= item.total;
            return (
              <View key={item.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  testID={`budget-row-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}. ${formatMoney(item.amount)}. ${t("committed.paid", { paid: item.paid, total: item.total })}`}
                  accessibilityHint={t("committed.toggle", { name: item.name })}
                  accessibilityState={{ expanded }}
                  onPress={() => setOpen(expanded ? null : item.id)}
                  style={({ pressed }) => ({ paddingVertical: space[3], gap: space[2], opacity: pressed ? 0.85 : 1 })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                    <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {done ? <Pill tone="positive" label={t("committed.paid", { paid: item.paid, total: item.total })} /> : null}
                    <Text variant="numberSmall">{formatMoney(item.amount)}</Text>
                    <Icon name={expanded ? "chevron-up" : "chevron-down"} size="sm" tone="inkMuted" />
                  </View>
                  {!done && item.total > 0 ? (
                    <Text variant="secondary" tone="inkMuted">
                      {t("committed.paid", { paid: item.paid, total: item.total })}
                    </Text>
                  ) : null}
                  {item.amount > 0 ? <ProgressBar value={item.paidAmount / item.amount} tone="positive" /> : null}
                  {item.cap ? (
                    <Text variant="secondary" tone="inkMuted">
                      {t("committed.withCap", { amount: formatMoney(item.cap) })}
                    </Text>
                  ) : null}
                  {expanded ? (
                    <Text variant="secondary" accessibilityLiveRegion="polite">
                      {item.source === "cards" ? t("committed.explainCards") : t("committed.explainFixed")}
                    </Text>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </VStack>
      </VStack>
    </Surface>
  );
}
