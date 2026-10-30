import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../design-system";

export interface ChatBubbleProps {
  /** `mascot` = izquierda, surface con borde; `user` = derecha, color de acción del modo (primary en Tranqui, accent en Atrevido). */
  side: "mascot" | "user";
  children: ReactNode;
  /** Cola hacia el avatar / el borde (primer mensaje de una racha). */
  tail?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Máximo ancho de una burbuja dentro del hilo. */
const MAX_WIDTH = "82%";

/** Burbuja de chat: radio grande, cola sutil en la esquina de abajo del lado que habla. Solo contiene; no sabe qué hay adentro. */
export function ChatBubble({ side, children, tail = false, style, testID }: ChatBubbleProps) {
  const { colors, radius, space, sizes } = useTheme();
  const mine = side === "user";
  return (
    <View
      testID={testID}
      style={[
        {
          maxWidth: MAX_WIDTH,
          alignSelf: mine ? "flex-end" : "flex-start",
          paddingVertical: space[3],
          paddingHorizontal: space[4],
          borderRadius: radius.card,
          backgroundColor: mine ? colors.fab : colors.surface,
          borderWidth: sizes.hairline,
          borderColor: mine ? colors.fab : colors.border,
        },
        tail ? (mine ? { borderBottomRightRadius: space[1] } : { borderBottomLeftRadius: space[1] }) : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
