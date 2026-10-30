import type { DimensionValue } from "react-native";
import { View } from "react-native";
import { useTheme } from "../../design-system";

export interface SkeletonProps {
  height: number;
  width?: DimensionValue;
  /** `card` (default) usa el radio de tarjeta; `pill` el de píldora; `hero` el del héroe. */
  shape?: "card" | "pill" | "hero";
}

/** Bloque gris de carga (color `border` del tema). Decorativo: el contenedor lleva la etiqueta accesible. */
export function Skeleton({ height, width = "100%", shape = "card" }: SkeletonProps) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ height, width, borderRadius: radius[shape], backgroundColor: colors.border }}
    />
  );
}
