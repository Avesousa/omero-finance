import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { capitalize, formatDate, formatPeriod } from "../../i18n/format";
import { Icon, IconButton, Text, hitSlopFor } from "../atoms";

export interface PeriodSwitcherProps {
  /** Período mostrado, 'YYYY-MM'. */
  period: string;
  onChange: (period: string) => void;
  /** Primer período permitido (inclusive). */
  min?: string;
  /** Último período permitido (inclusive). */
  max?: string;
  /** Versión chica para el encabezado: `‹ Nov 2026 ›` en una píldora, sin ocupar una fila propia. */
  compact?: boolean;
}

function shift(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Selector de mes: `‹ Noviembre 2026 ›`. Las flechas se deshabilitan en `min` / `max`. */
export function PeriodSwitcher({ period, onChange, min, max, compact }: PeriodSwitcherProps) {
  const { t } = useTranslation();
  const { colors, radius, space, sizes } = useTheme();
  const prev = shift(period, -1);
  const next = shift(period, 1);
  if (compact) {
    const arrow = (icon: "chevron-back" | "chevron-forward", label: string, disabled: boolean, to: string) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => onChange(to)} hitSlop={hitSlopFor(28)} style={{ width: 28, height: sizes.touch, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}>
        <Icon name={icon} size="sm" />
      </Pressable>
    );
    return (
      <View testID="period-switcher" style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", borderRadius: radius.pill, borderWidth: sizes.hairline, borderColor: colors.border, backgroundColor: colors.surface }}>
        {arrow("chevron-back", t("period.prev"), min !== undefined && prev < min, prev)}
        <Text variant="bodyStrong" accessibilityLiveRegion="polite" style={{ minWidth: 72, textAlign: "center" }}>{capitalize(formatDate(period, "monthYearShort").replace(".", ""))}</Text>
        {arrow("chevron-forward", t("period.next"), max !== undefined && next > max, next)}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
      <IconButton
        icon="chevron-back"
        accessibilityLabel={t("period.prev")}
        disabled={min !== undefined && prev < min}
        onPress={() => onChange(prev)}
      />
      <Text variant="cardTitle" align="center" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
        {capitalize(formatPeriod(period))}
      </Text>
      <IconButton
        icon="chevron-forward"
        accessibilityLabel={t("period.next")}
        disabled={max !== undefined && next > max}
        onPress={() => onChange(next)}
      />
    </View>
  );
}
