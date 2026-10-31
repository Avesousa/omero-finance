import { View } from "react-native";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { Text } from "../atoms";

export interface AllocationSegment {
  key: string;
  label: string;
  /** Peso del tramo (el monto). Los de valor 0 o negativo no se dibujan ni entran en la leyenda. */
  value: number;
  /** Posición en `theme.colors.chartCategorical` (ver `categoryColorIndex`); da la vuelta si se pasa de 8. */
  colorIndex: number;
  /** `other`: tramo gris medio de "Otras" (ignora `colorIndex`). */
  tone?: "other";
}

export interface AllocationBarProps {
  segments: readonly AllocationSegment[];
  /** "Sin asignar": tramo gris al final (solo si `value > 0`). */
  remainder?: { label: string; value: number };
  /** Muestra el monto junto a cada etiqueta de la leyenda. Default false. */
  showValues?: boolean;
  /** Si lo pasás, la barra completa se anuncia con esta frase; sin esto la barra es decorativa y la leyenda lleva el texto. */
  accessibilityLabel?: string;
  testID?: string;
}

const BAR_HEIGHT = 12;
const GAP = 3;
const DOT = 10;
const MIN_SEGMENT = 8;

/**
 * Barra apilada por categoría: cápsulas redondeadas separadas por un hueco chico, proporcionales al monto,
 * con colores de la paleta categórica del tema, y debajo una leyenda con puntos de color que se acomoda en varias
 * líneas. Genérica: la usan Presupuesto y Gastos fijos.
 */
export function AllocationBar({ segments, remainder, showValues = false, accessibilityLabel, testID }: AllocationBarProps) {
  const { colors, radius, space } = useTheme();
  const palette = colors.chartCategorical;
  const visible = segments.filter((s) => s.value > 0);
  const rest = remainder && remainder.value > 0 ? remainder : null;
  const legend = [
    ...visible.map((s) => ({ key: s.key, label: s.label, value: s.value, color: s.tone === "other" ? colors.chartOther : palette[((s.colorIndex % palette.length) + palette.length) % palette.length] })),
    ...(rest ? [{ key: "__remainder", label: rest.label, value: rest.value, color: colors.chartUnassigned }] : []),
  ];

  return (
    <View testID={testID} style={{ gap: space[3] }}>
      <View
        accessible={!!accessibilityLabel}
        accessibilityRole={accessibilityLabel ? "image" : undefined}
        accessibilityLabel={accessibilityLabel}
        importantForAccessibility={accessibilityLabel ? "yes" : "no-hide-descendants"}
        style={{ flexDirection: "row", gap: GAP, height: BAR_HEIGHT, borderRadius: radius.pill, backgroundColor: legend.length === 0 ? colors.border : undefined }}
      >
        {legend.map((item) => (
          <View
            key={item.key}
            testID={testID ? `${testID}-segment-${item.key}` : undefined}
            style={{ flexGrow: item.value, flexShrink: 1, flexBasis: 0, minWidth: MIN_SEGMENT, borderRadius: radius.pill, backgroundColor: item.color }}
          />
        ))}
      </View>
      {legend.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space[4], rowGap: space[2] }}>
          {legend.map((item) => (
            <View key={item.key} style={{ flexDirection: "row", alignItems: "center", gap: space[2], maxWidth: "100%" }}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={{ width: DOT, height: DOT, borderRadius: radius.pill, backgroundColor: item.color }}
              />
              <Text variant="secondarySemi" tone="inkMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
                {showValues ? `${item.label} ${formatMoney(item.value)}` : item.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
