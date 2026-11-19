import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Keyboard, LayoutAnimation, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions, type DimensionValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../design-system";

const OPEN_MS = 340;
const CLOSE_MS = 240;

export interface BottomSheetProps {
  /** Se llama cuando la hoja ya terminó de bajar (o al tocar atrás en Android). */
  onClose: () => void;
  /** Alto fijo de la hoja: así la estructura no cambia con el contenido. Por defecto 94%. */
  height?: DimensionValue;
  /** Contenido; si es función recibe `close()` para cerrar con la animación de bajada. */
  children: ReactNode | ((close: () => void) => ReactNode);
}

/**
 * Hoja modal genérica: el fondo se oscurece en fade y la hoja sube desde abajo con una curva suave (y baja igual al cerrar).
 * Reemplaza `Modal animationType="slide"`, que desliza también el fondo de golpe.
 */
export function BottomSheet({ onClose, height = "94%", children }: BottomSheetProps) {
  const { colors, radius, space } = useTheme();
  const { height: screen } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [kb, setKb] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: OPEN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [progress]);

  // Teclado (iOS): la hoja se apoya sobre el teclado y se achica lo justo, animada junto con él. Android ya redimensiona la ventana.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (e) => { LayoutAnimation.configureNext(LayoutAnimation.create(e.duration || 250, "keyboard", "opacity")); setKb(e.endCoordinates.height); });
    const hide = Keyboard.addListener("keyboardWillHide", (e) => { LayoutAnimation.configureNext(LayoutAnimation.create(e.duration || 250, "keyboard", "opacity")); setKb(0); });
    return () => { show.remove(); hide.remove(); };
  }, []);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, { toValue: 0, duration: CLOSE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setMounted(false);
      onClose();
    });
  }, [onClose, progress]);

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: progress }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={close} style={StyleSheet.absoluteFill} />
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          style={{
            height: kb > 0 ? Math.min(screen * 0.94, screen - kb - insets.top - space[3]) : height,
            marginBottom: kb, backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card,
            paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: kb > 0 ? space[3] : space[6],
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [screen, 0] }) }],
          }}
        >
          {typeof children === "function" ? children(close) : children}
        </Animated.View>
      </View>
    </Modal>
  );
}
