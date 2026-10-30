import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "../atoms";

export interface MiniBarDatum {
  key: string;
  /** Etiqueta bajo la barra (corta: "nov"). */
  label: string;
  value: number;
}

export interface MiniBarChartProps {
  data: readonly MiniBarDatum[];
  /** Clave de la barra resaltada (muestra su valor arriba). */
  highlightKey?: string;
  /** Formatea el valor (accesibilidad y barra resaltada). Default: el número tal cual. */
  formatValue?: (value: number) => string;
  /** Alto del área de barras, incluida la fila del valor (default 4 × space[8]). */
  height?: number;
}

/** Gráfico de barras verticales simple (solo View). Barras tenues; la resaltada usa `chartHighlight`. */
export function MiniBarChart({
  data,
  highlightKey,
  formatValue = String,
  height,
}: MiniBarChartProps) {
  const { colors, space, sizes } = useTheme();
  const area = height ?? space[8] * 4;
  const max = Math.max(0, ...data.map((d) => d.value));
  const barArea = area;
  const highlightedItem = data.find((d) => d.key === highlightKey);
  return (
    <View style={{ gap: space[1] }}>
      {highlightedItem ? (
        // El valor resaltado va arriba a la derecha, sobre todo el ancho: nunca se corta.
        <Text variant="secondaryStrong" align="right" numberOfLines={1}>
          {`${highlightedItem.label} · ${formatValue(highlightedItem.value)}`}
        </Text>
      ) : null}
      <View
        style={{ flexDirection: "row", alignItems: "flex-end", gap: space[2] }}
      >
        {data.map((d) => {
          const highlighted = d.key === highlightKey;
          const ratio = max > 0 ? Math.max(0, d.value) / max : 0;
          const barHeight = Math.max(space[1], Math.round(barArea * ratio));
          return (
            <View
              key={d.key}
              accessible
              accessibilityLabel={`${d.label}: ${formatValue(d.value)}`}
              style={{ flex: 1, alignItems: "center", gap: space[1] }}
            >
              <View
                style={{
                  height: area,
                  alignSelf: "stretch",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                <View
                  style={{
                    width: "100%",
                    maxWidth: sizes.touch,
                    height: barHeight,
                    borderTopLeftRadius: space[2],
                    borderTopRightRadius: space[2],
                    backgroundColor: highlighted
                      ? colors.chartHighlight
                      : colors.chartBar,
                  }}
                />
              </View>
              <Text
                variant="secondarySemi"
                tone={highlighted ? "ink" : "inkMuted"}
                importantForAccessibility="no"
              >
                {d.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
