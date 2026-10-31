import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "../../design-system";
import { IconButton, Text } from "../atoms";

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Acción opcional a la derecha (IconButton, toggle…). */
  right?: ReactNode;
  /** Con `onBack`, aparece el botón Volver a la izquierda (pantallas fuera de las pestañas). */
  onBack?: () => void;
  /** Etiqueta accesible del botón Volver (ya traducida). Obligatoria con `onBack`. */
  backLabel?: string;
}

/** Encabezado genérico de pantalla: título (screenTitle), subtítulo opcional y una acción a la derecha. */
export function ScreenHeader({ title, subtitle, right, onBack, backLabel }: ScreenHeaderProps) {
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
      {onBack ? <IconButton testID="screen-back" icon="chevron-back" accessibilityLabel={backLabel ?? ""} onPress={onBack} /> : null}
      <View style={{ flexShrink: 1, flexGrow: onBack ? 1 : 0, gap: space[1] }}>
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
