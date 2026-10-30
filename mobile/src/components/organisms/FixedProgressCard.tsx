import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { formatMoney } from "../../i18n/format";
import { HStack, ProgressBar, Spacer, Surface, Text, VStack } from "../atoms";

export interface FixedProgressCardProps {
  /** Fijos pagados / total de fijos. */
  paid: number;
  total: number;
  paidAmount: number;
  totalAmount: number;
  onPress?: () => void;
}

/** "Fijos pagados 3 de 7" con barra positiva y los montos pagado / total. */
export function FixedProgressCard({ paid, total, paidAmount, totalAmount, onPress }: FixedProgressCardProps) {
  const { t } = useTranslation("home");
  const card = (
    <Surface testID="fixed-card">
      <VStack gap={2}>
        <HStack align="baseline">
          <Text variant="bodyStrong">{t("fixed.title")}</Text>
          <Spacer />
          <Text variant="numberSmall" tone="positiveInk">
            {t("fixed.progress", { paid, total })}
          </Text>
        </HStack>
        <ProgressBar tone="positive" value={total > 0 ? paid / total : 0} accessibilityLabel={t("fixed.summary", { paid, total })} />
        <Text variant="secondary" tone="inkMuted">
          {t("fixed.amounts", { paid: formatMoney(paidAmount), total: formatMoney(totalAmount) })}
        </Text>
      </VStack>
    </Surface>
  );
  if (!onPress) return card;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t("fixed.summary", { paid, total })} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {card}
    </Pressable>
  );
}
