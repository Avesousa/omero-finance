import { useTheme } from "../../design-system";
import { Text } from "../atoms";
import { ChatBubble } from "./ChatBubble";

export interface ChatTextBubbleProps {
  side: "mascot" | "user";
  text: string;
  /** Cola hacia el avatar / el borde (primer mensaje de una racha). */
  tail?: boolean;
}

/** Burbuja de chat con texto seleccionable: la mascota en `bodySemi`; la tuya con el color de texto del botón de acción del modo. */
export function ChatTextBubble({ side, text, tail = false }: ChatTextBubbleProps) {
  const { colors } = useTheme();
  return (
    <ChatBubble side={side} tail={tail}>
      {side === "user" ? (
        <Text selectable style={{ color: colors.onFab }}>
          {text}
        </Text>
      ) : (
        <Text variant="bodySemi" selectable>
          {text}
        </Text>
      )}
    </ChatBubble>
  );
}
