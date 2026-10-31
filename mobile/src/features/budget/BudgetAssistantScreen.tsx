import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { HStack, IconButton, Skeleton, Text, VStack } from "../../components/atoms";
import { ChatTextBubble, EmptyState, MascotAvatar, QuickReplies, type QuickReply } from "../../components/molecules";
import { BudgetAssistSummaryCard, ChatComposer, ChatThread, type ChatThreadItem } from "../../components/organisms";
import { projectedFree } from "../../data";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { useMascotLine, useMascotStory } from "../../mascots/useMascotLine";
import { proposalOf, useBudgetAssistant, type AssistantLineMessage, type AssistantState, type AssistantUserChoice } from "./assistant";

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

function MascotLine({ message, tail }: { message: AssistantLineMessage; tail: boolean }) {
  const vars: Record<string, string | number> = {};
  if (message.vars?.name !== undefined) vars.name = message.vars.name;
  if (message.vars?.amount !== undefined) vars.amount = formatMoney(message.vars.amount);
  const text = useMascotLine(message.moment, vars);
  return <ChatTextBubble side="mascot" text={text} tail={tail} />;
}

function UserChoice({ message, tail }: { message: AssistantUserChoice; tail: boolean }) {
  const { t } = useTranslation("budget");
  const text = t(`assistant.said.${message.choice}`, { amount: formatMoney(message.amount ?? 0), name: message.name ?? "" });
  return <ChatTextBubble side="user" text={text} tail={tail} />;
}

/** Respuestas rápidas de la pregunta abierta (derivadas del estado: desaparecen cuando se responde). */
function useReplies(state: AssistantState): QuickReply[] {
  const { t } = useTranslation("budget");
  return useMemo(() => {
    if (state.phase === "ask" && state.current) {
      const proposal = proposalOf(state.current);
      const out: QuickReply[] = [];
      if (proposal) {
        const label = proposal.source === "previous" ? t("assistant.same", { amount: formatMoney(proposal.amount) }) : t("assistant.spent", { amount: formatMoney(proposal.amount) });
        out.push({ key: "same", label, testID: "assist-same" });
      }
      out.push({ key: "change", label: proposal ? t("assistant.change") : t("assistant.enter"), testID: "assist-change" });
      out.push({ key: "skip", label: t("assistant.skip"), testID: "assist-skip" });
      return out;
    }
    if (state.phase === "amount") return [{ key: "skip", label: t("assistant.skip"), testID: "assist-skip" }];
    if (state.phase === "more") {
      return [
        ...state.extras.map((e) => ({ key: `pick:${e.categoryId}`, label: e.name, testID: `assist-pick-${e.categoryId}` })),
        { key: "done", label: t("assistant.done"), testID: "assist-done" },
      ];
    }
    return [];
  }, [state.phase, state.current, state.extras, t]);
}

/** Asistente de presupuesto (modal): chat con la mascota que recorre ahorro y categorías, y cierra con un resumen para confirmar. Solo texto. */
export function BudgetAssistantScreen() {
  const { t } = useTranslation("budget");
  const { t: tc } = useTranslation("common");
  const { colors, space, sizes } = useTheme();
  const { name } = useMascotStory();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const params = useLocalSearchParams<{ period?: string }>();
  const a = useBudgetAssistant(params.period);
  const [text, setText] = useState("");
  const { state, plan } = a;
  const replies = useReplies(state);
  const accepting = state.phase === "ask" || state.phase === "amount";
  const askingName = state.current?.name ?? "";

  const onSendText = useCallback(() => {
    const value = text.trim();
    if (!value) return;
    setText("");
    a.sendText(value);
  }, [text, a]);

  const onReply = useCallback(
    (key: string) => {
      if (key === "same" || key === "change" || key === "skip") a.choose(key);
      else if (key === "done") a.noMore();
      else if (key.startsWith("pick:")) a.pickExtra(key.slice(5));
    },
    [a],
  );

  const items = useMemo<ChatThreadItem[]>(() => {
    const out: ChatThreadItem[] = [];
    for (const m of state.messages) {
      switch (m.kind) {
        case "mascot.line":
          out.push({ id: m.id, side: "mascot", render: ({ first }) => <MascotLine message={m} tail={first} /> });
          break;
        case "user.text":
          out.push({ id: m.id, side: "user", render: ({ first }) => <ChatTextBubble side="user" text={m.text} tail={first} /> });
          break;
        case "user.choice":
          out.push({ id: m.id, side: "user", render: ({ first }) => <UserChoice message={m} tail={first} /> });
          break;
        case "mascot.summary": {
          const status = state.phase === "saved" ? "saved" : state.phase === "saving" ? "saving" : "pending";
          const lines = m.lines.map((l) => ({ id: l.categoryId, name: l.name, amount: l.amount }));
          const unassigned = plan ? projectedFree(plan, m.lines.map((l) => ({ categoryId: l.categoryId, amount: l.amount }))) : 0;
          out.push({
            id: m.id,
            side: "mascot",
            render: () => (
              <BudgetAssistSummaryCard lines={lines} unassigned={unassigned} status={status} error={state.error} onConfirm={a.confirm} onManual={() => router.back()} />
            ),
          });
          break;
        }
      }
    }
    if (replies.length > 0) {
      out.push({ id: "replies", side: "mascot", render: () => <QuickReplies options={replies} accessibilityLabel={t("assistant.replies")} onSelect={onReply} /> });
    }
    return out;
  }, [state, plan, replies, a.confirm, onReply, t]);

  const header = (
    <>
      <HStack gap={3} style={{ paddingHorizontal: space[5], paddingVertical: space[3] }}>
        <MascotAvatar size={sizes.headerAvatar} />
        <VStack style={{ flex: 1 }}>
          <Text variant="cardTitle" accessibilityRole="header">
            {t("assistant.title")}
          </Text>
          <Text variant="secondary" tone="inkMuted" numberOfLines={1}>
            {t("assistant.with", { name })}
          </Text>
        </VStack>
        <IconButton testID="assist-close" icon="close" accessibilityLabel={tc("actions.close")} onPress={() => router.back()} />
      </HStack>
      <View style={{ height: sizes.hairline, backgroundColor: colors.border }} />
    </>
  );

  if (a.isError) {
    return (
      <SafeAreaView edges={["top", "bottom"]} testID="budget-assistant-error" style={{ flex: 1, backgroundColor: colors.bg }}>
        {header}
        <View style={{ padding: space[5] }}>
          <EmptyState
            title={t("assistant.state.errorTitle")}
            description={t("assistant.state.errorBody")}
            action={{ label: tc("actions.retry"), onPress: () => void a.refetch() }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (a.isPending) {
    return (
      <SafeAreaView edges={["top", "bottom"]} testID="budget-assistant-loading" style={{ flex: 1, backgroundColor: colors.bg }}>
        {header}
        <VStack gap={3} style={{ padding: space[5] }} accessibilityLabel={t("assistant.state.loading")} accessibilityLiveRegion="polite">
          <Skeleton height={56} shape="pill" />
          <Skeleton height={56} shape="pill" />
        </VStack>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} testID="budget-assistant" style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ChatThread items={items} testID="budget-assistant-thread" />
        <ChatComposer
          voice={false}
          text={text}
          onTextChange={setText}
          onSendText={onSendText}
          onStartRecording={() => undefined}
          onSendRecording={() => undefined}
          onCancelRecording={() => undefined}
          recording={false}
          placeholder={t("assistant.placeholder")}
          inputLabel={t("assistant.inputLabel", { name: askingName })}
          busy={!accepting}
          bottomInset={keyboard ? 0 : insets.bottom}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
