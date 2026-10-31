import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, TextInput, View, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { useMascotStory } from "../../mascots/useMascotLine";
import { HStack, Icon, IconButton, Text, VStack, useReducedMotion } from "../atoms";
import { formatClock } from "../molecules";

/** En web no hay módulo nativo de animación: ahí se anima por JS sin aviso. */
const NATIVE_DRIVER = Platform.OS !== "web";

export interface ChatComposerProps {
  text: string;
  onTextChange: (text: string) => void;
  onSendText: () => void;
  /** Empieza a grabar (micrófono). */
  onStartRecording: () => void;
  /** Termina y envía lo grabado. */
  onSendRecording: () => void;
  onCancelRecording: () => void;
  recording: boolean;
  elapsedMs?: number;
  /** Nivel del micrófono 0..1 (agranda el punto rojo). */
  level?: number;
  /** false = este dispositivo no graba: el micrófono queda apagado. */
  canRecord?: boolean;
  /** La mascota está interpretando: no se puede mandar otra cosa todavía. */
  busy?: boolean;
  /** Espacio de zona segura inferior (0 con el teclado abierto). */
  bottomInset?: number;
  /** false = solo texto (sin micrófono): el botón es solo "Enviar" y se apaga con el campo vacío. Default true. */
  voice?: boolean;
  /** Texto del campo vacío (ya traducido); por defecto el de Cargar. */
  placeholder?: string;
  /** Etiqueta accesible del campo (ya traducida); por defecto la de Cargar. */
  inputLabel?: string;
}

/** Barra de abajo del chat: campo de texto + un botón que es micrófono (vacío), enviar (con texto) o enviar audio (grabando). */
export function ChatComposer({
  text,
  onTextChange,
  onSendText,
  onStartRecording,
  onSendRecording,
  onCancelRecording,
  recording,
  elapsedMs = 0,
  level = 0,
  canRecord = true,
  busy = false,
  bottomInset = 0,
  voice = true,
  placeholder,
  inputLabel,
}: ChatComposerProps) {
  const { t } = useTranslation("load");
  const { name } = useMascotStory();
  const { colors, radius, space, sizes, type } = useTheme();
  const reduce = useReducedMotion();
  const hasText = text.trim().length > 0;
  const canSend = hasText && !busy;

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!recording || reduce) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, reduce, pulse]);

  const action = recording
    ? { icon: "send" as const, label: t("composer.sendAudio"), onPress: onSendRecording, disabled: false }
    : hasText
      ? { icon: "send" as const, label: t("composer.send"), onPress: onSendText, disabled: !canSend }
      : !voice
        ? { icon: "send" as const, label: t("composer.send"), onPress: onSendText, disabled: true }
        : {
          icon: (canRecord ? "mic" : "mic-off") as "mic" | "mic-off",
          label: !canRecord ? t("composer.micUnavailable") : busy ? t("composer.micBusy") : t("composer.mic"),
          onPress: onStartRecording,
          disabled: !canRecord || busy,
        };

  const dot = space[3];
  return (
    <View
      testID="chat-composer"
      style={{
        paddingHorizontal: space[4],
        paddingTop: space[2],
        paddingBottom: space[2] + bottomInset,
        backgroundColor: colors.bg,
        borderTopWidth: sizes.hairline,
        borderTopColor: colors.border,
      }}
    >
      <HStack gap={2} align="center">
        {recording ? (
          <>
            <IconButton testID="chat-cancel" icon="close" accessibilityLabel={t("composer.cancel")} onPress={onCancelRecording} />
            <View
              accessible
              accessibilityRole="timer"
              accessibilityLabel={t("composer.recordingTime", { time: formatClock(elapsedMs) })}
              accessibilityLiveRegion="polite"
              style={{
                flex: 1,
                minHeight: sizes.touch,
                flexDirection: "row",
                alignItems: "center",
                gap: space[3],
                paddingHorizontal: space[4],
                borderRadius: radius.pill,
                backgroundColor: colors.dangerTint,
              }}
            >
              <Animated.View
                style={{
                  width: dot,
                  height: dot,
                  borderRadius: radius.pill,
                  backgroundColor: colors.danger,
                  opacity: reduce ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
                  transform: [{ scale: 1 + level * 0.6 }],
                }}
              />
              <VStack>
                <Text variant="bodyStrong" tone="dangerInk" style={{ fontVariant: ["tabular-nums"] }}>
                  {formatClock(elapsedMs)}
                </Text>
                <Text variant="secondary" tone="dangerInk" numberOfLines={1}>
                  {t("composer.cancelHint")}
                </Text>
              </VStack>
            </View>
          </>
        ) : (
          <TextInput
            testID="chat-input"
            accessibilityLabel={inputLabel ?? t("composer.inputLabel", { name })}
            placeholder={placeholder ?? t("composer.placeholder", { name })}
            placeholderTextColor={colors.inkMuted}
            value={text}
            onChangeText={onTextChange}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={canSend ? onSendText : undefined}
            style={[
              type.body,
              {
                flex: 1,
                minHeight: sizes.touch,
                paddingHorizontal: space[4],
                borderRadius: radius.pill,
                borderWidth: sizes.hairline,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.ink,
              },
            ]}
          />
        )}
        <Pressable
          testID={recording || hasText || !voice ? "chat-send" : "chat-mic"}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ disabled: action.disabled }}
          disabled={action.disabled}
          onPress={action.onPress}
          style={({ pressed }) => ({
            width: sizes.touch,
            height: sizes.touch,
            borderRadius: radius.pill,
            backgroundColor: colors.fab,
            alignItems: "center",
            justifyContent: "center",
            opacity: action.disabled ? 0.4 : pressed ? 0.85 : 1,
          })}
        >
          <Icon name={action.icon} color={colors.onFab} />
        </Pressable>
      </HStack>
    </View>
  );
}
