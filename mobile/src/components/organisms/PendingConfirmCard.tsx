import { useTranslation } from "react-i18next";
import { formatMoney } from "../../i18n/format";
import { useFormatWhen } from "../../i18n/useFormatWhen";
import type { PendingPayment } from "../../data/types";
import { Amount, Button, HStack, Pill, Spacer, Surface, Text, VStack } from "../atoms";

export interface PendingConfirmCardProps {
  payment: PendingPayment;
  /** Fecha 'YYYY-MM-DD' de referencia para "hoy" / "ayer". */
  today: string;
  onConfirm: (payment: PendingPayment) => void;
  /** Bloquea el botón mientras se confirma. */
  busy?: boolean;
}

/**
 * Pago que llegó solo desde Apple Pay: comercio (o "Pago sin comercio"), monto o píldora
 * "Sin monto", cuándo y con qué tarjeta, y el botón "Confirmar".
 */
export function PendingConfirmCard({ payment, today, onConfirm, busy }: PendingConfirmCardProps) {
  const { t } = useTranslation("notifications");
  const formatWhen = useFormatWhen();
  const merchant = payment.merchant.trim() || t("pending.noMerchant");
  const when = formatWhen(payment.occurredAt, today);
  const meta = payment.card ? t("pending.meta", { when, card: payment.card }) : when;
  return (
    <Surface testID={`pending-${payment.id}`}>
      <VStack gap={3}>
        <HStack gap={3} align="flex-start">
          <VStack gap={1} style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={2}>
              {merchant}
            </Text>
            <Text variant="secondary" tone="inkMuted">
              {meta}
            </Text>
          </VStack>
          <Spacer size={1} />
          {payment.amount != null ? (
            <Amount value={payment.amount} currency={payment.currency} accessibilityLabel={formatMoney(payment.amount, payment.currency)} />
          ) : (
            <Pill tone="warning" label={t("pending.noAmount")} />
          )}
        </HStack>
        <Button
          testID={`confirm-${payment.id}`}
          label={t("pending.confirm")}
          accessibilityLabel={t("pending.confirmLabel", { merchant })}
          busy={busy}
          onPress={() => onConfirm(payment)}
        />
      </VStack>
    </Surface>
  );
}
