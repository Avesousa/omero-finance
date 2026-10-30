import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatDate, formatMoney, formatNumber } from "../../i18n/format";
import { Amount, Button, Divider, HStack, Pill, ProgressBar, Spacer, Surface, Text, VStack } from "../atoms";

export interface LoanCardProps {
  /** `OWE` = debo, `OWED` = me deben. */
  direction: "OWE" | "OWED";
  mode: "FIXED" | "OPEN" | "SCHEDULE";
  name: string;
  counterpart: string | null;
  currency: string;
  /** Saldo de capital en `currency`, y su equivalente en pesos. */
  capital: number;
  capitalArs: number;
  /** 0..1 */
  paidRatio: number;
  /** Capital ya devuelto (para préstamos sin cuotas fijas), en `currency`. */
  paidAmount: number;
  installmentNumber: number | null;
  installmentsTotal: number | null;
  rate: { pct: number; annual: boolean; withTax: boolean } | null;
  /** Cuota del mes en `currency`; null si no hay. */
  monthPayment: { amount: number; dueDate: string | null; isDone: boolean } | null;
  /** Mes mostrado, 'YYYY-MM'. */
  period: string;
  busy?: boolean;
  onMarkPaid?: () => void;
  testID?: string;
}

/** Un préstamo (debo / me deben): quién, tipo y tasa, saldo, avance y la cuota del mes con su acción. */
export function LoanCard({
  direction,
  mode,
  name,
  counterpart,
  currency,
  capital,
  capitalArs,
  paidRatio,
  paidAmount,
  installmentNumber,
  installmentsTotal,
  rate,
  monthPayment,
  period,
  busy,
  onMarkPaid,
  testID,
}: LoanCardProps) {
  const { t } = useTranslation("debts");
  const { space } = useTheme();
  const owe = direction === "OWE";
  const pct = rate ? formatNumber(rate.pct, Number.isInteger(rate.pct) ? 0 : 2) : "";
  const rateLabel = rate
    ? rate.annual
      ? t(rate.withTax ? "loan.rate.annualTax" : "loan.rate.annual", { pct })
      : t(rate.withTax ? "loan.rate.monthlyTax" : "loan.rate.monthly", { pct })
    : null;
  const progress =
    installmentNumber != null && installmentsTotal != null
      ? t("loan.progress.installment", { number: installmentNumber, total: installmentsTotal })
      : t(owe ? "loan.progress.paidOwe" : "loan.progress.paidOwed", { amount: formatMoney(paidAmount, currency) });
  const month = formatDate(`${period}-01`, "month");
  const done = monthPayment?.isDone ?? false;

  return (
    <Surface testID={testID}>
      <VStack gap={3}>
        <VStack gap={1}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {name}
          </Text>
          {counterpart ? (
            <Text variant="secondary" tone="inkMuted" numberOfLines={1}>
              {counterpart}
            </Text>
          ) : null}
        </VStack>
        <HStack gap={2} wrap>
          <Pill label={t(`loan.kind.${mode}`)} />
          {rateLabel ? <Pill label={rateLabel} /> : null}
        </HStack>
        <VStack gap={1}>
          <Amount variant="number" value={capital} currency={currency} />
          {currency !== "ARS" ? (
            <Text variant="secondary" tone="inkMuted">
              {t("loan.capitalApprox", { amount: formatMoney(capitalArs) })}
            </Text>
          ) : null}
        </VStack>
        <VStack gap={2}>
          <ProgressBar value={paidRatio} tone="positive" accessibilityLabel={progress} />
          <Text variant="secondary" tone="inkMuted">
            {progress}
          </Text>
        </VStack>
        {monthPayment ? (
          <>
            <Divider />
            <View style={{ gap: space[3] }}>
              <HStack gap={3} align="flex-start">
                <VStack gap={1} style={{ flexShrink: 1 }}>
                  <Text variant="secondaryStrong">{t("loan.month.title", { month })}</Text>
                  <Amount variant="numberSmall" value={monthPayment.amount} currency={currency} />
                  {monthPayment.dueDate ? (
                    <Text variant="secondary" tone="inkMuted">
                      {t("loan.month.due", { date: formatDate(monthPayment.dueDate, "short") })}
                    </Text>
                  ) : null}
                </VStack>
                <Spacer />
                <Pill
                  tone={done ? "positive" : "neutral"}
                  label={done ? t(owe ? "loan.month.paid" : "loan.month.collected") : t("loan.month.pending")}
                />
              </HStack>
              {!done && onMarkPaid ? (
                <Button
                  variant="secondary"
                  testID={testID ? `${testID}-mark` : undefined}
                  label={t(owe ? "loan.markPaid" : "loan.markCollected")}
                  accessibilityLabel={t(owe ? "loan.markPaidLabel" : "loan.markCollectedLabel", { name })}
                  busy={busy}
                  onPress={onMarkPaid}
                />
              ) : null}
            </View>
          </>
        ) : null}
      </VStack>
    </Surface>
  );
}
