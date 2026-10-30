import { View } from "react-native";
import { useTheme } from "../../design-system";

export interface ProgressBarProps {
  /** Avance 0..1. */
  value: number;
  tone?: "positive" | "primary" | "warning" | "danger";
  accessibilityLabel?: string;
}

/** Barra de progreso de 10px: pista en `border`, relleno en el rol indicado. */
export function ProgressBar({ value, tone = "positive", accessibilityLabel }: ProgressBarProps) {
  const { colors, radius } = useTheme();
  const ratio = Math.min(1, Math.max(0, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={{ height: 10, borderRadius: radius.pill, backgroundColor: colors.border, overflow: "hidden" }}
    >
      <View style={{ width: `${ratio * 100}%`, height: 10, borderRadius: radius.pill, backgroundColor: colors[tone] }} />
    </View>
  );
}
