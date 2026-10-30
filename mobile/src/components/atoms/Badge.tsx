import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "./Text";

export interface BadgeProps {
  count: number;
  /** Tope visible (default 99 → "99+"). */
  max?: number;
}

/** Globo numérico de pendientes: relleno danger con número en on-warning. No se dibuja si `count` es 0. */
export function Badge({ count, max = 99 }: BadgeProps) {
  const { colors, sizes, radius, space } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        minWidth: sizes.badge,
        height: sizes.badge,
        paddingHorizontal: space[1],
        borderRadius: radius.pill,
        backgroundColor: colors.danger,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text variant="label" tone="onWarning" style={{ letterSpacing: 0 }}>
        {count > max ? `${max}+` : String(count)}
      </Text>
    </View>
  );
}
