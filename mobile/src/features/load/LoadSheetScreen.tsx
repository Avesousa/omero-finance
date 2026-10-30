import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Divider, HStack, IconButton, Icon, Pill, Spacer, Surface, Text, VStack } from "../../components/atoms";
import { ListRow } from "../../components/molecules";
import { VoiceCapture, type VoicePhase } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { useInterpretVoice, type AppError, type VoiceInput } from "../../data";
import type { VoiceOutcome } from "../../domain";
import { useTheme } from "../../design-system";
import type { MascotMoment, Mood } from "../../mascots/types";
import type { IconName } from "../../components/atoms";
import { MAX_RECORDING_MS, useVoiceRecorder } from "./useVoiceRecorder";

/** Lo que la mascota dice y cómo se la ve cuando termina de interpretar (o falla). */
interface VoiceResult {
  moment: MascotMoment;
  params?: Record<string, string>;
  mood: Mood;
  /** Hay algo para reenviar (error reintentable). */
  retry?: boolean;
}

/** Cuánto se ve a la mascota confirmar el borrador antes de abrir el formulario. */
const DRAFT_PAUSE_MS = 1100;

type OptionKey = "expense" | "income" | "debt" | "statement";

interface Option {
  key: OptionKey;
  icon: IconName;
  /** Ruta a abrir; sin ruta = todavía no disponible. */
  href?: string;
}

const OPTIONS: readonly Option[] = [
  { key: "expense", icon: "remove-circle-outline" },
  { key: "income", icon: "add-circle-outline", href: "/ingresos/nuevo" },
  { key: "debt", icon: "swap-vertical-outline", href: "/deudas/nueva" },
  { key: "statement", icon: "card-outline" },
];

/** Hoja Cargar: arriba se le cuenta a la mascota (voz o texto); abajo, las opciones a mano. */
export function LoadSheetScreen() {
  const { t } = useTranslation("common");
  const { t: tm } = useTranslation("mascots");
  const { colors, radius, space, sizes } = useTheme();
  const recorder = useVoiceRecorder();
  const interpret = useInterpretVoice();
  const [text, setText] = useState("");
  const [result, setResult] = useState<VoiceResult | null>(null);
  const lastInput = useRef<VoiceInput | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const phase: VoicePhase = interpret.isPending ? "thinking" : recorder.status === "recording" ? "recording" : result ? "result" : "idle";

  const onOutcome = useCallback(
    (outcome: VoiceOutcome, fromText: boolean) => {
      if (outcome.kind === "draft") {
        setResult({ moment: "voiceDraftReady", mood: "feliz" });
        if (fromText) setText("");
        timer.current = setTimeout(
          () =>
            router.replace({
              pathname: "/ingresos/nuevo",
              params: { draft: JSON.stringify(outcome.draft), transcript: outcome.transcript },
            }),
          DRAFT_PAUSE_MS,
        );
      } else if (outcome.kind === "notYet") {
        const action = (tm as unknown as (k: string) => string)(`common.actions.${outcome.intent}`);
        setResult({ moment: "voiceNotYet", params: { action }, mood: "calma" });
      } else if (outcome.kind === "chat") {
        setResult({ moment: "voiceChat", mood: "feliz" });
      } else {
        setResult({ moment: "voiceUnclear", mood: "atento" });
      }
    },
    [tm],
  );

  const onError = useCallback((error: AppError) => {
    if (error.code === "bad_audio") setResult({ moment: "voiceUnclear", mood: "atento" });
    else if (error.retryable) setResult({ moment: "voiceErrorRetry", mood: "calma", retry: true });
    else setResult({ moment: "voiceErrorReported", mood: "calma" });
  }, []);

  const submit = useCallback(
    (input: VoiceInput) => {
      lastInput.current = input;
      setResult(null);
      interpret.mutate(input, {
        onSuccess: (outcome) => onOutcome(outcome, "text" in input),
        onError,
      });
    },
    [interpret, onOutcome, onError],
  );

  const finishRecording = useCallback(async () => {
    const audio = await recorder.stop();
    if (audio) submit({ audioUri: audio.uri, mimeType: audio.mimeType, durationMs: audio.durationMs });
    else setResult({ moment: "voiceUnclear", mood: "atento" });
  }, [recorder, submit]);

  const onMicPress = useCallback(async () => {
    if (recorder.status === "recording") return void (await finishRecording());
    setResult(null);
    const started = await recorder.start();
    if (started === "denied") setResult({ moment: "voicePermission", mood: "atento" });
  }, [recorder, finishRecording]);

  useEffect(() => {
    if (recorder.status === "recording" && recorder.elapsedMs >= MAX_RECORDING_MS) void finishRecording();
  }, [recorder.status, recorder.elapsedMs, finishRecording]);

  const onSend = () => {
    const value = text.trim();
    if (value) submit({ text: value });
  };

  const moment: MascotMoment =
    phase === "recording" ? "voiceListening" : phase === "thinking" ? "voiceThinking" : result ? result.moment : "voiceIdle";
  const mood: Mood = phase === "recording" || phase === "thinking" ? "atento" : result ? result.mood : "calma";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScreenTemplate edges={["top", "bottom"]} testID="load-sheet">
      <HStack>
        <VStack gap={1}>
          <Text variant="screenTitle" accessibilityRole="header">
            {t("load.title")}
          </Text>
        </VStack>
        <Spacer />
        <IconButton icon="close" accessibilityLabel={t("actions.close")} onPress={() => router.back()} />
      </HStack>
      <VoiceCapture
        phase={phase}
        moment={moment}
        momentParams={result?.params}
        mood={mood}
        elapsedMs={recorder.elapsedMs}
        level={recorder.level}
        canRecord={recorder.status !== "unavailable"}
        onMicPress={onMicPress}
        text={text}
        onTextChange={setText}
        onSend={onSend}
        onRetry={phase === "result" && result?.retry && lastInput.current ? () => submit(lastInput.current as VoiceInput) : undefined}
      />
      <Text variant="cardTitle">{t("voice.manual")}</Text>
      <Surface>
        {OPTIONS.map((o, i) => {
          const enabled = !!o.href;
          const row = (
            <ListRow
              testID={`load-${o.key}`}
              title={t(`load.${o.key}.title`)}
              subtitle={t(`load.${o.key}.body`)}
              onPress={enabled ? () => router.replace(o.href as never) : undefined}
              left={
                <View
                  style={{
                    width: sizes.touch,
                    height: sizes.touch,
                    borderRadius: radius.pill,
                    backgroundColor: colors.tabActiveBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={o.icon} tone={enabled ? "ink" : "inkMuted"} />
                </View>
              }
              right={enabled ? <Icon name="chevron-forward" tone="inkMuted" size="sm" /> : <Pill label={t("status.comingSoon")} />}
            />
          );
          return (
            <View key={o.key} accessibilityState={{ disabled: !enabled }} style={{ opacity: enabled ? 1 : 0.6, paddingVertical: space[1] }}>
              {i > 0 ? <Divider /> : null}
              {row}
            </View>
          );
        })}
      </Surface>
    </ScreenTemplate>
    </KeyboardAvoidingView>
  );
}
