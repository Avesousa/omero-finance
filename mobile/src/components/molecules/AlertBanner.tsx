import { Pressable } from "react-native";
import { useTheme } from "../../design-system";
import { Icon, Text } from "../atoms";
import type { IconName } from "../atoms";

export interface AlertBannerProps {
  text: string;
  onPress?: () => void;
  icon?: IconName;
  testID?: string;
}

/** Aviso que pide una acción (ej. "2 pagos con Apple Pay por confirmar"). Fondo danger-tint, texto danger-ink. */
export function AlertBanner({ text, onPress, icon = "alert-circle-outline", testID }: AlertBannerProps) {
  const { colors, radius, space, sizes } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: sizes.touch,
        flexDirection: "row",
        alignItems: "center",
        gap: space[2] + 2,
        paddingVertical: space[2] + 2,
        paddingHorizontal: space[4] - 2,
        borderRadius: radius.button,
        backgroundColor: colors.dangerTint,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name={icon} tone="dangerInk" />
      <Text variant="secondaryStrong" tone="dangerInk" style={{ flex: 1 }}>
        {text}
      </Text>
      <Icon name="chevron-forward" size="sm" tone="dangerInk" />
    </Pressable>
  );
}
