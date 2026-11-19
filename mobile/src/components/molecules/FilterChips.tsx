import { Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "../atoms";

export interface FilterChipOption { id: string; label: string; dot?: string }

/** Filtros en fila (Todo / Personal / Hogar): 36px, el elegido en accent. Si no entran, bajan a otra línea. */
export function FilterChips({ options, value, onChange, accessibilityLabel }: { options: readonly FilterChipOption[]; value: string; onChange: (id: string) => void; accessibilityLabel: string }) {
  const { colors, radius, space, sizes } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={o.label} accessibilityState={{ selected: on }} onPress={() => onChange(o.id)} hitSlop={{ top: 4, bottom: 4 }} style={{ minHeight: 36, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: space[1] + 2, borderRadius: radius.pill, backgroundColor: on ? colors.accent : colors.surface, borderWidth: sizes.hairline, borderColor: on ? colors.accent : colors.border }}>
            {o.dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: o.dot }} /> : null}
            <Text variant="bodyStrong" tone={on ? "onAccent" : "ink"}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
