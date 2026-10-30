import { useTranslation } from "react-i18next";
import { formatDate, formatMoney } from "../../i18n/format";
import { Amount, BrandMark, Button, HStack, Pill, Spacer, Surface, Text, VStack, type BrandMarkBrand, type PillProps } from "../atoms";

export type CardStatementStatus = "paid" | "overdue" | "dueSoon" | "upcoming" | "estimated" | "empty";

export interface CardStatementCardProps {
  card: { name: string; entity: string | null; brand: BrandMarkBrand | null };
  /** Monto del resumen, o estimado por cuotas si no hay resumen. */
  amount: number;
  status: CardStatementStatus;
  /** 'YYYY-MM-DD' */
  dueDate: string | null;
  /** Días hasta el vencimiento (para `dueSoon`). */
  daysLeft?: number;
  minimum: number | null;
  usdAmount: number | null;
  installmentsCount: number;
  onMarkPaid?: () => void;
  onLoadStatement?: () => void;
  busy?: boolean;
}

/** Una tarjeta del mes: marca + nombre, monto, estado, mínimo / dólares, cuotas y la acción que corresponda. */
export function CardStatementCard({
  card,
  amount,
  status,
  dueDate,
  daysLeft = 0,
  minimum,
  usdAmount,
  installmentsCount,
  onMarkPaid,
  onLoadStatement,
  busy,
}: CardStatementCardProps) {
  const { t } = useTranslation("cards");
  const date = dueDate ? formatDate(dueDate, "short") : "";
  const pill: { label: string; tone: PillProps["tone"] } = {
    paid: { label: t("statement.status.paid"), tone: "positive" as const },
    overdue: { label: t("statement.status.overdue", { date }), tone: "danger" as const },
    dueSoon: {
      label: daysLeft <= 0 ? t("statement.status.dueToday") : t("statement.status.dueSoon", { count: daysLeft }),
      tone: "warning" as const,
    },
    upcoming: { label: t("statement.status.upcoming", { date }), tone: "neutral" as const },
    estimated: { label: t("statement.status.estimated"), tone: "neutral" as const },
    empty: { label: t("statement.status.empty"), tone: "neutral" as const },
  }[status];
  const hasStatement = status === "paid" || status === "overdue" || status === "dueSoon" || status === "upcoming";
  const details: string[] = [];
  if (minimum != null && status !== "paid") details.push(t("statement.minimum", { amount: formatMoney(minimum) }));
  if (usdAmount != null) details.push(t("statement.usd", { amount: formatMoney(usdAmount, "USD") }));
  if (installmentsCount > 0) details.push(t("statement.installments", { count: installmentsCount }));
  return (
    <Surface testID={`card-statement-${card.name}`}>
      <VStack gap={3}>
        <HStack gap={3}>
          <VStack gap={1} style={{ flexShrink: 1 }}>
            <HStack gap={2}>
              {card.brand ? <BrandMark brand={card.brand} /> : null}
              <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                {card.name}
              </Text>
            </HStack>
            {card.entity ? (
              <Text variant="secondary" tone="inkMuted">
                {card.entity}
              </Text>
            ) : null}
          </VStack>
          <Spacer />
          <Amount variant="number" value={amount} />
        </HStack>
        <Pill label={pill.label} tone={pill.tone} />
        {details.length > 0 ? (
          <Text variant="secondary" tone="inkMuted">
            {details.join(" · ")}
          </Text>
        ) : null}
        {hasStatement && status !== "paid" && onMarkPaid ? (
          <Button
            variant="secondary"
            label={t("statement.markPaid")}
            accessibilityLabel={t("statement.markPaidLabel", { name: card.name })}
            busy={busy}
            onPress={onMarkPaid}
          />
        ) : null}
        {(status === "estimated" || status === "empty") && onLoadStatement ? (
          <Button
            variant="text"
            label={t("statement.loadStatement")}
            accessibilityLabel={t("statement.loadStatementLabel", { name: card.name })}
            onPress={onLoadStatement}
          />
        ) : null}
      </VStack>
    </Surface>
  );
}
