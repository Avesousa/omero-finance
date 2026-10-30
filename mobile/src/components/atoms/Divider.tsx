import { View } from "react-native";
import { useTheme } from "../../design-system";

/** Línea de 1px en `border`. */
export function Divider() {
  const { colors, sizes } = useTheme();
  return <View accessibilityElementsHidden importantForAccessibility="no" style={{ height: sizes.hairline, backgroundColor: colors.border }} />;
}
