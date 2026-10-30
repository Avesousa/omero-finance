import { Pressable } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "./Text";

export interface ChipProps {
  label: string;
  /** Estado activo: relleno accent con texto on-accent (y `selected` para lectores de pantalla). */
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

/** Píldora para filtrar o elegir una opción corta (44px de alto). */
export function Chip({ label, active = false, onPress, disabled }: ChipProps) {
  const { colors, radius, space, sizes } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: sizes.touch,
        paddingHorizontal: space[4],
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.accent : colors.surface,
        borderWidth: sizes.hairline,
        borderColor: active ? colors.accent : colors.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text variant="bodyStrong" tone={active ? "onAccent" : "ink"}>
        {label}
      </Text>
    </Pressable>
  );
}
