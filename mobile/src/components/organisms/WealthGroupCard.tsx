import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney, formatPercent } from "../../i18n/format";
import { Amount, Divider, HStack, Icon, ProgressBar, Spacer, Surface, Text, VStack, type IconName } from "../atoms";
import { DeltaBadge } from "../molecules";

export interface WealthGroupRow {
  id: string;
  name: string;
  icon: IconName;
  /** Monto principal en `currency` (moneda en la que se muestra la fila). */
  amount: number;
  currency: string;
  /** Equivalente en la moneda de la pantalla, debajo del principal (ej. dólares en pesos). */
  approx?: { amount: number; currency: string };
  /** Cambio vs el mes anterior, en `currency`; null si no había saldo previo. */
  delta: { amount: number; ratio: number | null } | null;
  /** Proporción dentro del grupo, 0..1. */
  share: number;
  /** Solo préstamos. */
  loan?: { paidRatio: number; installmentsLeft: number | null };
}

export interface WealthGroupCardProps {
  title: string;
  total: number;
  currency?: string;
  /** En deudas, bajar es bueno. */
  kind: "asset" | "debt";
  rows: readonly WealthGroupRow[];
  emptyText?: string;
  testID?: string;
}

/** Grupo de patrimonio ("Lo que tenés" / "Lo que debés"): total y una fila por ítem con cambio y peso. */
export function WealthGroupCard({ title, total, currency = "ARS", kind, rows, emptyText, testID }: WealthGroupCardProps) {
  const { t } = useTranslation("wealth");
  const { colors, space, radius, sizes } = useTheme();
  return (
    <Surface testID={testID}>
      <VStack gap={3}>
        <HStack align="baseline">
          <Text variant="bodyStrong" accessibilityRole="header">
            {title}
          </Text>
          <Spacer />
          <Amount variant="number" value={total} currency={currency} />
        </HStack>
        {rows.length === 0 && emptyText ? (
          <Text variant="secondary" tone="inkMuted">
            {emptyText}
          </Text>
        ) : null}
        {rows.map((row, index) => (
          <View key={row.id} style={{ gap: space[3] }}>
            {index > 0 ? <Divider /> : null}
            <VStack gap={2}>
              <HStack gap={3} align="flex-start">
                <View
                  style={{
                    width: sizes.touch,
                    height: sizes.touch,
                    borderRadius: radius.pill,
                    backgroundColor: colors.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={row.icon} tone="ink" />
                </View>
                <VStack gap={1} style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={2}>
                    {row.name}
                  </Text>
                  {row.delta && Math.round(row.delta.amount) !== 0 ? (
                    <DeltaBadge
                      size="sm"
                      amount={row.delta.amount}
                      ratio={row.delta.ratio}
                      currency={row.currency}
                      goodWhen={kind === "debt" ? "down" : "up"}
                    />
                  ) : null}
                </VStack>
                <VStack gap={1} align="flex-end">
                  <Amount variant="numberSmall" value={row.amount} currency={row.currency} />
                  {row.approx ? (
                    <Text variant="secondary" tone="inkMuted">
                      {t("row.approx", { amount: formatMoney(row.approx.amount, row.approx.currency) })}
                    </Text>
                  ) : null}
                </VStack>
              </HStack>
              {row.loan ? (
                <VStack gap={1}>
                  <ProgressBar
                    tone="positive"
                    value={row.loan.paidRatio}
                    accessibilityLabel={t("row.paidRatio", { percent: formatPercent(row.loan.paidRatio) })}
                  />
                  <HStack>
                    <Text variant="secondary" tone="inkMuted">
                      {t("row.paidRatio", { percent: formatPercent(row.loan.paidRatio) })}
                    </Text>
                    <Spacer />
                    {row.loan.installmentsLeft != null ? (
                      <Text variant="secondary" tone="inkMuted">
                        {t("row.installmentsLeft", { count: row.loan.installmentsLeft })}
                      </Text>
                    ) : null}
                  </HStack>
                </VStack>
              ) : (
                <ProgressBar
                  tone="primary"
                  value={row.share}
                  accessibilityLabel={t("row.share", { percent: formatPercent(row.share) })}
                />
              )}
            </VStack>
          </View>
        ))}
      </VStack>
    </Surface>
  );
}
