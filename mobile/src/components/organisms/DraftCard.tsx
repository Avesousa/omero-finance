import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { Button, HStack, Icon, Pill, Text, VStack } from "../atoms";

export interface DraftCardProps {
  /** "Ingreso" */
  kindLabel: string;
  name: string | null;
  /** Monto ya formateado; null = no se dijo. */
  amount: string | null;
  /** Categoría, fecha, etc. ya formateados. */
  details: readonly string[];
  fixed?: boolean;
  status: "pending" | "saved" | "dismissed";
  /** Monto ya formateado cuando `status` es "saved". */
  savedAmount?: string;
  onReview: () => void;
}

/** Resumen del borrador dentro del chat: lo que entendió la mascota y el paso para revisarlo y guardarlo. */
export function DraftCard({ kindLabel, name, amount, details, fixed, status, savedAmount, onReview }: DraftCardProps) {
  const { t } = useTranslation("load");
  const { colors, radius, space, sizes } = useTheme();
  const done = status === "saved";
  return (
    <View
      testID="draft-card"
      style={{
        alignSelf: "flex-start",
        width: "86%",
        padding: space[4],
        gap: space[3],
        borderRadius: radius.card,
        backgroundColor: colors.surface,
        borderWidth: sizes.hairline,
        borderColor: done ? colors.positive : colors.border,
        opacity: status === "dismissed" ? 0.8 : 1,
      }}
    >
      <HStack gap={2}>
        <Icon name="arrow-down-circle-outline" size="sm" tone="inkMuted" />
        <Text variant="label" tone="inkMuted">
          {kindLabel.toUpperCase()}
        </Text>
      </HStack>
      <VStack gap={1}>
        <Text variant="cardTitle" numberOfLines={2}>
          {name || t("draft.unnamed")}
        </Text>
        {amount ? (
          <Text variant="screenTitle">{done && savedAmount ? savedAmount : amount}</Text>
        ) : (
          <Text variant="number" tone="dangerInk">
            {t("draft.missingAmount")}
          </Text>
        )}
      </VStack>
      {details.length > 0 || fixed ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {details.map((d) => (
            <Pill key={d} label={d} />
          ))}
          {fixed ? <Pill label={t("draft.fixed")} tone="accent" /> : null}
        </View>
      ) : null}
      {done ? (
        <HStack gap={2} accessibilityRole="text">
          <Icon name="checkmark-circle" tone="positiveInk" />
          <Text variant="bodyStrong" tone="positiveInk">
            {t("draft.saved")}
          </Text>
        </HStack>
      ) : status === "dismissed" ? (
        <VStack gap={2}>
          <Text variant="secondaryStrong" tone="inkMuted">
            {t("draft.dismissed")}
          </Text>
          <Button testID="draft-review" variant="secondary" label={t("draft.resume")} onPress={onReview} />
        </VStack>
      ) : (
        <Button testID="draft-review" label={t("draft.review")} onPress={onReview} />
      )}
    </View>
  );
}
