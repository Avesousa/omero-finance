import { useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton, VStack } from "../../components/atoms";
import { EmptyState, PeriodSwitcher, SectionHeader } from "../../components/molecules";
import {
  CardsSummaryHero,
  CardStatementCard,
  CommittedMonthsCard,
  InstallmentsCard,
  MascotMessage,
  ScreenHeader,
  type InstallmentItem,
} from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import {
  cardMonth,
  cardsTotals,
  committedByMonth,
  daysUntil,
  installmentsInPeriod,
  statementStatus,
  useCards,
  useMarkStatementPaid,
  type CardsOverview,
  type StatementStatus,
} from "../../data";
import { useSectionTitle } from "../../navigation";
import { formatPeriod } from "../../i18n/format";
import type { MascotMoment, Mood } from "../../mascots";

const MIN_PERIOD = "2026-06";
const MAX_PERIOD = "2027-04";
const COMMITTED_MONTHS = 6;
const ORDER: StatementStatus[] = ["overdue", "dueSoon", "upcoming", "estimated", "empty", "paid"];

/** Tarjetas: lo que se paga este mes, cada resumen con su estado, las cuotas del mes y lo comprometido. */
export function CardsScreen() {
  const { t } = useTranslation("cards");
  const sectionTitle = useSectionTitle("cards");
  const { t: tc } = useTranslation("common");
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isPending, isError, refetch } = useCards(selected ?? undefined);
  const markPaid = useMarkStatementPaid();
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

  const header = <ScreenHeader title={sectionTitle} />;
  const switcher = period ? <PeriodSwitcher period={period} onChange={setSelected} min={MIN_PERIOD} max={MAX_PERIOD} /> : null;

  if (isPending) {
    return (
      <ScreenTemplate header={header} testID="cards-loading">
        <VStack gap={4} accessibilityLabel={t("state.loading")} accessibilityLiveRegion="polite">
          {switcher}
          <Skeleton height={56} shape="pill" />
          <Skeleton height={150} shape="hero" />
          <Skeleton height={150} />
          <Skeleton height={150} />
          <Skeleton height={170} />
        </VStack>
      </ScreenTemplate>
    );
  }

  if (isError || !data || !period) {
    return (
      <ScreenTemplate header={header} testID="cards-error" refreshing={refreshing} onRefresh={onRefresh}>
        {switcher}
        <EmptyState title={t("state.errorTitle")} description={t("state.errorBody")} action={{ label: tc("actions.retry"), onPress: () => void refetch() }} />
      </ScreenTemplate>
    );
  }

  if (data.cards.length === 0) {
    return (
      <ScreenTemplate header={header} testID="cards-empty" refreshing={refreshing} onRefresh={onRefresh}>
        {switcher}
        <EmptyState title={t("state.emptyTitle")} description={t("state.emptyBody")} />
      </ScreenTemplate>
    );
  }

  return (
    <ScreenTemplate header={header} testID="cards" refreshing={refreshing} onRefresh={onRefresh}>
      {switcher}
      <CardsBody data={data} period={period} markingId={markPaid.isPending ? markPaid.variables?.cardId : undefined} onMarkPaid={(cardId) => markPaid.mutate({ cardId, period })} />
    </ScreenTemplate>
  );
}

function CardsBody({
  data,
  period,
  markingId,
  onMarkPaid,
}: {
  data: CardsOverview;
  period: string;
  markingId?: string;
  onMarkPaid: (cardId: string) => void;
}) {
  const { t } = useTranslation("cards");
  const totals = cardsTotals(data, period);

  const rows = useMemo(
    () =>
      data.cards
        .map((card) => {
          const { statement, projectedArs, installmentsCount } = cardMonth(data, card.id, period);
          const status = statementStatus(statement, projectedArs, data.today);
          const days = statement?.dueDate ? daysUntil(statement.dueDate, data.today) : null;
          return { card, statement, status, days, installmentsCount, amount: statement ? statement.totalArs : projectedArs };
        })
        .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)),
    [data, period],
  );

  const installments: InstallmentItem[] = useMemo(
    () =>
      installmentsInPeriod(data, period).map((i) => ({
        id: i.purchase.id,
        description: i.purchase.description,
        number: i.number,
        of: i.of,
        amount: i.amount,
        currency: i.purchase.currency,
        cardName: data.cards.find((c) => c.id === i.purchase.cardId)?.name ?? "",
      })),
    [data, period],
  );

  const committed = useMemo(
    () =>
      committedByMonth(data.purchases, period, COMMITTED_MONTHS, data.usdRate).map((m) => ({
        key: m.period,
        label: formatPeriod(m.period, "short"),
        value: m.amount,
      })),
    [data, period],
  );

  const urgent = rows.find((r) => r.status === "overdue" || r.status === "dueSoon");
  const allPaid = rows.every((r) => r.status === "paid");
  const overdue = urgent?.status === "overdue";
  const moment: MascotMoment = overdue ? "cardsOverdue" : urgent ? "cardsDue" : allPaid ? "cardsAllPaid" : "cards";
  const mood: Mood = urgent ? "atento" : allPaid ? "festeja" : "feliz";
  const params: Record<string, string | number> | undefined = overdue
    ? { name: urgent.card.name }
    : urgent
      ? { name: urgent.card.name, count: Math.max(0, urgent.days ?? 0) }
      : undefined;

  return (
    <>
      <CardsSummaryHero toPay={totals.toPay} paid={totals.paid} estimated={totals.estimated} />
      <MascotMessage moment={moment} params={params} mood={mood} />
      <SectionHeader title={t("list.title")} />
      {rows.map(({ card, statement, status, days, installmentsCount, amount }) => (
        <CardStatementCard
          key={card.id}
          card={card}
          amount={amount}
          status={status}
          dueDate={statement?.dueDate ?? null}
          daysLeft={days ?? undefined}
          minimum={statement?.minimumArs ?? null}
          usdAmount={statement?.usdAmount ?? null}
          installmentsCount={installmentsCount}
          busy={markingId === card.id}
          onMarkPaid={() => onMarkPaid(card.id)}
          onLoadStatement={() => router.push("/cargar")}
        />
      ))}
      <InstallmentsCard items={installments} />
      <CommittedMonthsCard data={committed} highlightKey={period} />
    </>
  );
}
