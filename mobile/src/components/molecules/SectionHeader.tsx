import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Badge, Text } from "../atoms";

export interface SectionHeaderProps {
  title: string;
  /** Cantidad opcional junto al título (globo danger). */
  count?: number;
}

/** Título de sección dentro de una pantalla ("Por confirmar", "Avisos"). */
export function SectionHeader({ title, count }: SectionHeaderProps) {
  const { space } = useTheme();
  return (
    <View accessibilityRole="header" style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <Text variant="cardTitle">{title}</Text>
      {count ? <Badge count={count} /> : null}
    </View>
  );
}
