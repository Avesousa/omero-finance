import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { useMascotLine, useMascotStory } from "../../mascots/useMascotLine";
import type { MascotMoment, Mood } from "../../mascots/types";
import { Button, HStack, Icon, IconButton, Surface, Text, TextField, VStack } from "../atoms";
import { MascotAvatar, SpeechBubble } from "../molecules";

export type VoicePhase = "idle" | "recording" | "thinking" | "result";

export interface VoiceCaptureProps {
  phase: VoicePhase;
  /** Momento de la frase que dice la mascota en su burbuja. */
  moment: MascotMoment;
  momentParams?: Record<string, string | number>;
  mood: Mood;
  /** Tiempo grabado, en ms (se muestra mientras `phase` es "recording"). */
  elapsedMs?: number;
  /** Nivel del micrófono, 0 a 1 (agranda el pulso). */
  level?: number;
  /** false = este dispositivo no puede grabar: el micrófono queda apagado y se explica. */
  canRecord?: boolean;
  onMicPress: () => void;
  text: string;
  onTextChange: (text: string) => void;
  onSend: () => void;
  /** Si viene, muestra "Reintentar" bajo la burbuja. */
  onRetry?: () => void;
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** "Contale a {{mascota}}": mascota, su burbuja, micrófono grande y campo para escribir. No sabe de datos. */
export function VoiceCapture({
  phase,
  moment,
  momentParams,
  mood,
  elapsedMs = 0,
  level = 0,
  canRecord = true,
  onMicPress,
  text,
  onTextChange,
  onSend,
  onRetry,
}: VoiceCaptureProps) {
  const { t } = useTranslation("common");
  const { colors, radius, space, sizes } = useTheme();
  const { name } = useMascotStory();
  const line = useMascotLine(moment, momentParams);
  const recording = phase === "recording";
  const thinking = phase === "thinking";

  // Pulso del micrófono mientras graba; si el sistema pide menos movimiento, queda quieto.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!recording || reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, reduceMotion, pulse]);

  const micSize = sizes.fab + space[4];
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18 + level * 0.3] });
  const micLabel = !canRecord ? t("voice.webHint") : recording ? t("voice.micStop") : thinking ? t("voice.micDisabled") : t("voice.micStart");
  const canSend = text.trim().length > 0 && !recording && !thinking;

  return (
    <Surface testID="voice-capture">
      <VStack gap={4}>
        <Text variant="cardTitle" accessibilityRole="header">
          {t("voice.title", { name })}
        </Text>

        <HStack gap={3} align="center">
          <MascotAvatar size={sizes.bubbleAvatar + space[6]} mood={mood} />
          <View testID="voice-bubble" accessibilityLiveRegion="polite" style={{ flex: 1, flexDirection: "row" }}>
            <SpeechBubble text={line} />
          </View>
        </HStack>

        {onRetry ? <Button testID="voice-retry" variant="secondary" icon="refresh" label={t("voice.retry")} onPress={onRetry} /> : null}

        <VStack gap={2} align="center">
          <View style={{ width: micSize * 1.5, height: micSize * 1.5, alignItems: "center", justifyContent: "center" }}>
            {recording ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: micSize,
                  height: micSize,
                  borderRadius: radius.pill,
                  backgroundColor: colors.dangerTint,
                  transform: [{ scale: reduceMotion ? 1.18 + level * 0.3 : ringScale }],
                }}
              />
            ) : null}
            <Pressable
              testID="voice-mic"
              accessibilityRole="button"
              accessibilityLabel={micLabel}
              accessibilityState={{ disabled: !canRecord || thinking, busy: thinking }}
              disabled={!canRecord || thinking}
              onPress={onMicPress}
              style={({ pressed }) => ({
                width: micSize,
                height: micSize,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: recording ? colors.danger : colors.fab,
                opacity: !canRecord || thinking ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              <Icon name={recording ? "stop" : canRecord ? "mic" : "mic-off"} size="lg" color={recording ? colors.onPrimary : colors.onFab} />
            </Pressable>
          </View>
          <Text variant="secondaryStrong" tone={recording ? "dangerInk" : "inkMuted"} align="center" accessibilityLiveRegion="polite">
            {recording ? t("voice.recording", { time: clock(elapsedMs) }) : thinking ? t("voice.thinking") : micLabel}
          </Text>
        </VStack>

        <VStack gap={2}>
          <Text variant="secondaryStrong">{t("voice.orWrite")}</Text>
          <HStack gap={2}>
            <View style={{ flex: 1 }}>
              <TextField
                testID="voice-text"
                accessibilityLabel={t("voice.textLabel")}
                placeholder={t("voice.textPlaceholder")}
                value={text}
                onChangeText={onTextChange}
                editable={!recording && !thinking}
                returnKeyType="send"
                onSubmitEditing={canSend ? onSend : undefined}
              />
            </View>
            <IconButton testID="voice-send" icon="send" accessibilityLabel={t("voice.send")} disabled={!canSend} onPress={onSend} />
          </HStack>
        </VStack>
      </VStack>
    </Surface>
  );
}
