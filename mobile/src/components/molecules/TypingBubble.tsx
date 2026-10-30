import { useEffect, useRef } from "react";
import { Animated, Easing, View, Platform } from "react-native";
import { useTheme } from "../../design-system";
import { useReducedMotion } from "../atoms";
import { ChatBubble } from "./ChatBubble";

/** En web no hay módulo nativo de animación: ahí se anima por JS sin aviso. */
const NATIVE_DRIVER = Platform.OS !== "web";

export interface TypingBubbleProps {
  /** Para lectores de pantalla ("Omero está escribiendo"). */
  accessibilityLabel: string;
  tail?: boolean;
  testID?: string;
}

const DOTS = [0, 1, 2] as const;
const STEP_MS = 160;

/** "Escribiendo…": tres puntos que suben y bajan; quietos si el sistema pide menos movimiento. */
export function TypingBubble({ accessibilityLabel, tail, testID }: TypingBubbleProps) {
  const { colors, radius, space } = useTheme();
  const reduce = useReducedMotion();
  const values = useRef(DOTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduce) {
      values.forEach((v) => v.setValue(0));
      return;
    }
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * STEP_MS),
          Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
          Animated.timing(v, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
          Animated.delay((DOTS.length - 1 - i) * STEP_MS),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduce, values]);

  const dot = space[2] + 1;
  return (
    <ChatBubble side="mascot" tail={tail} testID={testID}>
      <View accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel} accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: space[1], alignItems: "center", height: space[4] }}>
        {values.map((v, i) => (
          <Animated.View
            key={i}
            style={{
              width: dot,
              height: dot,
              borderRadius: radius.pill,
              backgroundColor: colors.inkMuted,
              opacity: reduce ? 0.7 : v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ translateY: reduce ? 0 : v.interpolate({ inputRange: [0, 1], outputRange: [0, -space[1]] }) }],
            }}
          />
        ))}
      </View>
    </ChatBubble>
  );
}
