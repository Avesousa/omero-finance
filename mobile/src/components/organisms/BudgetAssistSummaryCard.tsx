import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { Button, Divider, HStack, Icon, Surface, Text, VStack } from "../atoms";

export interface AssistSummaryLine {
  id: string;
  name: string;
  amount: number;
}

export interface BudgetAssistSummaryCardProps {
  lines: readonly AssistSummaryLine[];
  /** "Sin asignar" que quedaría (o quedó) con estas líneas; negativo = asignás de más. */
  unassigned: number;
  status: "pending" | "saving" | "saved";
  /** El último intento de guardar falló. */
  error?: boolean;
  onConfirm: () => void;
  onManual: () => void;
}

/** Tarjeta final del asistente de presupuesto: las líneas decididas, el Sin asignar resultante y Confirmar / Editar a mano. */
export function BudgetAssistSummaryCard({ lines, unassigned, status, error, onConfirm, onManual }: BudgetAssistSummaryCardProps) {
  const { t } = useTranslation("budget");
  const { colors, radius, space, sizes } = useTheme();
  const saved = status === "saved";
  const saving = status === "saving";
  const over = unassigned < 0;
  return (
    <View
      testID="assist-summary"
      style={{
        alignSelf: "flex-start",
        width: "92%",
        padding: space[4],
        gap: space[3],
        borderRadius: radius.card,
        backgroundColor: colors.surface,
        borderWidth: sizes.hairline,
        borderColor: saved ? colors.positive : colors.border,
      }}
    >
      <Text variant="cardTitle" accessibilityRole="header">
        {t("assistant.summary.title")}
      </Text>
      {lines.length === 0 ? (
        <Text variant="body" tone="inkMuted">
          {t("assistant.summary.empty")}
        </Text>
      ) : (
        <VStack gap={2}>
          {lines.map((l) => (
            <HStack key={l.id} justify="space-between" gap={2}>
              <Text variant="body" style={{ flexShrink: 1 }} numberOfLines={2}>
                {l.name}
              </Text>
              <Text variant="bodyStrong">{formatMoney(l.amount)}</Text>
            </HStack>
          ))}
        </VStack>
      )}
      <Divider />
      <HStack justify="space-between" gap={2}>
        <Text variant="bodyStrong" tone={over ? "dangerInk" : "ink"}>
          {over ? t("assistant.summary.over") : t("assistant.summary.unassigned")}
        </Text>
        <Text testID="assist-unassigned" variant="number" tone={over ? "dangerInk" : "ink"}>
          {formatMoney(unassigned)}
        </Text>
      </HStack>
      {saved ? (
        <HStack gap={2} accessibilityRole="text">
          <Icon name="checkmark-circle" tone="positiveInk" />
          <Text variant="bodyStrong" tone="positiveInk">
            {t("assistant.summary.saved")}
          </Text>
        </HStack>
      ) : (
        <VStack gap={2}>
          {error ? (
            <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">
              {t("assistant.summary.error")}
            </Text>
          ) : null}
          <Button
            testID="assist-confirm"
            label={saving ? t("assistant.summary.saving") : t("assistant.summary.confirm")}
            busy={saving}
            disabled={lines.length === 0}
            onPress={onConfirm}
          />
          <Button testID="assist-manual" variant="secondary" label={t("assistant.summary.manual")} disabled={saving} onPress={onManual} />
        </VStack>
      )}
    </View>
  );
}
