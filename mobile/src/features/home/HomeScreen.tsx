import { useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton, VStack } from "../../components/atoms";
import { AlertBanner, EmptyState } from "../../components/molecules";
import {
  AppHeader,
  BalanceHero,
  BudgetSummaryCard,
  FixedProgressCard,
  IncomeExpenseCards,
  MascotMessage,
  ShortcutRow,
  StoryTeaserCard,
  type ShortcutItem,
} from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { homeDefinitions, useBudget, useHome, useNotificationBadge } from "../../data";
import { useTheme } from "../../design-system";
import { capitalize, formatDate, formatMoney } from "../../i18n/format";
import { homeShortcuts } from "../../navigation/shortcuts";
import { usePrivacy } from "../../providers/PrivacyProvider";

/**
 * Inicio: héroe con el balance (y "Hoy podés gastar"), accesos rápidos, ingresos y gastos del mes, mensaje de la mascota,
 * presupuesto, gastos fijos e historia. Las cifras salen de `homeDefinitions` (data/plan.ts).
 */
export function HomeScreen() {
  const { t } = useTranslation("home");
  const { t: tc } = useTranslation("common");
  const { t: tt } = useTranslation("tabs");
  const { space } = useTheme();
  const { hidden, toggleHidden } = usePrivacy();
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useHome();
  const budget = useBudget();
  const badge = useNotificationBadge();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Mínimo de 700 ms: con datos locales responde al instante y el indicador no llegaría a verse.
      await Promise.all([
        refetch(),
        budget.refetch(),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        new Promise((r) => setTimeout(r, 700)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc, refetch, budget]);

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => homeShortcuts().map((s) => ({ key: s.key, icon: s.icon, label: tt(s.labelKey), onPress: () => router.push(s.route as never) })),
    [tt],
  );

  const header = (
    <AppHeader
      name={data?.greetingName}
      monthLabel={data ? capitalize(formatDate(data.period, "monthYear")) : ""}
      badgeCount={badge}
      mood={data && data.pendingConfirmCount > 0 ? "atento" : "feliz"}
      onBellPress={() => router.push("/notificaciones")}
    />
  );

  if (isPending) {
    return (
      <ScreenTemplate header={header} testID="home-loading">
        <VStack gap={4} accessibilityLabel={t("state.loading")} accessibilityLiveRegion="polite">
          <Skeleton height={190} shape="hero" />
          <Skeleton height={56} shape="pill" />
          <Skeleton height={170} />
          <Skeleton height={96} />
        </VStack>
      </ScreenTemplate>
    );
  }

  if (isError || !data) {
    return (
      <ScreenTemplate header={header} testID="home-error" refreshing={refreshing} onRefresh={onRefresh}>
        <EmptyState title={t("state.errorTitle")} description={t("state.errorBody")} action={{ label: tc("actions.retry"), onPress: () => void refetch() }} />
      </ScreenTemplate>
    );
  }

  const d = homeDefinitions(data);
  return (
    // Sin encabezado fijo ni margen de arriba: el héroe con degradé llega hasta el borde de la pantalla.
    <ScreenTemplate edges={[]} testID="home" refreshing={refreshing} onRefresh={onRefresh} contentStyle={{ paddingTop: 0 }}>
      <BalanceHero
        name={data.greetingName}
        monthLabel={capitalize(formatDate(data.period, "monthYear"))}
        badgeCount={badge}
        mood={data.pendingConfirmCount > 0 ? "atento" : "feliz"}
        onBellPress={() => router.push("/notificaciones")}
        balance={d.balance}
        perDay={d.perDay}
        freeMonth={d.freeMonth}
        hidden={hidden}
        onToggleHidden={toggleHidden}
        bleed={space[5]}
      />
      <ShortcutRow items={shortcutItems} bleed={space[5]} />
      <IncomeExpenseCards
        income={d.monthIncome}
        expenses={d.monthExpenses}
        hidden={hidden}
        onIncomePress={() => router.push("/movimientos?kind=income")}
        onExpensesPress={() => router.push("/movimientos?kind=expense")}
      />
      <MascotMessage moment="dailyRemainder" params={{ amount: formatMoney(d.perDay) }} />
      {data.pendingConfirmCount > 0 ? (
        <AlertBanner
          testID="pending-banner"
          icon="card-outline"
          text={t("alert.pendingApplePay", { count: data.pendingConfirmCount })}
          onPress={() => router.push("/notificaciones")}
        />
      ) : null}
      {budget.isPending ? (
        <Skeleton height={120} />
      ) : budget.data ? (
        <BudgetSummaryCard
          month={formatDate(data.period, "month")}
          empty={budget.data.assigned <= 0}
          spent={budget.data.variableTotals.actual}
          budget={budget.data.variableTotals.budget}
          near={budget.data.counts.near}
          over={budget.data.counts.over}
          onPress={() => router.push("/presupuesto")}
        />
      ) : null}
      <FixedProgressCard {...data.fixed} onPress={() => router.push("/gastos-fijos")} />
      <StoryTeaserCard chapter={data.story.chapter} progress={data.story.progress} onPress={() => router.push("/patrimonio")} />
    </ScreenTemplate>
  );
}
