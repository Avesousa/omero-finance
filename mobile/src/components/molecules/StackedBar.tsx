import { View } from "react-native";
import { useTheme } from "../../design-system";

export interface StackedBarSegment {
  /** Peso relativo del tramo (ej. el monto). */
  value: number;
  color: string;
}

export interface StackedBarProps {
  segments: readonly StackedBarSegment[];
  accessibilityLabel?: string;
}

/** Barra apilada de 14px con tramos proporcionales separados por 2px. Decorativa salvo que se le dé etiqueta. */
export function StackedBar({ segments, accessibilityLabel }: StackedBarProps) {
  const { radius } = useTheme();
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: "row", gap: 2, height: 14, borderRadius: radius.pill, overflow: "hidden" }}
    >
      {segments
        .filter((s) => s.value > 0)
        .map((s, i) => (
          <View key={i} style={{ flex: s.value, backgroundColor: s.color }} />
        ))}
    </View>
  );
}
