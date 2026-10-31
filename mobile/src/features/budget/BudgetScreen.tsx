import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Chip, HStack, Skeleton, Text, VStack } from "../../components/atoms";
import { EmptyState, PeriodSwitcher, SectionHeader } from "../../components/molecules";
import {
  BudgetCommittedCard,
  BudgetRowCard,
  BudgetSavingsCard,
  MascotMessage,
  MoneyHero,
  ScreenHeader,
  SpendingBreakdownCard,
  type CommittedItem,
} from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { spendingTotal, useBudget, useFixedExpenses, useCopyPreviousBudget, useHome, usePlan, useWealth, goalProgress, type BudgetLine } from "../../data";
import { useTheme } from "../../design-system";
import { formatDate, formatMoney } from "../../i18n/format";
import { useMascotStory } from "../../mascots/useMascotLine";
import { useSpendingItems } from "../home/useSpendingItems";

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const MIN_PERIOD = "2026-06";
const MAX_PERIOD = "2027-04";

/** Pantalla de Presupuesto del mes: el Libre como "sin asignar", ahorro primero, lo que sale solo y los topes de gasto. */
export function BudgetScreen() {
  const { t } = useTranslation("budget");
  const { t: tc } = useTranslation("common");
  const qc = useQueryClient();
  const { name: mascotName } = useMascotStory();
  const [selected, setSelected] = useState<string | null>(null);
  const plan = usePlan(selected ?? undefined);
  const view = useBudget(selected ?? undefined);
  const period = selected ?? plan.data?.period ?? null;
  const home = useHome(selected ?? undefined);
  const goals = useWealth();
  const fixed = useFixedExpenses(selected ?? undefined);
  const copy = useCopyPreviousBudget();
  const spendingItems = useSpendingItems(home.data);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([qc.invalidateQueries({ queryKey: ["plan"] }), qc.invalidateQueries({ queryKey: ["home"] })]);
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  const header = <ScreenHeader title={t("title")} onBack={() => router.back()} backLabel={t("back")} />;
  const switcher = period ? <PeriodSwitcher period={period} onChange={setSelected} min={MIN_PERIOD} max={MAX_PERIOD} /> : null;

  const goalRows = useMemo(
    () => (goals.data?.goals ?? []).map((g) => ({ id: g.id, name: g.name, saved: g.saved, target: g.target, currency: g.currency, ratio: goalProgress(g).ratio })),
    [goals.data],
  );

  const openCommitted = (item: CommittedItem) => {
    if (item.source === "cards") router.push("/tarjetas");
    else if (item.source === "loans") router.push("/deudas");
    else router.push({ pathname: "/gastos-fijos", params: { ...(period ? { period } : {}), ...(item.id !== "uncategorized" ? { category: item.id } : {}) } });
  };

  const edit = (categoryId: string | null) => {
    if (!categoryId || !period) return;
    router.push({ pathname: "/presupuesto/editar", params: { period, categoryId } });
  };

  if (view.isPending || plan.isPending) {
    return (
      <ScreenTemplate header={header} edges={["top", "bottom"]} testID="budget-loading">
        <VStack gap={4} accessibilityLabel={t("state.loading")} accessibilityLiveRegion="polite">
          <Skeleton height={190} shape="hero" />
          <Skeleton height={56} shape="pill" />
          <Skeleton height={150} />
          <Skeleton height={220} />
        </VStack>
      </ScreenTemplate>
    );
  }

  if (view.isError || plan.isError || !view.data || !period) {
    return (
      <ScreenTemplate header={header} edges={["top", "bottom"]} testID="budget-error" refreshing={refreshing} onRefresh={onRefresh}>
        {switcher}
        <EmptyState title={t("state.errorTitle")} description={t("state.errorBody")} action={{ label: tc("actions.retry"), onPress: () => void view.refetch() }} />
      </ScreenTemplate>
    );
  }

  const b = view.data;
  const monthName = (p: string) => formatDate(p, "month");
  const free = Math.round(b.free);
  const moment = free < 0 ? "budgetOver" : free === 0 ? "budgetBalanced" : "budgetUnassigned";
  const mood = free < 0 ? "atento" : free === 0 ? "festeja" : "feliz";
  const savingsId = b.savings?.categoryId ?? null;

  // De dónde sale cada línea: tarjetas, gastos fijos (si la categoría tiene) o deudas y préstamos.
  const fixedCategories = new Set((fixed.data?.groups ?? []).map((g) => g.categoryId));
  const committed: CommittedItem[] = b.committed.map((l: BudgetLine) => ({
    id: l.categoryId ?? "uncategorized",
    name: l.name,
    amount: l.actual,
    paidAmount: l.paid,
    paid: l.fixed?.paid ?? 0,
    total: l.fixed?.total ?? 0,
    source: l.isCards ? "cards" : l.categoryId !== null && fixedCategories.has(l.categoryId) ? "fixed" : "loans",
    cap: l.budget > 0 ? l.budget : undefined,
  }));

  return (
    <ScreenTemplate header={header} edges={["top", "bottom"]} testID="budget" refreshing={refreshing} onRefresh={onRefresh}>
      {switcher}
      {b.projected ? (
        <Text testID="budget-projected" variant="secondary" tone="inkMuted">
          {t("projected.notice", { month: capitalize(monthName(period)) })}
        </Text>
      ) : null}
      <HeroUnassigned free={b.free} income={b.income} assigned={b.assigned} />
      <MascotMessage moment={moment} params={free === 0 ? undefined : { amount: formatMoney(Math.abs(free)) }} mood={mood} />

      {b.assigned <= 0 || (b.canCopyPrevious && b.previousPeriod) || copy.isError ? (
        <VStack gap={2}>
          {b.assigned <= 0 ? (
            <Button
              testID="budget-assist"
              icon="sparkles-outline"
              label={t("actions.assist", { name: mascotName })}
              onPress={() => router.push({ pathname: "/presupuesto/armar", params: { period } })}
            />
          ) : null}
          {b.canCopyPrevious && b.previousPeriod ? (
            <Button
              testID="budget-copy"
              variant="secondary"
              icon="copy-outline"
              label={copy.isPending ? t("actions.copying") : t("actions.copy", { month: monthName(b.previousPeriod) })}
              busy={copy.isPending}
              onPress={() => copy.mutate({ period })}
            />
          ) : null}
          {copy.isError ? (
            <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">
              {t("actions.copyError")}
            </Text>
          ) : null}
        </VStack>
      ) : null}

      {b.savings ? (
        <BudgetSavingsCard
          testID={savingsId ? `budget-row-${savingsId}` : undefined}
          budget={b.savings.budget}
          actual={b.savings.actual}
          goals={goalRows}
          onPress={() => edit(savingsId)}
        />
      ) : null}

      {committed.length > 0 ? <BudgetCommittedCard items={committed} onItemPress={openCommitted} /> : null}

      <VStack gap={3} testID="budget-variable">
        <SectionHeader title={t("variable.title")} />
        {b.variable.length === 0 ? (
          <Text variant="secondary" tone="inkMuted">
            {t("variable.empty")}
          </Text>
        ) : (
          b.variable.map((l) => (
            <BudgetRowCard
              key={l.categoryId ?? "uncategorized"}
              testID={`budget-row-${l.categoryId ?? "uncategorized"}`}
              name={l.name}
              spent={l.actual}
              budget={l.budget}
              status={l.status}
              onPress={() => edit(l.categoryId)}
            />
          ))
        )}
      </VStack>

      {b.withoutBudget.length > 0 ? (
        <VStack gap={2} testID="budget-add">
          <SectionHeader title={t("add.title")} />
          <Text variant="secondary" tone="inkMuted">
            {t("add.hint")}
          </Text>
          <HStack gap={2} wrap>
            {b.withoutBudget.map((c) => (
              <Chip key={c.categoryId} testID={`budget-add-${c.categoryId}`} label={c.name} onPress={() => edit(c.categoryId)} />
            ))}
          </HStack>
        </VStack>
      ) : null}

      {home.data && spendingItems.length > 0 ? <SpendingBreakdownCard items={spendingItems} total={spendingTotal(home.data.spendingByCategory)} /> : null}
    </ScreenTemplate>
  );
}

/** Héroe "SIN ASIGNAR": el Libre. Si es negativo el monto sigue blanco sobre el azul del héroe (el rojo no contrasta ahí) y el aviso va en una píldora danger-tint. */
function HeroUnassigned({ free, income, assigned }: { free: number; income: number; assigned: number }) {
  const { t } = useTranslation("budget");
  const { colors, radius, space } = useTheme();
  const over = Math.round(free) < 0;
  return (
    <MoneyHero
      testID="budget-hero"
      label={t("hero.label")}
      amount={free}
      amountTestID="budget-hero-amount"
      caption={
        over ? (
          <View
            testID="budget-hero-over"
            style={{ alignSelf: "flex-start", backgroundColor: colors.dangerTint, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1] }}
          >
            <Text variant="secondaryStrong" tone="dangerInk">
              {t("hero.over")}
            </Text>
          </View>
        ) : undefined
      }
      footer={{ left: t("hero.income", { amount: formatMoney(income) }), right: t("hero.assigned", { amount: formatMoney(assigned) }) }}
    />
  );
}
