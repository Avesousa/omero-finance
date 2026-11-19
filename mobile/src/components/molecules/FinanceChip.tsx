import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Icon, Text } from "../atoms";

/** Etiqueta discreta de la finanza a la que pertenece algo: casita + nombre en una píldora. */
export function FinanceChip({ name }: { name: string }) {
  const { colors, radius, space, sizes } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Finanza: ${name}`}
      style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: space[1], paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: sizes.hairline, borderColor: colors.border }}
    >
      <Icon name="home-outline" size="sm" tone="inkMuted" />
      <Text variant="secondaryStrong" tone="inkMuted" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
    </View>
  );
}
