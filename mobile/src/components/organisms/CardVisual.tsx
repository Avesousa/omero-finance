import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { palette } from "../../design-system/tokens/palette";
import { useTheme } from "../../design-system";
import { BrandMark, Icon, Text, bankColor, hitSlopFor, type IconName } from "../atoms";

export interface CardVisualProps {
  /** Banco emisor (define el color). Sin banco conocido, queda negro. */
  bank?: string | null;
  /** Red: VISA, MC, AMEX… */
  network?: string | null;
  /** Titular, o la leyenda inferior. */
  holder?: string | null;
  /** Línea chica sobre el monto («A pagar · Noviembre»). */
  caption: string;
  /** Monto ya formateado. */
  amount: string;
  /** Texto de arriba a la izquierda (nombre del banco o «Todas las tarjetas»). */
  title: string;
  /** Color de fondo de la vista `aggregate` (por defecto el primary del tema). */
  color?: string;
  /** Vista que suma todas las tarjetas: usa el color de la marca y un ícono en vez de la red. */
  aggregate?: boolean;
  /** Botones en círculo arriba a la derecha (p. ej. «+» para agregar, flecha para ir al detalle). Solo en la vista `aggregate`. */
  actions?: { icon: IconName; label: string; onPress: () => void; testID?: string }[];
  width: number;
  testID?: string;
}

/** Tarjeta de crédito dibujada: color del banco, ondas translúcidas, red y monto. Texto siempre blanco sobre fondo oscurecido. */
export function CardVisual({ bank, network, holder, caption, amount, title, aggregate, color, actions, width, testID }: CardVisualProps) {
  const { colors, radius, space } = useTheme();
  const base = aggregate ? color ?? colors.primary : bankColor(bank) ?? palette.black;
  return (
    <View testID={testID} accessible accessibilityLabel={`${title}. ${caption}: ${amount}`} style={{ width, height: 176, borderRadius: radius.hero, overflow: "hidden", backgroundColor: base }}>
      <LinearGradient colors={[palette.clear, palette.shade]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: "absolute", right: -60, top: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: palette.glass }} />
      <View style={{ position: "absolute", left: -40, bottom: -90, width: 220, height: 220, borderRadius: 110, backgroundColor: palette.glass }} />
      <View style={{ flex: 1, padding: space[5], justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
          <Text variant="cardTitle" numberOfLines={1} style={{ color: palette.white, flex: 1 }}>{title}</Text>
          {aggregate ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              {actions?.length ? actions.map((a) => (
                <Pressable key={a.label} testID={a.testID} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} hitSlop={hitSlopFor(36)} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.glass, opacity: pressed ? 0.7 : 1 })}>
                  <Icon name={a.icon} size="sm" color={palette.white} />
                </Pressable>
              )) : <Icon name="layers-outline" color={palette.white} />}
            </View>
          ) : <BrandMark brand={network} size={22} />}
        </View>
        <View>
          <Text variant="secondaryStrong" style={{ color: palette.white, opacity: 0.85 }}>{caption}</Text>
          <Text variant="heroBalance" numberOfLines={1} adjustsFontSizeToFit style={{ color: palette.white }}>{amount}</Text>
        </View>
        {holder ? <Text variant="secondaryStrong" numberOfLines={2} style={{ color: palette.white, opacity: 0.85 }}>{holder}</Text> : null}
      </View>
    </View>
  );
}
