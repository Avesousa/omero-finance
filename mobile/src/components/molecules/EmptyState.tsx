import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Button, Text } from "../atoms";
import { MascotAvatar } from "./MascotAvatar";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Muestra la mascota elegida en calma (default true). */
  mascot?: boolean;
  action?: { label: string; onPress: () => void };
}

/** Estado vacío / "próximamente": mascota en calma, título, texto y una acción opcional. */
export function EmptyState({ title, description, mascot = true, action }: EmptyStateProps) {
  const { space } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: space[3], paddingVertical: space[6], paddingHorizontal: space[4] }}>
      {mascot ? <MascotAvatar size={56} mood="calma" /> : null}
      <Text variant="cardTitle" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="inkMuted" align="center">
          {description}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" fullWidth={false} /> : null}
    </View>
  );
}
