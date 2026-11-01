import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { HStack, IconButton, Spacer, Surface, Text } from "../../components/atoms";
import { MascotMessage } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { isMonthNotStarted, useAddEntry, type EntryKind, type NewEntryInput } from "../../data";
import { formatMoney } from "../../i18n/format";
import { conversation } from "../load/conversation";
import { type EntryDraft } from "../../domain";
import { EntryForm, type EntryFormValues } from "./EntryForm";

/** Pausa para ver a la mascota festejar antes de volver a Inicio (solo si no viene del chat). */
const CELEBRATE_MS = 1500;

/** Lee el borrador que manda el chat de Cargar (JSON en el parámetro `draft`); null si falta o viene roto. */
function parseDraft(raw: string | undefined, kind: EntryKind): EntryDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<EntryDraft> | null;
    if (!d || typeof d !== "object") return null;
    return {
      kind,
      name: typeof d.name === "string" ? d.name : null,
      amount: typeof d.amount === "number" && Number.isFinite(d.amount) ? d.amount : null,
      currency: d.currency === "USD" ? "USD" : "ARS",
      categoryId: typeof d.categoryId === "string" ? d.categoryId : null,
      date: typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
      fixed: d.fixed && typeof d.fixed === "object" ? { frequency: d.fixed.frequency ?? "MONTHLY" } : null,
      note: typeof d.note === "string" ? d.note : null,
    };
  } catch {
    return null;
  }
}

const SAVED_KIND = { INCOME: "income", EXPENSE: "expense" } as const;

/**
 * Nuevo ingreso o gasto (modal): formulario a mano o precargado con lo que armó la mascota.
 * Si se abrió desde el chat de Cargar (`chatRef`, apilado arriba del hilo), al guardar vuelve a él
 * (`router.back()`) y lo cuenta la mascota; cerrar sin guardar también vuelve y no dice nada.
 */
export function NewEntryScreen({ kind }: { kind: EntryKind }) {
  const { t } = useTranslation("entry");
  const { t: tc } = useTranslation("common");
  const params = useLocalSearchParams<{ draft?: string; transcript?: string; draftId?: string; source?: string; chatRef?: string }>();
  const draft = useMemo(() => parseDraft(params.draft, kind), [params.draft, kind]);
  /** "Escuché: …" solo si el borrador vino de un audio. */
  const heard = params.source === "audio" ? params.transcript?.trim() || "" : "";
  const fromVoice = draft != null;
  const draftId = params.draftId || null;
  const fromChat = params.chatRef === "1" || draftId != null;

  const add = useAddEntry();
  const [savedAmount, setSavedAmount] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const onSubmit = (v: EntryFormValues) => {
    if (!v.date) return;
    const input: NewEntryInput = {
      kind,
      period: v.date.slice(0, 7),
      name: v.name,
      amount: v.amount,
      currency: v.currency,
      categoryId: v.categoryId,
      date: v.dateMode === "today" ? null : v.date,
      note: v.note,
      fixed: v.fixed,
    };
    add.mutate(input, {
      onSuccess: () => {
        if (fromChat) {
          const amountText = formatMoney(v.amount, v.currency);
          conversation.dispatch(
            draftId ? { type: "draftSaved", draftId, amount: amountText } : { type: "manualSaved", kind: SAVED_KIND[kind], amount: amountText },
          );
          router.back();
          return;
        }
        setSavedAmount(formatMoney(v.amount, v.currency));
        timer.current = setTimeout(() => router.dismissTo("/"), CELEBRATE_MS);
      },
    });
  };

  if (savedAmount != null) {
    return (
      <ScreenTemplate edges={["top", "bottom"]} testID="new-entry-saved">
        <MascotMessage moment={kind === "EXPENSE" ? "expenseSaved" : "incomeSaved"} params={{ amount: savedAmount }} mood="festeja" />
      </ScreenTemplate>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenTemplate edges={["top", "bottom"]} testID="new-entry">
        <HStack>
          <Text variant="screenTitle" accessibilityRole="header" style={{ flexShrink: 1 }}>
            {t(`form.title.${kind}`)}
          </Text>
          <Spacer />
          <IconButton testID="new-entry-close" icon="close" accessibilityLabel={t("form.close")} onPress={() => router.back()} />
        </HStack>

        {heard ? (
          <Surface testID="new-entry-heard">
            <Text variant="bodySemi">{t("form.heard", { text: heard })}</Text>
          </Surface>
        ) : null}

        <EntryForm
          kind={kind}
          testIDPrefix="new-entry"
          initial={draft ?? undefined}
          highlightMissing={fromVoice}
          saveLabel={t(`form.save.${kind}`)}
          busy={add.isPending}
          error={add.isError ? (isMonthNotStarted(add.error) ? tc("errors.monthNotStarted") : t(`form.saveError.${kind}`)) : null}
          onSubmit={onSubmit}
        />
      </ScreenTemplate>
    </KeyboardAvoidingView>
  );
}
