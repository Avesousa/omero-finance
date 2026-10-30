import { View } from "react-native";
import { useTheme } from "../../design-system";
import { formatMoney, formatPercent } from "../../i18n/format";
import { Icon, Text, type TextTone } from "../atoms";

export interface DeltaBadgeProps {
  /** Cambio con signo, en `currency`. */
  amount: number;
  /** Cambio relativo con signo (0.125 = +12,5 %). Si es null/undefined solo se muestra el monto. */
  ratio?: number | null;
  currency?: string;
  /** Qué dirección es buena: en deudas, bajar es bueno (`down`). Default `up`. */
  goodWhen?: "up" | "down";
  /** `sm` para filas de listas. */
  size?: "md" | "sm";
  /** Dentro de una cápsula con fondo `surface`, para usar sobre superficies primarias (héroes). */
  framed?: boolean;
}

/** Variación con flecha y tono: `↗ +$ 279.000 · +12,5 %`. Siempre con signo y flecha, nunca solo color. */
export function DeltaBadge({ amount, ratio, currency = "ARS", goodWhen = "up", size = "md", framed = false }: DeltaBadgeProps) {
  const { colors, radius, space, sizes } = useTheme();
  const rounded = Math.round(amount);
  const direction = rounded === 0 ? "flat" : rounded > 0 ? "up" : "down";
  const good = direction === "flat" ? null : direction === goodWhen;
  const tone: TextTone = good === null ? "inkMuted" : good ? "positiveInk" : "dangerInk";
  const sign = direction === "up" ? "+" : direction === "down" ? "-" : "";
  const icon = direction === "up" ? "trending-up" : direction === "down" ? "trending-down" : "remove";
  const parts = [`${sign}${formatMoney(Math.abs(rounded), currency)}`];
  if (ratio != null && Number.isFinite(ratio)) {
    parts.push(`${ratio > 0 ? "+" : ratio < 0 ? "-" : ""}${formatPercent(Math.abs(ratio), 1)}`);
  }
  const text = parts.join(" · ");
  return (
    <View
      accessible
      accessibilityLabel={text}
      style={[
        { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: space[1] },
        framed
          ? {
              paddingHorizontal: space[3],
              paddingVertical: space[1],
              borderRadius: radius.pill,
              backgroundColor: colors.surface,
              borderWidth: sizes.hairline,
              borderColor: colors.border,
            }
          : null,
      ]}
    >
      <Icon name={icon} size="sm" tone={tone} />
      <Text variant={size === "sm" ? "secondaryStrong" : "bodyStrong"} tone={tone} importantForAccessibility="no">
        {text}
      </Text>
    </View>
  );
}
