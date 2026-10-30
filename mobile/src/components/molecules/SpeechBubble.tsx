import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "../atoms";

export interface SpeechBubbleProps {
  /** Una sola frase corta. */
  text: string;
}

/** Burbuja de la mascota: esquinas 18 con la inferior izquierda en 6 (cola hacia la mascota). */
export function SpeechBubble({ text }: SpeechBubbleProps) {
  const { colors, radius, space, sizes } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: space[3],
        paddingHorizontal: space[4] - 2,
        borderRadius: radius.button,
        borderBottomLeftRadius: 6,
        backgroundColor: colors.surface,
        borderWidth: sizes.hairline,
        borderColor: colors.border,
      }}
    >
      <Text variant="bodySemi" style={{ lineHeight: 20 }}>
        {text}
      </Text>
    </View>
  );
}
