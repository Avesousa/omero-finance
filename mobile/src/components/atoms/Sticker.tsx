import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "./Text";

export interface StickerProps {
  /** Texto ya en mayúsculas ("A FUEGO"). */
  label: string;
}

/**
 * Etiqueta sticker rotada -4deg. Solo existe en Atrevido (en Tranqui no se dibuja), una por
 * pantalla como máximo, y nunca lleva información crítica (se oculta a lectores de pantalla).
 * Posicionarla desde afuera (ej. `position: absolute` en el héroe).
 */
export function Sticker({ label }: StickerProps) {
  const { bold, colors, radius, space } = useTheme();
  if (!bold) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        alignSelf: "flex-start",
        transform: [{ rotate: "-4deg" }],
        paddingHorizontal: 11,
        paddingVertical: space[1] + 1,
        borderRadius: space[2],
        backgroundColor: colors.accent,
      }}
    >
      <Text variant="sticker" tone="onAccent">
        {label}
      </Text>
    </View>
  );
}
