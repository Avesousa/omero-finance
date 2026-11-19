import { View } from "react-native";
import { palette } from "../../design-system/tokens/palette";
import { useTheme } from "../../design-system";
import { Text } from "./Text";

/** Cuadrado redondeado de color con la sigla del banco o cuenta («MP», «US$», «EF»). */
export function InitialsTile({ color, initials, size = 40 }: { color: string; initials: string; size?: number }) {
  const { radius } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: radius.input * (size / 56) + 2, alignItems: "center", justifyContent: "center", backgroundColor: color }}>
      <Text variant="secondaryStrong" style={{ color: palette.white, fontSize: initials.length > 2 ? size * 0.28 : size * 0.34, lineHeight: size * 0.45 }}>{initials}</Text>
    </View>
  );
}
