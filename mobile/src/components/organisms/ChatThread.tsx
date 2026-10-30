import { useCallback, useRef, type ComponentRef, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useTheme } from "../../design-system";
import { useReducedMotion } from "../atoms";
import { MascotAvatar } from "../molecules";

export interface ChatThreadItem {
  id: string;
  side: "mascot" | "user";
  /** Dibuja el contenido; `first` = primer mensaje de la racha (lleva la cola de la burbuja). */
  render: (ctx: { first: boolean }) => ReactNode;
}

export interface ChatThreadProps {
  items: readonly ChatThreadItem[];
  testID?: string;
}

/** Hilo de chat: mensajes de la mascota a la izquierda (avatar en el primero de cada racha) y los tuyos a la derecha; siempre queda al final. */
export function ChatThread({ items, testID = "chat-thread" }: ChatThreadProps) {
  const { space, sizes } = useTheme();
  const reduce = useReducedMotion();
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollToEnd = useCallback(() => ref.current?.scrollToEnd({ animated: !reduce }), [reduce]);
  const avatar = space[8];

  return (
    <ScrollView
      ref={ref}
      testID={testID}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[4] }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      onContentSizeChange={scrollToEnd}
      onLayout={scrollToEnd}
    >
      {items.map((item, i) => {
        const prev = items[i - 1];
        const first = !prev || prev.side !== item.side;
        const mascot = item.side === "mascot";
        return (
          <View
            key={item.id}
            testID={`chat-msg-${item.id}`}
            style={{ flexDirection: "row", alignItems: "flex-end", gap: space[2], marginTop: i === 0 ? 0 : first ? space[4] : space[1], justifyContent: mascot ? "flex-start" : "flex-end" }}
          >
            {mascot ? (
              <View style={{ width: avatar, height: avatar }}>{first ? <MascotAvatar size={avatar} /> : null}</View>
            ) : null}
            <View style={{ flex: 1, maxWidth: "100%" }}>{item.render({ first })}</View>
          </View>
        );
      })}
    </ScrollView>
  );
}
