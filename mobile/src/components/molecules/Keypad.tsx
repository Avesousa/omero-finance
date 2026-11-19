import { Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { Icon, Text } from "../atoms";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"] as const;

/** Teclado numérico propio (1–9, 000, 0, borrar) para pantallas donde el monto es el protagonista. */
export function Keypad({ onDigit, onDelete }: { onDigit: (d: string) => void; onDelete: () => void }) {
  const { colors, radius, space } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          accessibilityRole="button"
          accessibilityLabel={k === "del" ? "Borrar" : k}
          onPress={() => (k === "del" ? onDelete() : onDigit(k))}
          style={({ pressed }) => ({ width: "31.8%", height: 50, borderRadius: radius.input, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 })}
        >
          {k === "del" ? <Icon name="backspace-outline" /> : <Text variant="cardTitle" style={{ fontSize: 22, lineHeight: 28 }}>{k}</Text>}
        </Pressable>
      ))}
    </View>
  );
}
