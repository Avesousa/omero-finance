import { useCallback, useMemo, useState } from "react";
import { Pressable } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button, HStack, Icon, Skeleton, Text, VStack } from "../../components/atoms";
import { EmptyState, PeriodSwitcher, SegmentedToggle } from "../../components/molecules";
import { CardsDebtRow, LoanCard, MascotMessage, MoneyHero, ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import {
  daysUntil,
  debtsTotals,
  loanRow,
  useDebts,
  useMarkLoanPaid,
  type DebtsOverview,
  type LoanRow,
} from "../../data";
import { formatMoney } from "../../i18n/format";
import { useSectionTitle } from "../../navigation";
import type { MascotMoment, Mood } from "../../mascots";

const MIN_PERIOD = "2026-06";
const MAX_PERIOD = "2027-04";
/** Días para considerar un vencimiento "cerca". */
const DUE_SOON_DAYS = 5;

type Direction = "OWE" | "OWED";

/** Deudas: lo que debés (préstamos y tarjetas) y lo que te deben, con la cuota del mes de cada una. */
export function DebtsScreen() {
  const { t } = useTranslation("debts");
  const { t: tc } = useTranslation("common");
  const sectionTitle = useSectionTitle("debts");
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isPending, isError, refetch } = useDebts(selected ?? undefined);
  const markPaid = useMarkLoanPaid();
  const [refreshing, setRefreshing] = useState(false);
  const period = selected ?? data?.period ?? null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), qc.invalidateQueries({ queryKey: ["home"] })]);
    } finally {
      setRefreshing(false);
    }
  }, [qc, refetch]);

  const header = <ScreenHeader title={sectionTitle} onBack={() => router.back()} backLabel={tc("actions.back")} />;
  const switcher = period ? <PeriodSwitcher period={period} onChange={setSelected} min={MIN_PERIOD} max={MAX_PERIOD} /> : null;

  if (isPending) {
    return (
      <ScreenTemplate header={header} testID="debts-loading">
        <VStack gap={4} accessibilityLabel={t("state.loading")} accessibilityLiveRegion="polite">
          {switcher}
          <Skeleton height={190} shape="hero" />
          <Skeleton height={56} shape="pill" />
          <Skeleton height={240} />
          <Skeleton height={240} />
        </VStack>
      </ScreenTemplate>
    );
  }

  if (isError || !data || !period) {
    return (
      <ScreenTemplate header={header} testID="debts-error" refreshing={refreshing} onRefresh={onRefresh}>
        {switcher}
        <EmptyState title={t("state.errorTitle")} description={t("state.errorBody")} action={{ label: tc("actions.retry"), onPress: () => void refetch() }} />
      </ScreenTemplate>
    );
  }

  if (data.loans.length === 0 && data.cards.count === 0) {
    return (
      <ScreenTemplate header={header} testID="debts-empty" refreshing={refreshing} onRefresh={onRefresh}>
        {switcher}
        <EmptyState
          title={t("state.emptyTitle")}
          description={t("state.emptyBody")}
          action={{ label: t("list.addOwe"), onPress: () => router.push("/deudas/nueva?direction=OWE") }}
        />
      </ScreenTemplate>
    );
  }

  return (
    <ScreenTemplate header={header} testID="debts" refreshing={refreshing} onRefresh={onRefresh}>
      {switcher}
      <DebtsBody
        data={data}
        period={period}
        markingId={markPaid.isPending ? markPaid.variables?.loanId : undefined}
        onMarkPaid={(loanId) => markPaid.mutate({ loanId, period })}
      />
    </ScreenTemplate>
  );
}

function paidAmountOf(data: DebtsOverview, row: LoanRow): number {
  const loan = data.loans.find((l) => l.id === row.id);
  return loan ? Math.max(0, loan.principal - row.capital) : 0;
}

