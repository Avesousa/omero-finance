import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatDate, formatMoney } from "../../i18n/format";
import { Icon, Text } from "../atoms";

export interface MovementRowProps {
  kind: "INCOME" | "EXPENSE";
  name: string;
  /** null = "Sin categoría". */
  categoryName: string | null;
  amount: number;
  currency: "ARS" | "USD";
  /** Viene de una regla: muestra "fijo". */
  fixed?: boolean;
  /** Cuota de un préstamo: muestra "cuota". */
  installment?: boolean;
  /** Fijos y cuotas: muestra pagado / pendiente (cobrado / por cobrar en ingresos). */
  hasStatus?: boolean;
  isDone?: boolean;
  /** En "Próximos": 'YYYY-MM-DD' de vencimiento, se muestra como "vence el 08/11". */
  dueDate?: string | null;
  /** Propuesta de un mes que no empezó: se ve atenuada y no se abre. */
  proposed?: boolean;
  onPress?: () => void;
  testID?: string;
}

/**
 * Fila de un movimiento: ícono redondo por tipo (ingreso: flecha arriba, positive; gasto: flecha abajo, danger),
 * nombre, "categoría · fijo/cuota · estado" y el monto (los ingresos con `+`). Tocarla abre su edición.
 */
export function MovementRow({
  kind,
  name,
  categoryName,
  amount,
  currency,
  fixed = false,
  installment = false,
  hasStatus = false,
  isDone = false,
  proposed = false,
  dueDate = null,
  onPress,
  testID,
}: MovementRowProps) {
  const { t } = useTranslation("movements");
  const { colors, space, sizes } = useTheme();
  const income = kind === "INCOME";
  const status = hasStatus
    ? income
      ? isDone ? t("row.collected") : t("row.toCollect")
      : isDone ? t("row.paid") : t("row.pending")
    : null;
  const parts = [categoryName ?? t("row.uncategorized"), dueDate ? t("row.due", { date: formatDate(dueDate, "short") }) : null, fixed ? t("row.fixed") : installment ? t("row.installment") : null, proposed ? t("row.proposed") : status];
  const subtitle = parts.filter(Boolean).join(" · ");
  const money = formatMoney(amount, currency);
  const shown = income ? `+${money}` : money;
  const edgeColor = income ? colors.positive : colors.danger;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${income ? t("row.income") : t("row.expense")}: ${name}. ${subtitle}. ${shown}`}
      accessibilityHint={proposed ? undefined : installment ? t("row.installmentHint") : t("row.edit", { name })}
      accessibilityState={{ disabled: proposed }}
      disabled={proposed || !onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: sizes.touch,
        paddingVertical: space[3],
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        opacity: proposed ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: sizes.touch,
          height: sizes.touch,
          borderRadius: sizes.touch / 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: sizes.ring,
          borderColor: edgeColor,
          backgroundColor: colors.surface,
        }}
      >
        <Icon name={income ? "arrow-up" : "arrow-down"} tone={income ? "positiveInk" : "dangerInk"} />
      </View>
      <View style={{ flex: 1, gap: space[1] }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {name}
        </Text>
        <Text variant="secondary" tone="inkMuted" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Text variant="numberSmall" tone={income ? "positiveInk" : "ink"}>
        {shown}
      </Text>
    </Pressable>
  );
}
