import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Badge, Text } from "../atoms";

export interface SectionHeaderProps {
  title: string;
  /** Cantidad opcional junto al título (globo danger). */
  count?: number;
  /** Acción a la derecha (p. ej. un `IconButton` «+» para agregar). */
  right?: ReactNode;
}

/** Título de sección dentro de una pantalla ("Por confirmar", "Avisos"). */
export function SectionHeader({ title, count, right }: SectionHeaderProps) {
  const { space } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
      <View accessibilityRole="header" style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexShrink: 1 }}>
        <Text variant="cardTitle">{title}</Text>
        {count ? <Badge count={count} /> : null}
      </View>
      {right ?? null}
    </View>
  );
}
