import { useMemo, useState } from "react";
import { Switch } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Chip, HStack, Spacer, Surface, Text, TextField, VStack } from "../../components/atoms";
import { FormField, SegmentedToggle } from "../../components/molecules";
import { useCategories, type EntryKind, type NewEntryInput } from "../../data";
import { useTheme } from "../../design-system";
import {
  addDays,
  currentPeriod,
  daysInPeriod,
  formatMoneyInput,
  numberToInput,
  parseMoney,
  todayIso,
  type Frequency,
} from "../../domain";

type Currency = NewEntryInput["currency"];
export type DateMode = "today" | "yesterday" | "other";
type FieldKey = "name" | "amount" | "day" | "dueDay" | "weekday";

/** Lunes primero (como se lee en Argentina); el valor es el día de la semana de JS (0 = domingo). */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const BASE_FREQUENCIES: readonly Frequency[] = ["MONTHLY", "BIWEEKLY", "WEEKLY"];

const digits = (text: string) => text.replace(/\D/g, "");

/** Valores de arranque del formulario (un borrador de la mascota o un gasto fijo existente). */
export interface EntryFormInitial {
  name?: string | null;
  /** Monto por vez si es fijo. */
  amount?: number | null;
  currency?: Currency;
  categoryId?: string | null;
  /** 'YYYY-MM-DD' o null (= hoy). */
  date?: string | null;
  note?: string | null;
  fixed?: { frequency: Frequency; weekday?: number | null; dueDay?: number | null } | null;
}

export interface EntryFormValues {
  name: string;
  /** Monto por vez si es fijo. */
  amount: number;
  currency: Currency;
  categoryId: string | null;
  note: string | null;
  /** Fecha elegida ('YYYY-MM-DD'); null si el formulario no pide fecha. */
  date: string | null;
  dateMode: DateMode;
  /** Datos del fijo (los vigentes: si al editar no se aplica a la regla, quedan los de siempre). Null si no es fijo. */
  fixed: { frequency: Frequency; weekday: number | null; dueDay: number | null } | null;
  /** Solo en edición: guardar también en la regla (próximos meses). */
  applyToRule: boolean;
}

export interface EntryFormProps {
  kind: EntryKind;
  /** Prefijo de los testIDs: `<prefix>-name`, `-amount`, `-category-<id>`, `-save`… */
  testIDPrefix: string;
  /** `create`: movimiento nuevo. `edit`: gasto fijo existente (muestra "Aplicar también a los próximos meses"). */
  mode?: "create" | "edit";
  initial?: EntryFormInitial;
  /** Pide fecha (Hoy / Ayer / otro día). Default true. */
  showDate?: boolean;
  showNote?: boolean;
  /** `optional`: interruptor "Es fijo". `always`: siempre fijo (pantalla de gastos fijos). `never`: sin interruptor, es fijo solo si `initial.fixed` viene (editar un movimiento existente). Default `optional`. */
  fixedMode?: "optional" | "always" | "never";
  /** Marca desde el principio lo que falta (borrador que vino de la voz). */
  highlightMissing?: boolean;
  /** Texto del botón (ya traducido). */
  saveLabel: string;
  busy?: boolean;
  /** Error de guardado (ya traducido). */
  error?: string | null;
  onSubmit: (values: EntryFormValues) => void;
}

/**
 * Formulario de un movimiento, reutilizable para crear (ingreso o gasto, a mano o desde el chat) y para editar un gasto fijo.
 * No guarda nada: valida y entrega los valores en `onSubmit`; la pantalla decide qué mutación llamar.
 */
