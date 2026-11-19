import { Pressable, View } from "react-native";
import { Text } from "../atoms";

/** Rótulo de sección en mayúsculas chicas («CUENTAS · 4») con un enlace opcional a la derecha («Ver todas»). */
export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text variant="label" tone="inkMuted" accessibilityRole="header">{title}</Text>
      {action ? (
        <Pressable accessibilityRole="link" accessibilityLabel={action.label} onPress={action.onPress} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text variant="bodyStrong" tone="primary">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
