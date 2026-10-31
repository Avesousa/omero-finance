import { Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { Icon, Text } from "../atoms";
import { ChatBubble } from "./ChatBubble";

export interface AudioBubbleProps {
  playing: boolean;
  /** Avance en ms (0 si no es el audio activo). */
  positionMs: number;
  durationMs: number;
  /** ~32 barras, 0..1. */
  waveform: readonly number[];
  onToggle: () => void;
  /** Etiqueta accesible del botón en cada estado. */
  playLabel: string;
  pauseLabel: string;
  /** Lo que se escuchó, ya con su texto ("Escuché: …"). */
  transcript?: string;
  tail?: boolean;
  testID?: string;
}

/** m:ss */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Audio del usuario estilo WhatsApp: play/pausa, onda que se llena con el avance, duración y (opcional) lo que se escuchó. */
export function AudioBubble({ playing, positionMs, durationMs, waveform, onToggle, playLabel, pauseLabel, transcript, tail, testID = "audio-bubble" }: AudioBubbleProps) {
  const { colors, radius, space, sizes } = useTheme();
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const shown = positionMs > 0 || playing ? positionMs : durationMs;
  const filled = Math.round(progress * waveform.length);
  const barMax = sizes.iconLarge;
  return (
    <ChatBubble side="user" tail={tail} testID={testID} style={{ paddingVertical: space[2], paddingHorizontal: space[2], minWidth: "62%" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Pressable
          testID="audio-play"
          accessibilityRole="button"
          accessibilityLabel={playing ? pauseLabel : playLabel}
          accessibilityState={{ selected: playing }}
          onPress={onToggle}
          style={({ pressed }) => ({
            width: sizes.touch,
            height: sizes.touch,
            borderRadius: radius.pill,
            backgroundColor: colors.onFab,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name={playing ? "pause" : "play"} color={colors.fab} />
        </Pressable>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flex: 1, height: barMax, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          {waveform.map((level, i) => (
            <View
              key={i}
              style={{
                width: sizes.ring,
                height: Math.max(sizes.ring * 2, Math.round(level * barMax)),
                borderRadius: radius.pill,
                backgroundColor: colors.onFab,
                opacity: i < filled ? 1 : 0.4,
              }}
            />
          ))}
        </View>
        <Text variant="secondaryStrong" style={{ color: colors.onFab, minWidth: space[8] + space[1], textAlign: "right", fontVariant: ["tabular-nums"] }}>
          {formatClock(shown)}
        </Text>
      </View>
      {transcript ? (
        <Text variant="secondary" style={{ color: colors.onFab, marginTop: space[2], marginHorizontal: space[2], opacity: 0.9 }}>
          {transcript}
        </Text>
      ) : null}
    </ChatBubble>
  );
}
