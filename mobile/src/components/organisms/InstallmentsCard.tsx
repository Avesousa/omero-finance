import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatMoney } from "../../i18n/format";
import { Button, Divider, HStack, Spacer, Surface, Text, VStack } from "../atoms";

export interface InstallmentItem {
  id: string;
  description: string;
  number: number;
  of: number;
  /** Monto de la cuota en su moneda de origen. */
  amount: number;
  currency: string;
  cardName: string;
}

export interface InstallmentsCardProps {
  items: readonly InstallmentItem[];
  /** Cuántas se ven antes de expandir (default 5). */
  limit?: number;
}

/** Cuotas del mes: descripción, "cuota 2/6", tarjeta y monto. Muestra `limit` y expande con "Ver todas". */
export function InstallmentsCard({ items, limit = 5 }: InstallmentsCardProps) {
  const { t } = useTranslation("cards");
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, limit);
  return (
    <Surface testID="installments-card">
      <VStack gap={3}>
        <Text variant="cardTitle" accessibilityRole="header">
          {t("installments.title")}
        </Text>
        {items.length === 0 ? (
          <Text variant="body" tone="inkMuted">
            {t("installments.empty")}
          </Text>
        ) : (
          <VStack gap={3}>
            {visible.map((item, i) => (
              <VStack key={item.id} gap={3}>
                {i > 0 ? <Divider /> : null}
                <HStack gap={3}>
                  <VStack gap={1} style={{ flexShrink: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {item.description}
                    </Text>
                    <Text variant="secondary" tone="inkMuted" numberOfLines={1}>
                      {t("installments.item", { number: item.number, of: item.of })} · {item.cardName}
                    </Text>
                  </VStack>
                  <Spacer />
                  <Text variant="numberSmall">{formatMoney(item.amount, item.currency)}</Text>
                </HStack>
              </VStack>
            ))}
          </VStack>
        )}
        {items.length > limit ? (
          <Button
            variant="text"
            fullWidth={false}
            label={expanded ? t("installments.showLess") : t("installments.seeAll", { count: items.length })}
            onPress={() => setExpanded((v) => !v)}
          />
        ) : null}
      </VStack>
    </Surface>
  );
}
