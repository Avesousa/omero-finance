import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Chip, Divider, HStack, Icon, Skeleton, Surface, Text, VStack } from "../../components/atoms";
import {
  EmptyState,
  KeyboardDoneBar,
  PeriodSwitcher,
  SectionHeader,
  UndoToast,
  categoryColorIndex,
  categoryIcon,
  type AllocationSegment,
} from "../../components/molecules";
import { AllocationSummary, BudgetGoalsCard, BudgetLineRow, MascotMessage, ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import {
  OTHER_ALLOCATION_KEY,
  budgetAllocation,
  goalProgress,
  useBudget,
  useCategoryColorOrder,
  useCopyPreviousBudget,
  useFixedExpenses,
  usePlan,
  useSaveBudgetLine,
  useWealth,
  type BudgetLine,
} from "../../data";
import { useTheme } from "../../design-system";
import { formatDate, formatMoney } from "../../i18n/format";
import { useMascotStory } from "../../mascots/useMascotLine";

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const MIN_PERIOD = "2026-06";
const MAX_PERIOD = "2027-04";
/** Cuánto dura el aviso "Deshacer" al quitar un tope. */
const UNDO_MS = 5000;

const BAR_TONE = { ok: "primary", near: "warning", over: "danger", unbudgeted: "primary", unused: "primary" } as const;

interface Removed {
  categoryId: string;
  name: string;
  amount: number;
}

/**
 * Presupuesto del mes (pestaña): tarjeta Disponible / Por asignar con la barra por categoría, y las líneas (ahorro primero,
 * lo que sale solo y los gastos del mes) con el tope editable en línea y ✕ para quitarlo (con "Deshacer").
 */
export function BudgetScreen() {
  const { t } = useTranslation("budget");
  const { t: tc } = useTranslation("common");
  const { space, sizes } = useTheme();
  const qc = useQueryClient();
  const { name: mascotName } = useMascotStory();
  const [selected, setSelected] = useState<string | null>(null);
  const plan = usePlan(selected ?? undefined);
  const view = useBudget(selected ?? undefined);
  const period = selected ?? plan.data?.period ?? null;
  const colorOrder = useCategoryColorOrder(selected ?? undefined);
  const goals = useWealth();
  const fixed = useFixedExpenses(selected ?? undefined);
  const copy = useCopyPreviousBudget();
  const saveLine = useSaveBudgetLine();
  const [refreshing, setRefreshing] = useState(false);
  const [manage, setManage] = useState(false);
  const [removed, setRemoved] = useState<Removed | null>(null);

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [removed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([qc.invalidateQueries({ queryKey: ["plan"] }), qc.invalidateQueries({ queryKey: ["home"] })]);
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  const header = <ScreenHeader title={t("title")} />;
  const switcher = period ? <PeriodSwitcher period={period} onChange={setSelected} min={MIN_PERIOD} max={MAX_PERIOD} /> : null;

  const goalRows = useMemo(
    () => (goals.data?.goals ?? []).map((g) => ({ id: g.id, name: g.name, saved: g.saved, target: g.target, currency: g.currency, ratio: goalProgress(g).ratio })),
    [goals.data],
  );

  const colorOf = useCallback((categoryId: string | null) => categoryColorIndex(categoryId ?? "uncategorized", colorOrder), [colorOrder]);

  const allocation = useMemo(() => (view.data ? budgetAllocation(view.data) : null), [view.data]);
  const segments: AllocationSegment[] = useMemo(
    () => (allocation?.items ?? []).map((i) =>
        i.key === OTHER_ALLOCATION_KEY
          ? { key: i.key, label: t("hero.other"), value: i.value, colorIndex: 0, tone: "other" as const }
          : { key: i.key, label: i.name, value: i.value, colorIndex: colorOf(i.categoryId) },
      ),
    [allocation, colorOf, t],
  );

  const openCommitted = (line: BudgetLine, source: "cards" | "loans" | "fixed") => {
    if (source === "cards") router.push("/tarjetas");
    else if (source === "loans") router.push("/deudas");
    else router.push({ pathname: "/gastos-fijos", params: { ...(period ? { period } : {}), ...(line.categoryId ? { category: line.categoryId } : {}) } });
  };

  const edit = (categoryId: string | null) => {
    if (!categoryId || !period) return;
    router.push({ pathname: "/presupuesto/editar", params: { period, categoryId } });
  };

  const setCap = (categoryId: string | null, amount: number) => {
    if (!categoryId || !period) return;
    saveLine.mutate({ period, categoryId, amount });
  };

  const removeCap = (line: BudgetLine) => {
    if (!line.categoryId || !period || line.budget <= 0) return;
    const categoryId = line.categoryId;
    setRemoved({ categoryId, name: line.name, amount: line.budget });
    saveLine.mutate({ period, categoryId, amount: 0 }, { onError: () => setRemoved(null) });
  };

  const undoRemove = () => {
    if (removed) setCap(removed.categoryId, removed.amount);
    setRemoved(null);
  };

  if (view.isPending || plan.isPending) {
    return (
      <ScreenTemplate header={header} edges={["top", "bottom"]} testID="budget-loading">
        <VStack gap={4} accessibilityLabel={t("state.loading")} accessibilityLiveRegion="polite">
          <Skeleton height={190} />
          <Skeleton height={56} shape="pill" />
          <Skeleton height={150} />
          <Skeleton height={220} />
        </VStack>
      </ScreenTemplate>
    );
  }

  if (view.isError || plan.isError || !view.data || !period || !allocation) {
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
  const readOnly = b.projected;

  const variableCaption = (l: BudgetLine): string => {
    const base = l.budget > 0 ? t("row.of", { spent: formatMoney(l.actual), budget: formatMoney(l.budget) }) : t("row.noCap", { spent: formatMoney(l.actual) });
    return l.status === "near" || l.status === "over" ? `${base} · ${t(`status.${l.status}`)}` : base;
  };

  // De dónde sale cada línea de "Sale solo": tarjetas, gastos fijos (si la categoría tiene) o deudas y préstamos.
  const fixedCategories = new Set((fixed.data?.groups ?? []).map((g) => g.categoryId));
  const sourceOf = (l: BudgetLine): "cards" | "loans" | "fixed" => (l.isCards ? "cards" : l.categoryId !== null && fixedCategories.has(l.categoryId) ? "fixed" : "loans");

  const editableRow = (l: BudgetLine, caption: string, tone: "positive" | "primary" | "warning" | "danger") => {
    const id = l.categoryId ?? "uncategorized";
    return (
      <BudgetLineRow
        testID={`budget-row-${id}`}
        amountTestID={`budget-amount-${id}`}
        removeTestID={`budget-remove-${id}`}
        name={l.name}
        icon={categoryIcon(l.name)}
        colorIndex={colorOf(l.categoryId)}
        amount={l.budget}
        readOnlyAmountText={readOnly ? (l.budget > 0 ? formatMoney(l.budget) : "–") : undefined}
        onChangeAmount={(amount) => setCap(l.categoryId, amount)}
        onRemove={!readOnly && l.budget > 0 ? () => removeCap(l) : undefined}
        caption={caption}
        captionTone={l.status === "over" ? "dangerInk" : "inkMuted"}
        progress={l.budget > 0 ? { value: l.ratio, tone, label: t("variable.progress", { name: l.name, percent: `${Math.round(l.ratio * 100)} %` }) } : undefined}
      />
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenTemplate header={header} edges={["top", "bottom"]} testID="budget" refreshing={refreshing} onRefresh={onRefresh}>
        {switcher}
        {b.projected ? (
          <Text testID="budget-projected" variant="secondary" tone="inkMuted">
            {t("projected.notice", { month: capitalize(monthName(period)) })}
          </Text>
        ) : null}
        <AllocationSummary available={allocation.income} unassigned={allocation.free} segments={segments} />
        {saveLine.isError ? (
          <MascotMessage moment="budgetSaveError" mood="atento" />
        ) : (
          <MascotMessage moment={moment} params={free === 0 ? undefined : { amount: formatMoney(Math.abs(free)) }} mood={mood} />
        )}

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

        {b.withoutBudget.length > 0 && !readOnly ? (
          <Pressable
            testID="budget-manage"
            accessibilityRole="button"
            accessibilityState={{ expanded: manage }}
            accessibilityLabel={manage ? t("manage.close") : t("manage.open")}
            onPress={() => setManage((v) => !v)}
            style={({ pressed }) => ({ alignSelf: "flex-start", minHeight: sizes.touch, justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
          >
            <HStack gap={2}>
              <Icon name={manage ? "chevron-up" : "add-circle-outline"} size="sm" tone="primary" />
              <Text variant="bodyStrong" tone="primary">
                {manage ? t("manage.close") : t("manage.open")}
              </Text>
            </HStack>
          </Pressable>
        ) : null}

        {manage && b.withoutBudget.length > 0 && !readOnly ? (
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

        {b.savings ? (
          <VStack gap={2} testID="budget-savings">
            <SectionHeader title={t("savings.title")} />
            <Surface>
              {editableRow(
                b.savings,
                b.savings.budget > 0 ? t("savings.of", { actual: formatMoney(b.savings.actual), budget: formatMoney(b.savings.budget) }) : t("savings.empty"),
                "positive",
              )}
            </Surface>
          </VStack>
        ) : null}
        {goalRows.length > 0 ? <BudgetGoalsCard goals={goalRows} /> : null}

        {b.committed.length > 0 ? (
          <VStack gap={2} testID="budget-committed">
            <SectionHeader title={t("committed.title")} />
            <Text variant="secondary" tone="inkMuted">
              {t("committed.hint")}
            </Text>
            <Surface>
              {b.committed.map((l, i) => {
                const id = l.categoryId ?? "uncategorized";
                const source = sourceOf(l);
                return (
                  <View key={id}>
                    {i > 0 ? <Divider /> : null}
                    <BudgetLineRow
                      testID={`budget-committed-${id}`}
                      name={l.name}
                      icon={categoryIcon(l.name)}
                      colorIndex={colorOf(l.categoryId)}
                      amount={l.actual}
                      readOnlyAmountText={formatMoney(l.actual)}
                      caption={l.fixed && l.fixed.total > 0 ? t("row.paidOf", { paid: l.fixed.paid, total: l.fixed.total }) : undefined}
                      progress={l.actual > 0 ? { value: l.paid / l.actual, tone: "positive" } : undefined}
                      pressHint={t("committed.open", { name: l.name })}
                      onPress={() => openCommitted(l, source)}
                    />
                  </View>
                );
              })}
            </Surface>
          </VStack>
        ) : null}

        <VStack gap={2} testID="budget-variable">
          <SectionHeader title={t("variable.title")} />
          {b.variable.length === 0 ? (
            <Text variant="secondary" tone="inkMuted">
              {t("variable.empty")}
            </Text>
          ) : (
            <Surface>
              {b.variable.map((l, i) => (
                <View key={l.categoryId ?? "uncategorized"}>
                  {i > 0 ? <Divider /> : null}
                  {editableRow(l, variableCaption(l), BAR_TONE[l.status])}
                </View>
              ))}
            </Surface>
          )}
        </VStack>
      </ScreenTemplate>
      <KeyboardDoneBar />
      {removed ? (
        <UndoToast
          message={t("row.removed", { name: removed.name })}
          actionLabel={tc("actions.undo")}
          onAction={undoRemove}
          bottomOffset={sizes.tabBarHeight + space[3] * 2 + space[2]}
        />
      ) : null}
    </View>
  );
}
