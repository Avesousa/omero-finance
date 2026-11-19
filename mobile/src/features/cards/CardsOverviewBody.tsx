import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SectionHeader } from "../../components/molecules";
import { CardStatementCard, CommittedMonthsCard, InstallmentsCard, MascotMessage, type InstallmentItem } from "../../components/organisms";
import { cardMonth, committedByMonth, daysUntil, installmentsInPeriod, statementStatus, type CardsOverview, type StatementStatus } from "../../data";
import { formatPeriod } from "../../i18n/format";
import type { MascotMoment, Mood } from "../../mascots";

const COMMITTED_MONTHS = 6;
const ORDER: StatementStatus[] = ["overdue", "dueSoon", "upcoming", "estimated", "empty", "paid"];

/** Vista «Todas»: mensaje de la mascota, el resumen de cada tarjeta del mes, las cuotas y lo comprometido. */
export function CardsBody({ data, period, markingId, onOpenCard, onLoadStatement, onMarkPaid, onUndo }: {
  data: CardsOverview; period: string; markingId?: string;
  onOpenCard: (cardId: string) => void; onLoadStatement?: (cardId: string) => void;
  onMarkPaid?: (cardId: string) => void; onUndo?: (cardId: string) => void;
}) {
  const { t } = useTranslation("cards");
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
    () => installmentsInPeriod(data, period).map((i) => ({
      id: i.purchase.id, description: i.purchase.description, number: i.number, of: i.of, amount: i.amount,
      currency: i.purchase.currency, cardName: data.cards.find((c) => c.id === i.purchase.cardId)?.name ?? "",
    })),
    [data, period],
  );
  const committed = useMemo(
    () => committedByMonth(data.purchases, period, COMMITTED_MONTHS, data.usdRate).map((m) => ({ key: m.period, label: formatPeriod(m.period, "short"), value: m.amount })),
    [data, period],
  );
  const urgent = rows.find((r) => r.status === "overdue" || r.status === "dueSoon");
  const allPaid = rows.every((r) => r.status === "paid");
  const overdue = urgent?.status === "overdue";
  const moment: MascotMoment = overdue ? "cardsOverdue" : urgent ? "cardsDue" : allPaid ? "cardsAllPaid" : "cards";
  const mood: Mood = urgent ? "atento" : allPaid ? "festeja" : "feliz";
  const params: Record<string, string | number> | undefined = overdue ? { name: urgent.card.name } : urgent ? { name: urgent.card.name, count: Math.max(0, urgent.days ?? 0) } : undefined;

  return (
    <>
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
          onPress={() => onOpenCard(card.id)}
          onMarkPaid={onMarkPaid ? () => onMarkPaid(card.id) : undefined}
          onLoadStatement={onLoadStatement ? () => onLoadStatement(card.id) : undefined}
          onUndoPaid={onUndo ? () => onUndo(card.id) : undefined}
        />
      ))}
      <InstallmentsCard items={installments} />
      <CommittedMonthsCard data={committed} highlightKey={period} />
    </>
  );
}
