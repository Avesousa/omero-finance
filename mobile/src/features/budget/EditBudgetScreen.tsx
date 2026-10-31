import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Chip, HStack, IconButton, Skeleton, Spacer, Text, TextField, VStack } from "../../components/atoms";
import { EmptyState, FormField } from "../../components/molecules";
import { ScreenTemplate } from "../../components/templates";
import { suggestedBudget, usePlan, useSaveBudget } from "../../data";
import { formatMoneyInput, numberToInput, parseMoney } from "../../domain";
import { useTheme } from "../../design-system";
import { formatDate, formatMoney } from "../../i18n/format";

/** Editar el tope de una categoría del mes (modal): monto con formato es-AR, sugerencias en chips, Quitar tope y Guardar. */
export function EditBudgetScreen() {
  const { t } = useTranslation("budget");
  const { t: tc } = useTranslation("common");
  const params = useLocalSearchParams<{ period?: string; categoryId?: string }>();
  const plan = usePlan(params.period);
  const save = useSaveBudget();
  const { space } = useTheme();
  const [amount, setAmount] = useState<string | null>(null);

  const data = plan.data;
  const category = data?.categories.find((c) => c.id === params.categoryId);
  const current = data?.budgets.find((b) => b.categoryId === params.categoryId)?.amount ?? 0;
  const suggestion = useMemo(() => (data && category ? suggestedBudget(data, category.id) : null), [data, category]);

  const header = (
    <HStack gap={3} style={{ paddingHorizontal: space[5] }}>
      <Text variant="screenTitle" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {category ? t("edit.title", { name: category.name }) : t("title")}
      </Text>
      <Spacer />
      <IconButton testID="budget-edit-close" icon="close" accessibilityLabel={t("edit.close")} onPress={() => router.back()} />
    </HStack>
  );

  if (plan.isPending) {
    return (
      <ScreenTemplate edges={["top", "bottom"]} testID="budget-edit-loading">
        <VStack gap={4}>
          <Skeleton height={56} shape="pill" />
          <Skeleton height={56} shape="pill" />
        </VStack>
      </ScreenTemplate>
    );
  }

  if (plan.isError || !data || !category) {
    return (
      <ScreenTemplate edges={["top", "bottom"]} testID="budget-edit-error">
        <EmptyState
          title={t("state.errorTitle")}
          description={plan.isError ? t("state.errorBody") : t("edit.notFound")}
          action={{ label: tc("actions.close"), onPress: () => router.back() }}
        />
      </ScreenTemplate>
    );
  }

  const text = amount ?? numberToInput(current > 0 ? current : null);
  const value = parseMoney(text);
  const valid = Number.isFinite(value) && value > 0;
  const month = formatDate(data.period, "month");

  const chips: { key: string; label: string; value: number }[] = [];
  if (suggestion?.previous && data.previousBudgetPeriod) {
    chips.push({
      key: "previous",
      label: t("edit.samePrevious", { month: formatDate(data.previousBudgetPeriod, "month"), amount: formatMoney(suggestion.previous) }),
      value: suggestion.previous,
    });
  }
  if (suggestion && suggestion.spentNow > 0) {
    const spent = Math.round(suggestion.spentNow);
    chips.push({ key: "spent", label: t("edit.spent", { amount: formatMoney(spent) }), value: spent });
  }

  const persist = (next: number) =>
    save.mutate({ period: data.period, items: [{ categoryId: category.id, amount: next }] }, { onSuccess: () => router.back() });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenTemplate header={header} edges={["top", "bottom"]} testID="budget-edit">
        <Text variant="secondary" tone="inkMuted">
          {t("edit.subtitle", { month })}
        </Text>
        <FormField label={t("edit.amount")} error={amount !== null && !valid ? t("edit.invalid") : undefined}>
          <TextField
            testID="budget-edit-amount"
            accessibilityLabel={t("edit.amount")}
            placeholder={t("edit.amountPlaceholder")}
            keyboardType="decimal-pad"
            autoFocus
            value={text}
            onChangeText={(v) => setAmount(formatMoneyInput(v))}
          />
        </FormField>
        {chips.length > 0 ? (
          <VStack gap={2}>
            <Text variant="secondaryStrong">{t("edit.suggestions")}</Text>
            <HStack gap={2} wrap>
              {chips.map((c) => (
                <Chip key={c.key} testID={`budget-edit-${c.key}`} label={c.label} active={valid && value === c.value} onPress={() => setAmount(numberToInput(c.value))} />
              ))}
            </HStack>
          </VStack>
        ) : null}
        {save.isError ? (
          <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">
            {t("edit.error")}
          </Text>
        ) : null}
        <VStack gap={2}>
          <Button
            testID="budget-edit-save"
            label={save.isPending ? t("edit.saving") : t("edit.save")}
            busy={save.isPending}
            disabled={!valid}
            onPress={() => valid && persist(Math.round(value))}
          />
          {current > 0 ? <Button testID="budget-edit-remove" variant="secondary" label={t("edit.remove")} disabled={save.isPending} onPress={() => persist(0)} /> : null}
        </VStack>
      </ScreenTemplate>
    </KeyboardAvoidingView>
  );
}
