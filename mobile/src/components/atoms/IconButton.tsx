import { Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { Badge } from "./Badge";
import { Icon, type IconName } from "./Icon";

export interface IconButtonProps {
  icon: IconName;
  /** Obligatoria: el botón no tiene texto visible. */
  accessibilityLabel: string;
  onPress?: () => void;
  /** Globo numérico en la esquina (se oculta si es 0). */
  badge?: number;
  /** Deshabilitado: atenuado y sin respuesta al toque. */
  disabled?: boolean;
  testID?: string;
}

/** Botón redondo de 44px con un ícono (ej. la campana del encabezado). */
export function IconButton({ icon, accessibilityLabel, onPress, badge = 0, disabled = false, testID }: IconButtonProps) {
  const { colors, radius, sizes } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: sizes.touch,
        height: sizes.touch,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: sizes.hairline,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      <Icon name={icon} />
      {badge > 0 ? (
        <View style={{ position: "absolute", top: -4, right: -4 }}>
          <Badge count={badge} />
        </View>
      ) : null}
    </Pressable>
  );
}
