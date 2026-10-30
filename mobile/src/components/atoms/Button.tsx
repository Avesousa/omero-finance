import { ActivityIndicator, Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  /** `primary` (una por vista), `secondary` (borde primary) o `text` (subrayado, acciones menores). */
  variant?: "primary" | "secondary" | "text";
  icon?: IconName;
  disabled?: boolean;
  /** Muestra un indicador y bloquea el toque. */
  busy?: boolean;
  /** Ocupa todo el ancho (default true en primary/secondary). */
  fullWidth?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

/** Botón de acción del DS: 52px de alto, radio button, etiqueta en `bodyStrong`. */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  busy,
  fullWidth = variant !== "text",
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, radius, space, sizes } = useTheme();
  const inactive = disabled || busy;
  const tone = variant === "primary" ? "onPrimary" : "ink";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: variant === "text" ? sizes.touch : sizes.button,
          paddingHorizontal: space[6],
          borderRadius: radius.button,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: space[2],
          alignSelf: fullWidth ? "stretch" : "flex-start",
          backgroundColor: variant === "primary" ? colors.primary : "transparent",
          borderWidth: variant === "secondary" ? 2 : 0,
          borderColor: colors.primary,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? colors.onPrimary : colors.ink} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          {icon ? <Icon name={icon} size="sm" tone={tone} /> : null}
          <Text variant="bodyStrong" tone={tone} style={variant === "text" ? { textDecorationLine: "underline" } : undefined}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
