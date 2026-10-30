import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "../../design-system";

export interface ScreenTemplateProps {
  /** Encabezado fijo arriba (ej. `<AppHeader/>` o un título). Queda fuera del scroll. */
  header?: ReactNode;
  children: ReactNode;
  /** Bordes con inset de zona segura. Default solo arriba (la barra flotante deja su espacio con padding); en modales usar `["top","bottom"]`. */
  edges?: Edge[];
  /** Si es false, el contenido no hace scroll (pantalla fija). */
  scroll?: boolean;
  /** Refresco por arrastre. */
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Layout de pantalla: fondo `bg`, zona segura, encabezado fijo opcional y contenido con
 * margen lateral space-5, separación space-4 entre bloques y aire abajo para que la barra flotante no tape nada (salvo en modales).
 */
export function ScreenTemplate({
  header,
  children,
  edges = ["top"],
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  testID,
}: ScreenTemplateProps) {
  const { colors, space, sizes } = useTheme();
  const padding: ViewStyle = {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: edges.includes("bottom") ? space[8] : space[8] + sizes.tabBarHeight + space[3] * 2,
    gap: space[4],
  };
  return (
    <SafeAreaView testID={testID} edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      {header ? <View style={{ paddingTop: space[4] }}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[padding, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.ink} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
