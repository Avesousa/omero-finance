import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { Icon, Text, type IconName } from "../atoms";
import { AmountCapsule, CategoryBadge } from "../molecules";

export interface FixedExpenseRowProps {
  name: string;
  /** Total del mes, en `currency`. */
  amount: number;
  /** Monto por vez (se muestra si no es mensual). */
  unitAmount: number;
  currency: "ARS" | "USD";
  frequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  /** 0 = domingo … 6 = sábado (semanal). */
  weekday: number | null;
  /** Día del mes en que vence (mensual). */
  dueDay: number | null;
  isDone: boolean;
  /** Ícono y color de su categoría (el mismo color que su tramo en la barra). */
  icon: IconName;
  colorIndex: number;
  /** Solo lectura (mes proyectado): sin edición ni check. */
  readOnly?: boolean;
  /** Tocar la fila: editar. */
  onPress?: () => void;
  /** Tocar el check: marcar pagado / pendiente. */
  onToggle?: () => void;
  /** Mientras se guarda el cambio de pagado. */
  toggling?: boolean;
  testID?: string;
  toggleTestID?: string;
}

/** Fila de un gasto fijo: nombre, cuándo vence, monto y un check grande para marcarlo pagado. */
export function FixedExpenseRow({
  name,
  amount,
  unitAmount,
  currency,
  frequency,
  weekday,
  dueDay,
  isDone,
  icon,
  colorIndex,
  readOnly = false,
  onPress,
  onToggle,
  toggling = false,
  testID,
  toggleTestID,
}: FixedExpenseRowProps) {
  const { t } = useTranslation("fixed");
  const { space, sizes } = useTheme();
  const schedule =
    frequency === "WEEKLY" && weekday != null
      ? t("row.weekly", { weekday: t(`weekdayLong.${weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6}`) })
      : frequency === "BIWEEKLY"
        ? t("row.biweekly")
        : frequency === "DAILY"
          ? t("row.daily")
          : dueDay
            ? t("row.dueOn", { day: dueDay })
            : t("row.monthly");
  const perTime = frequency !== "MONTHLY" ? t("row.perTime", { amount: formatMoney(unitAmount, currency) }) : null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${name}. ${schedule}. ${formatMoney(amount, currency)}`}
        accessibilityHint={readOnly ? undefined : t("row.edit", { name })}
        accessibilityState={{ disabled: readOnly }}
        disabled={readOnly || !onPress}
        onPress={onPress}
        style={({ pressed }) => ({ flex: 1, minHeight: sizes.touch, paddingVertical: space[3], flexDirection: "row", alignItems: "center", gap: space[2], opacity: pressed ? 0.85 : 1 })}
      >
        <CategoryBadge icon={icon} colorIndex={colorIndex} />
        <View style={{ flex: 1, gap: space[1] }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {name}
          </Text>
          <Text variant="secondary" tone="inkMuted">
            {perTime ? `${schedule} · ${perTime}` : schedule}
          </Text>
        </View>
        <AmountCapsule value={amount} staticText={formatMoney(amount, currency)} accessibilityLabel={formatMoney(amount, currency)} />
      </Pressable>
      <Pressable
        testID={toggleTestID}
        accessibilityRole="checkbox"
        accessibilityLabel={isDone ? t("row.markPending", { name }) : t("row.markPaid", { name })}
        accessibilityState={{ checked: isDone, disabled: readOnly || toggling }}
        disabled={readOnly || toggling || !onToggle}
        onPress={onToggle}
        style={({ pressed }) => ({ width: sizes.touch, height: sizes.touch, alignItems: "center", justifyContent: "center", opacity: readOnly ? 0.4 : toggling ? 0.5 : pressed ? 0.8 : 1 })}
      >
        <Icon name={isDone ? "checkmark-circle" : "ellipse-outline"} size="lg" tone={isDone ? "positiveInk" : "inkMuted"} />
      </Pressable>
    </View>
  );
}
