import { Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { Icon, InitialsTile, Text } from "../atoms";

/** Cuenta en el carrusel de Plata: sigla de color, moneda, nombre y saldo. 156×152. */
export function AccountTile({ name, balance, currency, color, initials, onPress }: { name: string; balance: string; currency: string; color: string; initials: string; onPress: () => void }) {
  const { colors, radius, space, sizes } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${currency}, ${balance}`} onPress={onPress} style={({ pressed }) => ({ width: 156, height: 152, padding: space[4], justifyContent: "space-between", borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: sizes.hairline, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <InitialsTile color={color} initials={initials} size={36} />
        <Text variant="label" tone="inkMuted">{currency}</Text>
      </View>
      <View>
        <Text variant="bodyStrong" numberOfLines={1}>{name}</Text>
        <Text variant="money" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{balance}</Text>
      </View>
    </Pressable>
  );
}

/** «Agregar cuenta»: la misma altura, con borde de línea cortada. */
export function AddTile({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ width: 120, height: 152, padding: space[4], alignItems: "center", justifyContent: "center", gap: space[2], borderRadius: radius.card, borderWidth: 2, borderStyle: "dashed", borderColor: colors.border, opacity: pressed ? 0.8 : 1 })}>
      <Icon name="add" tone="inkMuted" />
      <Text variant="bodyStrong" tone="inkMuted" align="center">{label}</Text>
    </Pressable>
  );
}
