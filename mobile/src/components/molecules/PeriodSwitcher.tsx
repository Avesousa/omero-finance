import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useTheme } from "../../design-system";
import { capitalize, formatPeriod } from "../../i18n/format";
import { IconButton, Text } from "../atoms";

export interface PeriodSwitcherProps {
  /** Período mostrado, 'YYYY-MM'. */
  period: string;
  onChange: (period: string) => void;
  /** Primer período permitido (inclusive). */
  min?: string;
  /** Último período permitido (inclusive). */
  max?: string;
}

function shift(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Selector de mes: `‹ Noviembre 2026 ›`. Las flechas se deshabilitan en `min` / `max`. */
export function PeriodSwitcher({ period, onChange, min, max }: PeriodSwitcherProps) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const prev = shift(period, -1);
  const next = shift(period, 1);
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
