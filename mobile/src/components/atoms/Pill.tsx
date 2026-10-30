import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "./Text";

export interface PillProps {
  label: string;
  /** `warning`/`danger`: relleno con texto on-warning. `accent`: relleno accent. `positive`: borde positivo con texto positive-ink. `neutral`: surface + borde. */
  tone?: "neutral" | "warning" | "danger" | "accent" | "positive";
}

/** Píldora de estado ("Sin monto", "Pagado"). Siempre con palabra, nunca solo color. */
export function Pill({ label, tone = "neutral" }: PillProps) {
  const { colors, radius, space, sizes } = useTheme();
  const look = {
    neutral: { bg: colors.surface, border: colors.border, text: "ink" },
    warning: { bg: colors.warning, border: colors.warning, text: "onWarning" },
    danger: { bg: colors.danger, border: colors.danger, text: "onWarning" },
    accent: { bg: colors.accent, border: colors.accent, text: "onAccent" },
    positive: { bg: colors.surface, border: colors.positive, text: "positiveInk" },
  }[tone] as { bg: string; border: string; text: "ink" | "onWarning" | "onAccent" | "positiveInk" };
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: space[3],
        paddingVertical: space[1],
        borderRadius: radius.pill,
        borderWidth: sizes.hairline,
        borderColor: look.border,
        backgroundColor: look.bg,
      }}
    >
      <Text variant="secondaryStrong" tone={look.text}>
        {label}
      </Text>
    </View>
  );
}
