import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { HStack, IconButton, Text, VStack } from "../../components/atoms";
import { AudioBubble, ChatBubble, MascotAvatar, QuickReplies, TypingBubble, formatClock, type QuickReply } from "../../components/molecules";
import { ChatComposer, ChatErrorActions, ChatThread, DraftCard, type ChatThreadItem } from "../../components/organisms";
import { useIncomeCategories } from "../../data";
import { useTheme } from "../../design-system";
import { formatDate, formatMoney } from "../../i18n/format";
import { useMascotStory } from "../../mascots/useMascotLine";
import { useChatAudio, useChatLine, useLoadChat, type ChatMessage, type ManualKind, type MascotLineMessage } from "./conversation";
import { MAX_RECORDING_MS, useVoiceRecorder } from "./useVoiceRecorder";

/** Opciones de carga manual que ofrece la mascota; sin pantalla todavía = apagadas con "pronto". */
const MANUAL: readonly { kind: ManualKind; ready: boolean }[] = [
  { kind: "income", ready: true },
  { kind: "debt", ready: true },
  { kind: "expense", ready: false },
  { kind: "statement", ready: false },
];

function UserText({ text, tail }: { text: string; tail: boolean }) {
  const { colors } = useTheme();
  return (
    <ChatBubble side="user" tail={tail}>
      <Text selectable style={{ color: colors.onFab }}>
        {text}
      </Text>
    </ChatBubble>
  );
}

function MascotLine({ message, tail }: { message: MascotLineMessage; tail: boolean }) {
  const text = useChatLine(message);
  return (
    <ChatBubble side="mascot" tail={tail}>
      <Text variant="bodySemi" selectable>
        {text}
      </Text>
    </ChatBubble>
  );
}

/** Teclado abierto: el composer no necesita el espacio de la zona segura de abajo. */
function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/** Cargar como un chat con la mascota: escribís o hablás, ella arma el borrador y el formulario se abre encima del hilo. */
export function LoadChatScreen() {
  const { t } = useTranslation("load");
  const { t: tc } = useTranslation("common");
  const { colors, space, sizes } = useTheme();
  const { name } = useMascotStory();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const chat = useLoadChat();
  const audio = useChatAudio();
  const recorder = useVoiceRecorder();
  const categories = useIncomeCategories();
  const [text, setText] = useState("");
  const recording = recorder.status === "recording";

  const { sendText, sendAudio, say, openManual, openDraft, retry } = chat;
  const { stop: stopAudio } = audio;

  const onSendText = useCallback(() => {
    const value = text.trim();
    if (!value) return;
    setText("");
    sendText(value);
  }, [text, sendText]);

  const onStartRecording = useCallback(async () => {
    stopAudio();
    const started = await recorder.start();
    if (started === "denied") say("voicePermission");
  }, [recorder, say, stopAudio]);

  const onSendRecording = useCallback(async () => {
    const recorded = await recorder.stop();
    if (recorded) sendAudio(recorded);
    else say("voiceUnclear");
  }, [recorder, sendAudio, say]);

  useEffect(() => {
    if (recording && recorder.elapsedMs >= MAX_RECORDING_MS) void onSendRecording();
  }, [recording, recorder.elapsedMs, onSendRecording]);

  const options: QuickReply[] = MANUAL.map(({ kind, ready }) => ({
    key: kind,
    label: ready ? t(`quick.${kind}`) : `${t(`quick.${kind}`)} · ${t("quick.soon")}`,
    disabled: !ready,
    testID: `quick-${kind}`,
  }));

  const items = useMemo<ChatThreadItem[]>(() => {
    const out: ChatThreadItem[] = [];
    const add = (m: ChatMessage, render: ChatThreadItem["render"]) => out.push({ id: m.id, side: m.from, render });
    for (const m of chat.messages) {
      switch (m.kind) {
        case "user.text":
          add(m, ({ first }) => <UserText text={m.text} tail={first} />);
          break;
        case "user.audio": {
          const active = audio.activeId === m.id;
          add(m, ({ first }) => (
            <AudioBubble
              tail={first}
              playing={active && audio.playing}
              positionMs={active ? audio.positionMs : 0}
              durationMs={m.durationMs}
              waveform={m.waveform}
              onToggle={() => void audio.toggle(m.id, m.uri)}
              playLabel={t("audio.play", { duration: formatClock(m.durationMs) })}
              pauseLabel={t("audio.pause")}
              transcript={m.transcript ? t("audio.heard", { text: m.transcript }) : undefined}
            />
          ));
          break;
        }
        case "mascot.line":
          add(m, ({ first }) => <MascotLine message={m} tail={first} />);
          break;
        case "mascot.typing":
          add(m, ({ first }) => <TypingBubble tail={first} accessibilityLabel={t("typing.label", { name })} />);
          break;
        case "mascot.options":
          add(m, () => <QuickReplies options={options} accessibilityLabel={t("quick.label")} onSelect={(k) => openManual(k as ManualKind)} />);
          break;
        case "mascot.draft": {
          const d = m.draft;
          const category = d.categoryId ? categories.data?.find((c) => c.id === d.categoryId)?.name : undefined;
          const details = [category, d.date ? formatDate(d.date, "short") : undefined].filter((v): v is string => !!v);
          add(m, () => (
            <DraftCard
              kindLabel={t("draft.kind")}
              name={d.name}
              amount={d.amount != null ? formatMoney(d.amount, d.currency) : null}
              details={details}
              fixed={!!d.fixed}
              status={m.status}
              savedAmount={m.savedAmount}
              onReview={() => openDraft(m.draftId)}
            />
          ));
          break;
        }
        case "mascot.error":
          if (m.retryable) add(m, () => <ChatErrorActions disabled={chat.busy} onRetry={() => retry(m.retryOf)} />);
          break;
      }
    }
    return out;
    // `options` se rehace en cada render con los mismos textos; depende de t.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages, chat.busy, audio.activeId, audio.playing, audio.positionMs, categories.data, t, name, openManual, openDraft, retry]);

  return (
    <SafeAreaView edges={["top"]} testID="load-chat" style={{ flex: 1, backgroundColor: colors.bg }}>
      <HStack gap={3} style={{ paddingHorizontal: space[5], paddingVertical: space[3] }}>
        <MascotAvatar size={sizes.headerAvatar} />
        <VStack style={{ flex: 1 }}>
          <Text variant="cardTitle" accessibilityRole="header">
            {tc("load.title")}
          </Text>
          <Text variant="secondary" tone="inkMuted" numberOfLines={1}>
            {t("header.with", { name })}
          </Text>
        </VStack>
        <IconButton testID="chat-close" icon="close" accessibilityLabel={tc("actions.close")} onPress={() => router.back()} />
      </HStack>
      <View style={{ height: sizes.hairline, backgroundColor: colors.border }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ChatThread items={items} />
        <ChatComposer
          text={text}
          onTextChange={setText}
          onSendText={onSendText}
          onStartRecording={() => void onStartRecording()}
          onSendRecording={() => void onSendRecording()}
          onCancelRecording={() => void recorder.cancel()}
          recording={recording}
          elapsedMs={recorder.elapsedMs}
          level={recorder.level}
          canRecord={recorder.status !== "unavailable"}
          busy={chat.busy}
          bottomInset={keyboard ? 0 : insets.bottom}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
