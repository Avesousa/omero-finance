import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Skeleton, Text, VStack } from "../../components/atoms";
import { EmptyState } from "../../components/molecules";
import { ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { pendingIncomes, usePlan } from "../../data";
import { formatMoney } from "../../i18n/format";
import { useCanWrite } from "../../providers/ActiveFinanceProvider";

/** Acceso explícito a ingresos existentes por confirmar; no forman parte del historial. */
export function PendingIncomesScreen() {
  const { t } = useTranslation("movements");
  const { period } = useLocalSearchParams<{ period?: string }>();
  const plan = usePlan(period);
  const canWrite = useCanWrite();
  const entries = plan.data ? pendingIncomes(plan.data) : [];
  return (
    <ScreenTemplate header={<ScreenHeader title={t("collection.title")} onBack={() => router.back()} backLabel={t("back")} />} edges={["top", "bottom"]} testID="pending-incomes">
      {plan.isPending ? <Skeleton height={120} /> : plan.isError ? (
        <EmptyState title={t("state.errorTitle")} description={t("state.errorBody")} action={{ label: t("collection.retry"), onPress: () => void plan.refetch() }} />
      ) : entries.length === 0 ? (
        <EmptyState title={t("collection.empty")} description={t("collection.emptyBody")} />
      ) : (
        <VStack gap={3}>
          <Text variant="secondary" tone="inkMuted">{t("collection.body")}</Text>
          {entries.map((entry) => (
            <Button key={entry.id} testID={`collect-${entry.id}`} variant="secondary" label={`${entry.name} · ${formatMoney(entry.amount, entry.currency)}`} disabled={!canWrite} onPress={() => router.push({ pathname: "/movimientos/editar", params: { entryId: entry.id, period: entry.period } })} />
          ))}
        </VStack>
      )}
    </ScreenTemplate>
  );
}
