import { useCallback, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton, VStack } from "../../components/atoms";
import { AlertBanner, EmptyState } from "../../components/molecules";
import {
  AppHeader,
  FixedProgressCard,
  HeroGasto,
  MascotMessage,
  SpendingBreakdownCard,
  StoryTeaserCard,
  type SpendingItem,
} from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { dailyAllowance, spendingTotal, useHome, useNotificationBadge } from "../../data";
import { capitalize, formatDate, formatMoney } from "../../i18n/format";
import { useHeroView } from "./useHeroView";

/** Inicio: héroe "Hoy podés gastar", mensaje de la mascota, en qué se va el mes, fijos e historia. */
export function HomeScreen() {
  const { t } = useTranslation("home");
  const { t: tc } = useTranslation("common");
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useHome();
  const badge = useNotificationBadge();
  const [view, setView] = useHeroView();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), qc.invalidateQueries({ queryKey: ["notifications"] })]);
    } finally {
      setRefreshing(false);
    }
  }, [qc, refetch]);

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

  const perDay = dailyAllowance(data.free, data.daysLeft);
  const items: SpendingItem[] = data.spendingByCategory.map((c) => ({
    id: c.id,
    label: c.labelKey ? (t as unknown as (k: string) => string)(c.labelKey) : (c.name ?? c.id),
    amount: c.amount,
  }));

  return (
    <ScreenTemplate header={header} testID="home" refreshing={refreshing} onRefresh={onRefresh}>
      <HeroGasto perDay={perDay} daysLeft={data.daysLeft} available={data.available} free={data.free} view={view} onViewChange={setView} />
      <MascotMessage moment="dailyRemainder" params={{ amount: formatMoney(perDay) }} />
      {data.pendingConfirmCount > 0 ? (
        <AlertBanner
          testID="pending-banner"
          icon="card-outline"
          text={t("alert.pendingApplePay", { count: data.pendingConfirmCount })}
          onPress={() => router.push("/notificaciones")}
        />
      ) : null}
      <SpendingBreakdownCard items={items} total={spendingTotal(data.spendingByCategory)} />
      <FixedProgressCard {...data.fixed} />
      <StoryTeaserCard chapter={data.story.chapter} progress={data.story.progress} />
    </ScreenTemplate>
  );
}
