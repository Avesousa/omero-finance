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
  /** De dónde sale: a qué pantalla lleva al tocar. */
  source: "fixed" | "loans" | "cards";
  /** Tope puesto igual (se muestra como dato, no se edita acá). */
  cap?: number;
}

export interface BudgetCommittedCardProps {
  items: readonly CommittedItem[];
  /** Tocar una línea (lleva a donde se edita: gastos fijos, deudas o tarjetas). */
  onItemPress?: (item: CommittedItem) => void;
  testID?: string;
}

/** "Sale solo": fijos, cuotas y tarjetas del mes. No se edita acá: cada línea es tocable y lleva a su pantalla. */
export function BudgetCommittedCard({ items, onItemPress, testID = "budget-committed" }: BudgetCommittedCardProps) {
  const { t } = useTranslation("budget");
  const { space, sizes } = useTheme();
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
            const done = item.total > 0 && item.paid >= item.total;
            return (
              <View key={item.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  testID={`budget-committed-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}. ${formatMoney(item.amount)}. ${t("committed.paid", { paid: item.paid, total: item.total })}`}
                  accessibilityHint={t("committed.open", { name: item.name })}
                  onPress={() => onItemPress?.(item)}
                  style={({ pressed }) => ({ minHeight: sizes.touch, paddingVertical: space[3], gap: space[2], opacity: pressed ? 0.85 : 1 })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                    <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {done ? <Pill tone="positive" label={t("committed.paid", { paid: item.paid, total: item.total })} /> : null}
                    <Text variant="numberSmall">{formatMoney(item.amount)}</Text>
                    <Icon name="chevron-forward" size="sm" tone="inkMuted" />
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
                </Pressable>
              </View>
            );
          })}
        </VStack>
      </VStack>
    </Surface>
  );
}
