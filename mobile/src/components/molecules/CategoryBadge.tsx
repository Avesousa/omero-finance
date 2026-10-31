import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Icon, type IconName } from "../atoms";
import { readableOn } from "./allocationColors";

export interface CategoryBadgeProps {
  icon: IconName;
  /** Posición en `colors.chartCategorical` (el mismo `categoryColorIndex` que usa la `AllocationBar`). */
  colorIndex: number;
  /** Lado en px. Default 40. */
  size?: number;
}

/** Ícono de una categoría en un cuadrado redondeado con el color de su tramo en la barra; el ícono es claro u oscuro según el contraste. */
export function CategoryBadge({ icon, colorIndex, size = 40 }: CategoryBadgeProps) {
  const { colors, radius } = useTheme();
  const palette = colors.chartCategorical;
  const background = palette[((colorIndex % palette.length) + palette.length) % palette.length];
  const ink = readableOn(background, [colors.ink, colors.surface]);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: radius.input - 4, backgroundColor: background, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name={icon} size="sm" color={ink} />
    </View>
  );
}
