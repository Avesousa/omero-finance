import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Chip, HStack, IconButton, Spacer, Surface, Text, TextField, VStack } from "../../components/atoms";
import { FormField, SegmentedToggle } from "../../components/molecules";
import { MascotMessage } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { useAddIncome, useIncomeCategories, type NewIncomeInput } from "../../data";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { conversation } from "../load/conversation";
import {
  addDays,
  currentPeriod,
  daysInPeriod,
  formatMoneyInput,
  numberToInput,
  parseMoney,
  todayIso,
  type IncomeDraft,
} from "../../domain";

type Currency = NewIncomeInput["currency"];
type DateMode = "today" | "yesterday" | "other";
type FieldKey = "name" | "amount" | "day";

/** Pausa para ver a la mascota festejar antes de volver a Inicio. */
const CELEBRATE_MS = 1500;

const digits = (text: string) => text.replace(/\D/g, "");

/** Lee el borrador que manda la hoja Cargar (JSON en el parámetro `draft`); null si falta o viene roto. */
function parseDraft(raw: string | undefined): IncomeDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<IncomeDraft> | null;
    if (!d || typeof d !== "object") return null;
    return {
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

/** Nuevo ingreso (modal): formulario a mano o precargado con lo que se dijo por voz. */
export function NewIncomeScreen() {
  const { t } = useTranslation("income");
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ draft?: string; transcript?: string; draftId?: string }>();
  const draft = useMemo(() => parseDraft(params.draft), [params.draft]);
  const transcript = params.transcript?.trim() || "";
  const fromVoice = draft != null;
  /** Viene del chat de Cargar: lo que pase se cuenta ahí (la mascota), no con festejo propio. */
  const draftId = params.draftId || null;
  const saved = useRef(false);

  const categories = useIncomeCategories();
  const add = useAddIncome();
  const today = useMemo(() => todayIso(), []);
  const yesterday = useMemo(() => addDays(today, -1), [today]);

  // Fecha: Hoy / Ayer / otro día (mes del borrador, o el actual, + día del mes).
  const initialDate = draft?.date ?? null;
  const [dateMode, setDateMode] = useState<DateMode>(
    !initialDate || initialDate === today ? "today" : initialDate === yesterday ? "yesterday" : "other",
  );
  const [otherMonth] = useState(() => (initialDate ? initialDate.slice(0, 7) : currentPeriod()));
  const [day, setDay] = useState(() => (initialDate && initialDate !== today && initialDate !== yesterday ? String(Number(initialDate.slice(8, 10))) : ""));

  const [name, setName] = useState(draft?.name ?? "");
  const [amount, setAmount] = useState(numberToInput(draft?.amount));
  const [currency, setCurrency] = useState<Currency>(draft?.currency ?? "ARS");
  const [categoryId, setCategoryId] = useState<string | null>(draft?.categoryId ?? null);
  const [fixed, setFixed] = useState(draft?.fixed != null);
  const [note, setNote] = useState(draft?.note ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [savedAmount, setSavedAmount] = useState<string | null>(null);

  // Cualquier forma de cerrar sin guardar (✕, gesto, atrás) le avisa al chat: al desmontarse el
  // formulario, si no se guardó, la tarjeta queda "descartada" con la opción de retomarla.
  useEffect(() => {
    if (!draftId) return;
    return () => {
      if (!saved.current) conversation.dispatch({ type: "draftDismissed", draftId });
    };
  }, [draftId]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const amountValue = parseMoney(amount);
  const maxDay = daysInPeriod(otherMonth);
  const dayNumber = digits(day) ? Number(digits(day)) : null;
  const date =
    dateMode === "today" ? today : dateMode === "yesterday" ? yesterday : dayNumber ? `${otherMonth}-${String(dayNumber).padStart(2, "0")}` : null;

  const errors: Partial<Record<FieldKey, string>> = {};
  if (!name.trim()) errors.name = t("errors.name");
  if (!(Number.isFinite(amountValue) && amountValue > 0)) errors.amount = t("errors.amount");
  if (dateMode === "other" && !(dayNumber != null && dayNumber >= 1 && dayNumber <= maxDay)) errors.day = t("errors.day");

  // Si viene de la voz, lo que falta se marca desde el principio.
  const flag = submitted || fromVoice;
  const shown = (key: FieldKey) => (flag ? errors[key] : undefined);
  const hasMissing = fromVoice && Object.keys(errors).length > 0;

  const onSave = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0 || !date) return;
    const input: NewIncomeInput = {
      period: date.slice(0, 7),
      name: name.trim(),
      amount: amountValue,
      currency,
      categoryId,
      date: dateMode === "today" ? null : date,
      note: note.trim() || null,
      fixed: fixed ? { frequency: draft?.fixed?.frequency ?? "MONTHLY" } : null,
    };
    add.mutate(input, {
      onSuccess: () => {
        if (draftId) {
          saved.current = true;
          conversation.dispatch({ type: "draftSaved", draftId, amount: formatMoney(amountValue, currency) });
          router.back();
          return;
        }
        setSavedAmount(formatMoney(amountValue, currency));
        timer.current = setTimeout(() => router.dismissTo("/"), CELEBRATE_MS);
      },
    });
  };

  if (savedAmount != null) {
    return (
      <ScreenTemplate edges={["top", "bottom"]} testID="new-income-saved">
        <MascotMessage moment="incomeSaved" params={{ amount: savedAmount }} mood="festeja" />
      </ScreenTemplate>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenTemplate edges={["top", "bottom"]} testID="new-income">
        <HStack>
          <Text variant="screenTitle" accessibilityRole="header" style={{ flexShrink: 1 }}>
            {t("form.title")}
          </Text>
          <Spacer />
          <IconButton testID="new-income-close" icon="close" accessibilityLabel={t("form.close")} onPress={() => router.back()} />
        </HStack>

        {fromVoice ? (
          <Surface testID="new-income-heard">
            <VStack gap={2}>
              {transcript ? <Text variant="bodySemi">{t("form.heard", { text: transcript })}</Text> : null}
              {hasMissing ? (
                <Text variant="secondary" tone="dangerInk">
                  {t("form.missing")}
                </Text>
              ) : null}
            </VStack>
          </Surface>
        ) : null}

        <VStack gap={4}>
          <FormField label={t("form.name")} error={shown("name")}>
            <TextField testID="new-income-name" accessibilityLabel={t("form.name")} placeholder={t("form.namePlaceholder")} value={name} onChangeText={setName} />
          </FormField>
          <FormField label={t("form.amount")} error={shown("amount")}>
            <TextField
              testID="new-income-amount"
              accessibilityLabel={t("form.amount")}
              placeholder={t("form.amountPlaceholder")}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(v) => setAmount(formatMoneyInput(v))}
            />
          </FormField>
          <FormField label={t("form.currency")}>
            <SegmentedToggle
              testID="new-income-currency"
              accessibilityLabel={t("form.currency")}
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "ARS", label: t("form.currencyARS") },
                { value: "USD", label: t("form.currencyUSD") },
              ]}
            />
          </FormField>

          <FormField label={t("form.category")} error={categories.isError ? t("form.categoriesError") : undefined}>
            <HStack gap={2} wrap>
              {(categories.data ?? []).map((c) => (
                <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
              ))}
            </HStack>
          </FormField>

          <FormField label={t("form.date")} error={shown("day")}>
            <VStack gap={2}>
              <SegmentedToggle
                testID="new-income-date"
                accessibilityLabel={t("form.date")}
                value={dateMode}
                onChange={setDateMode}
                options={[
                  { value: "today", label: t("form.dateToday") },
                  { value: "yesterday", label: t("form.dateYesterday") },
                  { value: "other", label: t("form.dateOther") },
                ]}
              />
              {dateMode === "other" ? (
                <TextField
                  testID="new-income-day"
                  accessibilityLabel={t("form.dayOfMonth")}
                  placeholder={t("form.dayPlaceholder", { max: maxDay })}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={day}
                  onChangeText={(v) => setDay(digits(v))}
                />
              ) : null}
            </VStack>
          </FormField>

          <HStack gap={3}>
            <Text variant="body" style={{ flexShrink: 1 }}>
              {t("form.fixed")}
            </Text>
            <Spacer />
            <Switch
              testID="new-income-fixed"
              accessibilityLabel={t("form.fixed")}
              value={fixed}
              onValueChange={setFixed}
              trackColor={{ false: colors.border, true: colors.tabActive }}
              thumbColor={colors.surface}
            />
          </HStack>

          <FormField label={t("form.note")}>
            <TextField
              testID="new-income-note"
              accessibilityLabel={t("form.note")}
              placeholder={t("form.notePlaceholder")}
              value={note}
              onChangeText={setNote}
            />
          </FormField>
        </VStack>

        {add.isError ? (
          <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">
            {t("form.saveError")}
          </Text>
        ) : null}
        <Button testID="new-income-save" label={add.isPending ? t("form.saving") : t("form.save")} busy={add.isPending} onPress={onSave} />
      </ScreenTemplate>
    </KeyboardAvoidingView>
  );
}
