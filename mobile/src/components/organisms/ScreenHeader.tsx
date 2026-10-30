import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "../atoms";

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Acción opcional a la derecha (IconButton, toggle…). */
  right?: ReactNode;
}

/** Encabezado genérico de pantalla: título (screenTitle), subtítulo opcional y una acción a la derecha. */
export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  const { space, sizes } = useTheme();
  return (
    <View
      style={{
        minHeight: sizes.header,
        paddingHorizontal: space[5],
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space[3],
      }}
    >
      <View style={{ flexShrink: 1, gap: space[1] }}>
        <Text variant="screenTitle" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="secondary" tone="inkMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? null}
    </View>
  );
}