export function EntryForm({
  kind,
  testIDPrefix: id,
  mode = "create",
  initial,
  showDate = true,
  showNote = true,
  fixedMode = "optional",
  highlightMissing = false,
  saveLabel,
  busy = false,
  error,
  onSubmit,
}: EntryFormProps) {
  const { t } = useTranslation("entry");
  const { t: tf } = useTranslation("fixed");
  const { colors } = useTheme();
  const categories = useCategories(kind);
  const today = useMemo(() => todayIso(), []);
  const yesterday = useMemo(() => addDays(today, -1), [today]);

  // Fecha: Hoy / Ayer / otro día (mes del borrador, o el actual, + día del mes).
  const initialDate = initial?.date ?? null;
  const [dateMode, setDateMode] = useState<DateMode>(
    !initialDate || initialDate === today ? "today" : initialDate === yesterday ? "yesterday" : "other",
  );
  const [otherMonth] = useState(() => (initialDate ? initialDate.slice(0, 7) : currentPeriod()));
  const [day, setDay] = useState(() => (initialDate && initialDate !== today && initialDate !== yesterday ? String(Number(initialDate.slice(8, 10))) : ""));

  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(numberToInput(initial?.amount));
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "ARS");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [isFixed, setIsFixed] = useState(fixedMode === "always" || initial?.fixed != null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [frequency, setFrequency] = useState<Frequency>(initial?.fixed?.frequency ?? "MONTHLY");
  const [weekday, setWeekday] = useState<number | null>(initial?.fixed?.weekday ?? null);
  const [dueDay, setDueDay] = useState(initial?.fixed?.dueDay ? String(initial.fixed.dueDay) : "");
  const [applyToRule, setApplyToRule] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Al editar sin aplicar a la regla, la frecuencia y los días no cambian: se usan los de siempre.
  const editingRule = mode === "edit" && isFixed;
  const ruleFieldsOpen = isFixed && (mode === "create" || applyToRule);
  const effFrequency = ruleFieldsOpen ? frequency : (initial?.fixed?.frequency ?? frequency);
  const effWeekday = ruleFieldsOpen ? (frequency === "WEEKLY" ? weekday : null) : (initial?.fixed?.weekday ?? null);
  const effDueDay = ruleFieldsOpen ? (digits(dueDay) ? Number(digits(dueDay)) : null) : (initial?.fixed?.dueDay ?? null);

  const amountValue = parseMoney(amount);
  const maxDay = daysInPeriod(otherMonth);
  const dayNumber = digits(day) ? Number(digits(day)) : null;
  const date = !showDate
    ? null
    : dateMode === "today" ? today : dateMode === "yesterday" ? yesterday : dayNumber ? `${otherMonth}-${String(dayNumber).padStart(2, "0")}` : null;

  const errors: Partial<Record<FieldKey, string>> = {};
  if (!name.trim()) errors.name = t("errors.name");
  if (!(Number.isFinite(amountValue) && amountValue > 0)) errors.amount = t("errors.amount");
  if (showDate && dateMode === "other" && !(dayNumber != null && dayNumber >= 1 && dayNumber <= maxDay)) errors.day = t("errors.day");
  if (ruleFieldsOpen && frequency === "MONTHLY" && effDueDay != null && (effDueDay < 1 || effDueDay > 31)) errors.dueDay = t("errors.dueDay");
  if (ruleFieldsOpen && frequency === "WEEKLY" && weekday == null) errors.weekday = t("errors.weekday");

  const flag = submitted || highlightMissing;
  const shown = (key: FieldKey) => (flag ? errors[key] : undefined);
  const hasMissing = highlightMissing && Object.keys(errors).length > 0;

  const onSave = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0 || (showDate && !date)) return;
    onSubmit({
      name: name.trim(),
      amount: amountValue,
      currency,
      categoryId,
      note: showNote ? note.trim() || null : null,
      date,
      dateMode,
      fixed: isFixed ? { frequency: effFrequency, weekday: effFrequency === "WEEKLY" ? effWeekday : null, dueDay: effFrequency === "MONTHLY" ? effDueDay : null } : null,
      applyToRule: editingRule ? applyToRule : false,
    });
  };

  const frequencies = initial?.fixed?.frequency === "DAILY" ? ([...BASE_FREQUENCIES, "DAILY"] as Frequency[]) : BASE_FREQUENCIES;
  const perTime = isFixed && effFrequency !== "MONTHLY";

  return (
    <VStack gap={4}>
      {hasMissing ? (
        <Surface testID={`${id}-missing`}>
          <Text variant="secondary" tone="dangerInk">
            {t("form.missing")}
          </Text>
        </Surface>
      ) : null}

      <FormField label={t("form.name")} error={shown("name")}>
        <TextField testID={`${id}-name`} accessibilityLabel={t("form.name")} placeholder={t(`form.namePlaceholder.${kind}`)} value={name} onChangeText={setName} />
      </FormField>
      <FormField label={perTime ? t("form.amountPerTime") : t("form.amount")} error={shown("amount")}>
        <TextField
          testID={`${id}-amount`}
          accessibilityLabel={perTime ? t("form.amountPerTime") : t("form.amount")}
          placeholder={t("form.amountPlaceholder")}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={(v) => setAmount(formatMoneyInput(v))}
        />
      </FormField>
      <FormField label={t("form.currency")}>
        <SegmentedToggle
          testID={`${id}-currency`}
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
            <Chip
              key={c.id}
              testID={`${id}-category-${c.id}`}
              label={c.name}
              active={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          ))}
        </HStack>
      </FormField>

      {showDate ? (
        <FormField label={t("form.date")} error={shown("day")}>
          <VStack gap={2}>
            <SegmentedToggle
              testID={`${id}-date`}
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
                testID={`${id}-day`}
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
      ) : null}

      {fixedMode === "optional" ? (
        <HStack gap={3}>
          <Text variant="body" style={{ flexShrink: 1 }}>
            {t("form.fixed")}
          </Text>
          <Spacer />
          <Switch
            testID={`${id}-fixed`}
            accessibilityLabel={t("form.fixed")}
            value={isFixed}
            onValueChange={setIsFixed}
            trackColor={{ false: colors.border, true: colors.tabActive }}
            thumbColor={colors.surface}
          />
        </HStack>
      ) : null}

      {editingRule ? (
        <VStack gap={1}>
          <HStack gap={3}>
            <Text variant="bodyStrong" style={{ flexShrink: 1 }}>
              {t("form.applyToRule")}
            </Text>
            <Spacer />
            <Switch
              testID={`${id}-apply`}
              accessibilityLabel={t("form.applyToRule")}
              value={applyToRule}
              onValueChange={setApplyToRule}
              trackColor={{ false: colors.border, true: colors.tabActive }}
              thumbColor={colors.surface}
            />
          </HStack>
          <Text variant="secondary" tone="inkMuted">
            {t("form.applyToRuleHint")}
          </Text>
        </VStack>
      ) : null}

      {ruleFieldsOpen ? (
        <>
          <FormField label={t("form.frequency")}>
            <SegmentedToggle
              testID={`${id}-frequency`}
              accessibilityLabel={t("form.frequency")}
              value={frequency}
              onChange={setFrequency}
              options={frequencies.map((f) => ({ value: f, label: t(`form.frequency${f}`) }))}
            />
          </FormField>
          {frequency === "MONTHLY" ? (
            <FormField label={t("form.dueDay")} error={shown("dueDay")}>
              <TextField
                testID={`${id}-due-day`}
                accessibilityLabel={t("form.dueDay")}
                placeholder={t("form.dueDayPlaceholder")}
                keyboardType="number-pad"
                maxLength={2}
                value={dueDay}
                onChangeText={(v) => setDueDay(digits(v))}
              />
            </FormField>
          ) : null}
          {frequency === "WEEKLY" ? (
            <FormField label={t("form.weekday")} error={shown("weekday")}>
              <HStack gap={2} wrap>
                {WEEKDAY_ORDER.map((n) => (
                  <Chip key={n} testID={`${id}-weekday-${n}`} label={tf(`weekdayShort.${n}`)} active={weekday === n} onPress={() => setWeekday(n)} />
                ))}
              </HStack>
            </FormField>
          ) : null}
        </>
      ) : null}

      {showNote ? (
        <FormField label={t("form.note")}>
          <TextField
            testID={`${id}-note`}
            accessibilityLabel={t("form.note")}
            placeholder={t(`form.notePlaceholder.${kind}`)}
            value={note}
            onChangeText={setNote}
          />
        </FormField>
      ) : null}

      {error ? (
        <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button testID={`${id}-save`} label={busy ? t("form.saving") : saveLabel} busy={busy} onPress={onSave} />
    </VStack>
  );
}
