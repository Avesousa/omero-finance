import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { HStack, IconButton, Button, Spacer, Surface, Text, TextField, VStack } from "../../components/atoms";
import { FormField, PeriodSwitcher, SegmentedToggle } from "../../components/molecules";
import { ScreenTemplate } from "../../components/templates";
import { previewLoan, useAddLoan, type NewLoanInput } from "../../data";
import { useTheme } from "../../design-system";
import { formatMoney, formatPeriod } from "../../i18n/format";
import { addMonths, currentPeriod, formatMoneyInput, parseMoney } from "../../domain";

const MIN_PERIOD = "2020-01";
const MAX_PERIOD = "2035-12";
const IVA_PCT = 21;
const MAX_INSTALLMENTS = 600;

type Direction = NewLoanInput["direction"];
type Mode = NewLoanInput["mode"];
type Currency = NewLoanInput["currency"];
type FieldKey = "name" | "amount" | "installments" | "rate" | "dueDay" | "suggested";

/** Número positivo o null si el campo está vacío / no se entiende. */
function num(text: string): number | null {
  const n = parseMoney(text);
  return Number.isFinite(n) ? n : null;
}

const digits = (text: string) => text.replace(/\D/g, "");

/** Nueva deuda o préstamo (modal): formulario con vista previa y validación. */
export function NewDebtScreen() {
  const { t } = useTranslation("debts");
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ direction?: string }>();
  const add = useAddLoan();

  const [direction, setDirection] = useState<Direction>(params.direction === "OWED" ? "OWED" : "OWE");
  const [mode, setMode] = useState<Mode>("FIXED");
  const [name, setName] = useState("");
  const [counterpart, setCounterpart] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("");
  const [rate, setRate] = useState("");
  const [annual, setAnnual] = useState(true);
  const [iva, setIva] = useState(false);
  const [startPeriod, setStartPeriod] = useState(() => addMonths(currentPeriod(), 1)) // la primera cuota suele caer el mes que viene;
  const [dueDay, setDueDay] = useState("");
  const [suggested, setSuggested] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const fixed = mode === "FIXED";
  const rateValue = num(rate);
  const hasRate = rateValue != null && rateValue > 0;

  const input: NewLoanInput = useMemo(
    () => ({
      direction,
      mode,
      name: name.trim(),
      counterpart: counterpart.trim() || null,
      currency,
      principal: num(amount) ?? 0,
      installments: fixed ? (digits(installments) ? Number(digits(installments)) : null) : null,
      installmentAmount: fixed ? null : num(suggested),
      interestRate: hasRate ? rateValue : null,
      interestAnnual: annual,
      interestTaxPct: hasRate && iva ? IVA_PCT : null,
      startPeriod,
      dueDay: digits(dueDay) ? Number(digits(dueDay)) : null,
      endDate: null,
    }),
    [direction, mode, name, counterpart, currency, amount, installments, suggested, hasRate, rateValue, annual, iva, startPeriod, dueDay, fixed],
  );

  const preview = useMemo(() => previewLoan(input), [input]);

  const errors: Partial<Record<FieldKey, string>> = {};
  if (!input.name) errors.name = t("errors.name");
  if (!(input.principal > 0)) errors.amount = t("errors.amount");
  if (fixed && !(input.installments != null && input.installments >= 1 && input.installments <= MAX_INSTALLMENTS)) {
    errors.installments = t("errors.installments");
  }
  if (rateValue != null && rateValue < 0) errors.rate = t("errors.rate");
  if (input.dueDay != null && (input.dueDay < 1 || input.dueDay > 31)) errors.dueDay = t("errors.dueDay");
  if (!fixed && suggested.trim() !== "" && !(input.installmentAmount != null && input.installmentAmount > 0)) {
    errors.suggested = t("errors.suggested");
  }
  const shown = (key: FieldKey) => (submitted ? errors[key] : undefined);

  const onSave = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    add.mutate(input, { onSuccess: () => router.back() });
  };

  const previewText = (() => {
    if (preview.installment == null) return null;
    const parts = [t(fixed ? "preview.installment" : "preview.suggested", { amount: formatMoney(preview.installment, currency) })];
    if (preview.totalToPay != null) parts.push(t("preview.total", { amount: formatMoney(preview.totalToPay, currency) }));
    if (preview.endPeriod) parts.push(t("preview.end", { month: formatPeriod(preview.endPeriod) }));
    return parts.join(" · ");
  })();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenTemplate edges={["top", "bottom"]} testID="new-debt">
        <HStack>
          <Text variant="screenTitle" accessibilityRole="header" style={{ flexShrink: 1 }}>
            {t(direction === "OWED" ? "form.titleOwed" : "form.title")}
          </Text>
          <Spacer />
          <IconButton icon="close" accessibilityLabel={t("form.close")} onPress={() => router.back()} />
        </HStack>

        <SegmentedToggle
          testID="new-debt-direction"
          accessibilityLabel={t("form.direction")}
          value={direction}
          onChange={setDirection}
          options={[
            { value: "OWE", label: t("toggle.owe") },
            { value: "OWED", label: t("toggle.owed") },
          ]}
        />
        <SegmentedToggle
          testID="new-debt-mode"
          accessibilityLabel={t("form.kindLabel")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "FIXED", label: t("loan.kind.FIXED") },
            { value: "OPEN", label: t("loan.kind.OPEN") },
          ]}
        />

        <VStack gap={4}>
          <FormField label={t("form.name")} error={shown("name")}>
            <TextField testID="new-debt-name" accessibilityLabel={t("form.name")} placeholder={t("form.namePlaceholder")} value={name} onChangeText={setName} />
          </FormField>
          <FormField label={t("form.counterpart")}>
            <TextField
              testID="new-debt-counterpart"
              accessibilityLabel={t("form.counterpart")}
              placeholder={t("form.counterpartPlaceholder")}
              value={counterpart}
              onChangeText={setCounterpart}
            />
          </FormField>
          <FormField label={t("form.currency")}>
            <SegmentedToggle
              testID="new-debt-currency"
              accessibilityLabel={t("form.currency")}
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "ARS", label: t("form.currencyARS") },
                { value: "USD", label: t("form.currencyUSD") },
              ]}
            />
          </FormField>
          <FormField label={t("form.amount")} error={shown("amount")}>
            <TextField
              testID="new-debt-amount"
              accessibilityLabel={t("form.amount")}
              placeholder={t("form.amountPlaceholder")}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(v) => setAmount(formatMoneyInput(v))}
            />
          </FormField>
          {fixed ? (
            <FormField label={t("form.installments")} error={shown("installments")}>
              <TextField
                testID="new-debt-installments"
                accessibilityLabel={t("form.installments")}
                placeholder={t("form.installmentsPlaceholder")}
                keyboardType="number-pad"
                value={installments}
                onChangeText={(v) => setInstallments(digits(v))}
              />
            </FormField>
          ) : null}
          <FormField label={t("form.rate")} error={shown("rate")}>
            <TextField
              testID="new-debt-rate"
              accessibilityLabel={t("form.rate")}
              placeholder={t("form.ratePlaceholder")}
              keyboardType="decimal-pad"
              value={rate}
              onChangeText={(v) => setRate(formatMoneyInput(v))}
            />
          </FormField>
          <SegmentedToggle
            testID="new-debt-annual"
            accessibilityLabel={t("form.rateBasis")}
            value={annual ? "annual" : "monthly"}
            onChange={(v) => setAnnual(v === "annual")}
            options={[
              { value: "annual", label: t("form.rateAnnual") },
              { value: "monthly", label: t("form.rateMonthly") },
            ]}
          />
          <HStack gap={3}>
            <Text variant="body" style={{ flexShrink: 1 }}>
              {t("form.tax")}
            </Text>
            <Spacer />
            <Switch
              testID="new-debt-iva"
              accessibilityLabel={t("form.tax")}
              value={iva}
              onValueChange={setIva}
              trackColor={{ false: colors.border, true: colors.tabActive }}
              thumbColor={colors.surface}
            />
          </HStack>
          <FormField label={t("form.startPeriod")}>
            <PeriodSwitcher period={startPeriod} onChange={setStartPeriod} min={MIN_PERIOD} max={MAX_PERIOD} />
          </FormField>
          <FormField label={t("form.dueDay")} error={shown("dueDay")}>
            <TextField
              testID="new-debt-dueday"
              accessibilityLabel={t("form.dueDay")}
              placeholder={t("form.dueDayPlaceholder")}
              keyboardType="number-pad"
              maxLength={2}
              value={dueDay}
              onChangeText={(v) => setDueDay(digits(v))}
            />
          </FormField>
          {!fixed ? (
            <FormField label={t("form.suggested")} error={shown("suggested")}>
              <TextField
                testID="new-debt-suggested"
                accessibilityLabel={t("form.suggested")}
                placeholder={t("form.suggestedPlaceholder")}
                keyboardType="decimal-pad"
                value={suggested}
                onChangeText={(v) => setSuggested(formatMoneyInput(v))}
              />
            </FormField>
          ) : null}
        </VStack>

        <Surface testID="new-debt-preview" accessibilityLiveRegion="polite">
          <VStack gap={2}>
            <Text variant="cardTitle">{t("preview.title")}</Text>
            <Text variant="body" tone={previewText ? "ink" : "inkMuted"}>
              {previewText ?? t(fixed ? "preview.emptyFixed" : "preview.emptyOpen")}
            </Text>
          </VStack>
        </Surface>

        {add.isError ? (
          <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">
            {t("form.saveError")}
          </Text>
        ) : null}
        <Button testID="new-debt-save" label={add.isPending ? t("form.saving") : t("form.save")} busy={add.isPending} onPress={onSave} />
      </ScreenTemplate>
    </KeyboardAvoidingView>
  );
}
