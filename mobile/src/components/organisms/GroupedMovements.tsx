import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "../atoms";

export interface MovementItem {
  key: string;
  ico: string;
  name: string;
  meta: string;
  /** Monto ya formateado con su signo. */
  amount: string;
  positive?: boolean;
  /** Etiqueta chica de la finanza y su color. */
  fin?: string;
  finDot?: string;
  muted?: boolean;
}
export interface MovementGroup { key: string; title: string; items: MovementItem[] }

/** Movimientos agrupados por día: título del día y una tarjeta con sus filas (sigla, nombre, detalle, monto y finanza). */
export function GroupedMovements({ groups }: { groups: MovementGroup[] }) {
  const { colors, radius, space, sizes } = useTheme();
  return (
    <View style={{ gap: space[4] }}>
      {groups.map((g) => (
        <View key={g.key} style={{ gap: space[2] }}>
          {g.title ? <Text variant="secondaryStrong" tone="inkMuted">{g.title}</Text> : null}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: sizes.hairline, borderColor: colors.border, paddingHorizontal: space[4], paddingVertical: 4 }}>
            {g.items.map((m, i) => (
              <View key={m.key} style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3], borderBottomWidth: i === g.items.length - 1 ? 0 : sizes.hairline, borderBottomColor: colors.border }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
                  <Text variant="secondaryStrong">{m.ico}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" tone={m.muted ? "inkMuted" : "ink"} numberOfLines={1}>{m.name}</Text>
                  <Text variant="secondary" tone="inkMuted" numberOfLines={1}>{m.meta}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text variant="bodyStrong" tone={m.positive ? "positiveInk" : "ink"} style={{ fontSize: 16, fontVariant: ["tabular-nums"] }}>{m.amount}</Text>
                  {m.fin ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.bg }}>
                      {m.finDot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.finDot }} /> : null}
                      <Text variant="label" numberOfLines={1}>{m.fin}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