function DebtsBody({
  data,
  period,
  markingId,
  onMarkPaid,
}: {
  data: DebtsOverview;
  period: string;
  markingId?: string;
  onMarkPaid: (loanId: string) => void;
}) {
  const { t } = useTranslation("debts");
  const [view, setView] = useState<Direction>("OWE");
  const [showFinished, setShowFinished] = useState(false);
  const totals = debtsTotals(data);

  const rows = useMemo(() => data.loans.map((l) => loanRow(l, period, data.usdRate)), [data, period]);
  const open = rows.filter((r) => r.direction === view && !r.finished);
  const finished = rows.filter((r) => r.direction === view && r.finished);
  const owe = view === "OWE";

  // Mascota: lo más urgente del mes en cada vista.
  let moment: MascotMoment | null = null;
  let params: Record<string, string | number> | undefined;
  let mood: Mood = "feliz";
  if (owe) {
    const upcoming: { name: string; days: number }[] = [];
    for (const r of rows) {
      if (r.direction !== "OWE" || r.finished || !r.monthPayment || r.monthPayment.isDone || !r.monthPayment.dueDate) continue;
      upcoming.push({ name: r.name, days: daysUntil(r.monthPayment.dueDate, data.today) });
    }
    if (data.cards.nextDue) upcoming.push({ name: t("cards.name"), days: daysUntil(data.cards.nextDue, data.today) });
    const soon = upcoming.filter((u) => u.days <= DUE_SOON_DAYS).sort((a, b) => a.days - b.days)[0];
    if (soon) {
      moment = "debtsDueSoon";
      params = soon.days > 0 ? { name: soon.name, count: soon.days } : { name: soon.name };
      mood = "atento";
    } else if (totals.monthToPayArs <= 0 && totals.oweArs > 0) {
      moment = "debtsAllPaid";
      mood = "festeja";
    } else if (totals.oweArs > 0) {
      moment = "debts";
      params = { amount: formatMoney(totals.monthToPayArs) };
    }
  } else if (open.length > 0) {
    const pending = open.find((r) => !r.monthPayment || !r.monthPayment.isDone);
    if (pending) {
      const amount = pending.monthPayment ? pending.monthPayment.amount : pending.capital;
      moment = "owedPending";
      params = { name: pending.counterpart ?? pending.name, amount: formatMoney(amount, pending.currency) };
      mood = "atento";
    } else {
      moment = "owedAllCollected";
      mood = "festeja";
    }
  }

  const loanCard = (r: LoanRow) => (
    <LoanCard
      key={r.id}
      testID={`loan-${r.id}`}
      direction={r.direction}
      mode={r.mode}
      name={r.name}
      counterpart={r.counterpart}
      currency={r.currency}
      capital={r.capital}
      capitalArs={r.capitalArs}
      paidRatio={r.paidRatio}
      paidAmount={paidAmountOf(data, r)}
      installmentNumber={r.installmentNumber}
      installmentsTotal={r.installmentsTotal}
      rate={r.rate}
      monthPayment={r.monthPayment}
      period={period}
      busy={markingId === r.id}
      onMarkPaid={() => onMarkPaid(r.id)}
    />
  );

  return (
    <>
      <MoneyHero
        testID="debts-hero"
        label={t(owe ? "hero.oweLabel" : "hero.owedLabel")}
        amount={owe ? totals.oweArs : totals.owedArs}
        amountTestID="debts-hero-amount"
        caption={
          <Text variant="secondaryStrong" tone="onPrimary">
            {t(owe ? "hero.oweCaption" : "hero.owedCaption", { amount: formatMoney(owe ? totals.monthToPayArs : totals.monthToCollectArs) })}
          </Text>
        }
      >
        <SegmentedToggle
          testID="debts-toggle"
          appearance="hero"
          accessibilityLabel={t("toggle.label")}
          value={view}
          onChange={setView}
          options={[
            { value: "OWE", label: t("toggle.owe") },
            { value: "OWED", label: t("toggle.owed") },
          ]}
        />
      </MoneyHero>
      {moment ? <MascotMessage moment={moment} params={params} mood={mood} /> : null}
      {owe && data.cards.count > 0 ? (
        <CardsDebtRow
          testID="debts-cards"
          count={data.cards.count}
          amount={data.cards.debtArs}
          nextDue={data.cards.nextDue}
          onPress={() => router.push("/tarjetas")}
        />
      ) : null}
      {open.map(loanCard)}
      {open.length === 0 && !(owe && data.cards.count > 0) ? (
        <Text variant="body" tone="inkMuted" align="center">
          {t(owe ? "list.noneOwe" : "list.noneOwed")}
        </Text>
      ) : null}
      {finished.length > 0 ? (
        <>
          <Pressable
            testID="debts-finished-toggle"
            accessibilityRole="button"
            accessibilityLabel={t("list.finishedToggle")}
            accessibilityState={{ expanded: showFinished }}
            onPress={() => setShowFinished((v) => !v)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <HStack gap={2}>
              <Text variant="cardTitle">{`${t("list.finished")} (${finished.length})`}</Text>
              <Icon name={showFinished ? "chevron-up" : "chevron-down"} tone="inkMuted" size="sm" />
            </HStack>
          </Pressable>
          {showFinished ? finished.map(loanCard) : null}
        </>
      ) : null}
      <Button
        testID="debts-add"
        variant="secondary"
        label={t(owe ? "list.addOwe" : "list.addOwed")}
        icon="add"
        onPress={() => router.push(`/deudas/nueva?direction=${view}`)}
      />
    </>
  );
}
