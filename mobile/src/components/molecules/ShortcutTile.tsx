import { Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { Icon, Text, type IconName } from "../atoms";

export interface ShortcutTileProps {
  icon: IconName;
  /** Etiqueta ya traducida. */
  label: string;
  onPress: () => void;
  /** Sin disponibilidad: se ve atenuado y no responde. */
  disabled?: boolean;
  testID?: string;
}

/** Mismo círculo que `ShortcutRow` de Inicio (52, surface con borde, ícono `tabActive`). */
const CIRCLE = 52;

/** Acceso redondo del Menú: círculo con ícono y etiqueta chica abajo (objetivo táctil ≥ 44). */
export function ShortcutTile({ icon, label, onPress, disabled = false, testID }: ShortcutTileProps) {
  const { colors, radius, space, sizes } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", gap: space[2], opacity: disabled ? 0.4 : pressed ? 0.8 : 1 })}
    >
      <View
        style={{
          width: CIRCLE,
          height: CIRCLE,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
          borderWidth: sizes.hairline,
          borderColor: colors.border,
        }}
      >
        <Icon name={icon} color={colors.tabActive} />
      </View>
      <Text variant="secondaryStrong" align="center" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}
