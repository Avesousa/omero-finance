import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "../atoms";

export interface LegendItemProps {
  /** Color del cuadradito (un valor de `theme.colors.chart`). */
  color: string;
  label: string;
  /** Valor ya formateado (ej. `formatMoney(550000)`). */
  value: string;
  /** Dibuja el cuadradito con contorno (para el tramo "Otros", cuyo color es muy claro). */
  outlined?: boolean;
}

/** Fila de leyenda de gráfico: cuadradito de color, etiqueta y valor (20px de alto). */
export function LegendItem({ color, label, value, outlined }: LegendItemProps) {
  const { colors, space } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 20 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          backgroundColor: color,
          borderWidth: outlined ? 1 : 0,
          borderColor: colors.chartOutline,
        }}
      />
      <Text variant="secondarySemi" tone="inkMuted" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="secondaryStrong">{value}</Text>
    </View>
  );
}
