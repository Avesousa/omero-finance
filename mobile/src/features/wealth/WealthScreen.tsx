import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton, Text, VStack } from "../../components/atoms";
import type { IconName } from "../../components/atoms";
import { EmptyState, SegmentedToggle } from "../../components/molecules";
import {
  GoalsCard,
  MascotMessage,
  NestCard,
  ScreenHeader,
  WealthGroupCard,
  WealthHero,
  WealthTrendCard,
  type WealthGroupRow,
} from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { equityRatio, goalProgress, itemShare, nestStage, toArs, useWealth, wealthDelta, wealthTotals } from "../../data";
import type { Currency, WealthItem } from "../../data/types";
import { formatMoney } from "../../i18n/format";
import { useMascotNest } from "../../mascots";

function iconFor(item: WealthItem): IconName {
  if (item.source === "loan") return "business-outline";
  if (item.source === "card") return "card-outline";
  return item.currency === "USD" ? "cash-outline" : "wallet-outline";
}

/** Patrimonio: neto del mes, evolución, lo que tenés y lo que debés, con toggle ARS | USD. */
export function WealthScreen() {
  const { t } = useTranslation("wealth");
  const { t: tc } = useTranslation("common");
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useWealth();
  const nestName = useMascotNest().name;
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await qc.invalidateQueries({ queryKey: ["wealth"] });
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  const view = useMemo(() => {
    if (!data) return null;
    const rate = data.usdRate;
    const conv = (ars: number) => (currency === "USD" ? ars / rate : ars);
    const totals = wealthTotals(data.items, rate);
    const rawDelta = wealthDelta(data.history);
    const toRow = (item: WealthItem): WealthGroupRow => {
      const sameAsScreen = item.currency === currency;
      const native = item.currency === "USD" && currency === "ARS";
      // Montos ARS en modo USD se convierten; un ítem en USD se muestra nativo en ambos modos.
      const rowCurrency = native ? "USD" : currency;
      const show = (value: number, from: Currency) => (native || sameAsScreen ? value : conv(toArs(value, from, rate)));
      const amount = show(item.amount, item.currency);
      const diff = item.previous == null ? null : amount - show(item.previous, item.currency);
      return {
        id: item.id,
        name: item.name,
        icon: iconFor(item),
        amount,
        currency: rowCurrency,
        approx: native ? { amount: toArs(item.amount, item.currency, rate), currency: "ARS" } : undefined,
        delta:
          diff == null || item.previous == null
            ? null
            : { amount: diff, ratio: item.previous > 0 ? (item.amount - item.previous) / item.previous : null },
        share: itemShare(item, data.items, rate),
        loan: item.loan,
      };
    };
    const group = (kind: WealthItem["kind"]) =>
      data.items
        .filter((i) => i.kind === kind)
        .sort((a, b) => toArs(b.amount, b.currency, rate) - toArs(a.amount, a.currency, rate))
        .map(toRow);
    const stage = nestStage(equityRatio(totals.assets, totals.debts));
    const goals = data.goals.map((g) => ({
      ...g,
      // Las metas se muestran en su moneda de origen en ambos modos.
      ...goalProgress(g),
    }));
    return {
      stage,
      goals,
      net: conv(totals.net),
      assets: conv(totals.assets),
      debts: conv(totals.debts),
      delta: rawDelta ? { amount: conv(rawDelta.amount), ratio: rawDelta.ratio } : null,
      history: data.history.map((h) => ({ period: h.period, net: conv(h.netArs) })),
      assetRows: group("asset"),
      debtRows: group("debt"),
      rate,
    };
  }, [data, currency]);

  const header = (
    <ScreenHeader
      title={t("title")}
      subtitle={nestName}
      right={
        <SegmentedToggle<Currency>
          testID="wealth-currency"
          accessibilityLabel={t("currency.label")}
          value={currency}
          onChange={setCurrency}
          options={[
            { value: "ARS", label: t("currency.ARS") },
            { value: "USD", label: t("currency.USD") },
          ]}
        />
      }
    />
  );

  if (isPending) {
    return (
      <ScreenTemplate header={header} testID="wealth-loading">
        <VStack gap={4} accessibilityLabel={t("state.loading")} accessibilityLiveRegion="polite">
          <Skeleton height={190} shape="hero" />
          <Skeleton height={56} shape="pill" />
          <Skeleton height={170} />
          <Skeleton height={220} />
        </VStack>
      </ScreenTemplate>
    );
  }

  if (isError || !view) {
    return (
      <ScreenTemplate header={header} testID="wealth-error" refreshing={refreshing} onRefresh={onRefresh}>
        <EmptyState title={t("state.errorTitle")} description={t("state.errorBody")} action={{ label: tc("actions.retry"), onPress: () => void refetch() }} />
      </ScreenTemplate>
    );
  }

  const delta = view.delta;
  const rounded = delta ? Math.round(delta.amount) : 0;
  const moment = rounded > 0 ? "wealthUp" : rounded < 0 ? "wealthDown" : "wealth";
  const params = moment === "wealthUp" ? { amount: formatMoney(rounded, currency) } : undefined;

  return (
    <ScreenTemplate header={header} testID="wealth" refreshing={refreshing} onRefresh={onRefresh}>
      <WealthHero net={view.net} assets={view.assets} debts={view.debts} currency={currency} delta={delta} />
      <MascotMessage moment={moment} params={params} />
      <NestCard chapter={view.stage.chapter} progress={view.stage.progress} equity={view.stage.equity} />
      {view.goals.length > 0 ? <GoalsCard goals={view.goals} /> : null}
      <WealthTrendCard history={view.history} currency={currency} />
      <WealthGroupCard
        testID="wealth-assets"
        title={t("assets.title")}
        kind="asset"
        total={view.assets}
        currency={currency}
        rows={view.assetRows}
        emptyText={t("state.emptyGroup")}
      />
      <WealthGroupCard
        testID="wealth-debts"
        title={t("debts.title")}
        kind="debt"
        total={view.debts}
        currency={currency}
        rows={view.debtRows}
        emptyText={t("state.emptyGroup")}
      />
      <Text variant="secondary" tone="inkMuted" align="center">
        {t("rate", { rate: formatMoney(view.rate) })}
      </Text>
    </ScreenTemplate>
  );
}
