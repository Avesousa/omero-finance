import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { Surface, Text, VStack } from "../atoms";
import { AllocationBar, type AllocationSegment } from "../molecules";

/** Tamaño fijo de los dos montos: entra "$ 100.000.000" en cada mitad. */
const AMOUNT_STYLE = { fontSize: 19, lineHeight: 24 };

export interface AllocationSummaryProps {
  /** Disponible: los ingresos del mes. */
  available: number;
  /** Por asignar: lo que queda sin destino. Negativo = asignaste de más. */
  unassigned: number;
  segments: readonly AllocationSegment[];
  testID?: string;
}

/** Tarjeta de "armar el presupuesto": Disponible a la izquierda, Por asignar a la derecha (en rojo y con aviso si te pasaste) y la barra apilada por categoría con su leyenda. */
export function AllocationSummary({ available, unassigned, segments, testID = "budget-hero" }: AllocationSummaryProps) {
  const { t } = useTranslation("budget");
  const { radius, colors, space } = useTheme();
  const over = Math.round(unassigned) < 0;
  const rest = Math.max(0, Math.round(unassigned));
  return (
    <Surface testID={testID}>
      <VStack gap={4}>
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <View style={{ flex: 1, gap: space[1] }}>
            <Text variant="secondarySemi" tone="inkMuted">
              {t("hero.available")}
            </Text>
            <Text testID="budget-available-amount" variant="screenTitle" style={AMOUNT_STYLE}>
              {formatMoney(available)}
            </Text>
          </View>
          <View style={{ flex: 1, gap: space[1], alignItems: "flex-end" }}>
            <Text variant="secondarySemi" tone="inkMuted">
              {t("hero.toAssign")}
            </Text>
            <Text testID="budget-hero-amount" variant="screenTitle" tone={over ? "dangerInk" : "ink"} align="right" style={AMOUNT_STYLE}>
              {formatMoney(unassigned)}
            </Text>
            {over ? (
              <View
                testID="budget-hero-over"
                style={{ backgroundColor: colors.dangerTint, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1] }}
              >
                <Text variant="secondaryStrong" tone="dangerInk">
                  {t("hero.over")}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <AllocationBar testID="budget-allocation" segments={segments} remainder={{ label: t("hero.unassignedLegend"), value: rest }} />
      </VStack>
    </Surface>
  );
}
