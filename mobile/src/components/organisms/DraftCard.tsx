import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { Button, HStack, Icon, Pill, Text, VStack } from "../atoms";

export interface DraftCardProps {
  /** Ingreso suma (tono positivo); gasto es neutro. */
  kind: "income" | "expense";
  /** "Ingreso" / "Gasto" */
  kindLabel: string;
  name: string | null;
  /** Monto ya formateado; null = no se dijo. */
  amount: string | null;
  /** Categoría, fecha, etc. ya formateados. */
  details: readonly string[];
  fixed?: boolean;
  /** Lo que falta para poder confirmar ("Falta el monto"); null = completo (hay Confirmar). */
  missing: string | null;
  status: "pending" | "saving" | "saved";
  /** Monto ya formateado cuando `status` es "saved". */
  savedAmount?: string;
  /** El último intento de guardar falló. */
  error?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

/**
 * Lo que armó la mascota, dentro del chat: la información y dos pasos, Confirmar (guarda directo)
 * y Editar (abre el formulario). Si falta algo obligatorio no hay Confirmar y Completar es el principal.
 */
export function DraftCard({ kind, kindLabel, name, amount, details, fixed, missing, status, savedAmount, error, onConfirm, onEdit }: DraftCardProps) {
  const { t } = useTranslation("load");
  const { colors, radius, space, sizes } = useTheme();
  const done = status === "saved";
  const saving = status === "saving";
  const income = kind === "income";
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
      }}
    >
      <HStack gap={2}>
        <Icon name={income ? "arrow-down-circle-outline" : "arrow-up-circle-outline"} size="sm" tone={income ? "positiveInk" : "inkMuted"} />
        <Text variant="label" tone={income ? "positiveInk" : "inkMuted"}>
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
            {missing ?? t("draft.missingAmount")}
          </Text>
        )}
      </VStack>
      {details.length > 0 || fixed ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {/* Si el nombre es la categoría (pasa cuando no se dijo un nombre), no repetirla. */}
          {details.filter((d) => d !== name).map((d) => (
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
      ) : (
        <VStack gap={2}>
          {amount && missing ? (
            <Text variant="secondaryStrong" tone="dangerInk">
              {missing}
            </Text>
          ) : null}
          {error ? (
            <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">
              {t("draft.error")}
            </Text>
          ) : null}
          {missing ? (
            <Button testID="draft-edit" label={t("draft.complete")} onPress={onEdit} />
          ) : (
            <>
              <Button testID="draft-confirm" label={saving ? t("draft.saving") : t("draft.confirm")} busy={saving} onPress={onConfirm} />
              <Button testID="draft-edit" variant="secondary" label={t("draft.edit")} disabled={saving} onPress={onEdit} />
            </>
          )}
        </VStack>
      )}
    </View>
  );
}
