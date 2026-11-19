import { Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { Icon, Text, type IconName } from "../atoms";

export interface ActionCircleProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** `solid`: círculo relleno primary (la acción principal). `outline`: blanco con borde. */
  emphasis?: "solid" | "outline";
  testID?: string;
}

/** Acción rápida en círculo de 56px con su rótulo debajo. Una principal (`solid`) por fila. */
export function ActionCircle({ icon, label, onPress, disabled, emphasis = "outline", testID }: ActionCircleProps) {
  const { colors, space, sizes } = useTheme();
  const solid = emphasis === "solid";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, alignItems: "center", gap: space[2], opacity: disabled ? 0.45 : pressed ? 0.8 : 1 })}
    >
      <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: solid ? colors.primary : colors.surface, borderWidth: solid ? 0 : sizes.hairline, borderColor: colors.border }}>
        <Icon name={icon} tone={solid ? "onPrimary" : "ink"} />
      </View>
      <Text variant="secondaryStrong" align="center" numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}
