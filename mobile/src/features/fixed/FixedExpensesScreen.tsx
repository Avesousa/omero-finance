import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Divider, Skeleton, Surface, Text, VStack } from "../../components/atoms";
import { AllocationBar, EmptyState, PeriodSwitcher, categoryColorIndex, categoryIcon, type AllocationSegment } from "../../components/molecules";
import { FixedExpenseRow, MascotMessage, MoneyHero, ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { useCategoryColorOrder, useFixedExpenses, usePlan, useToggleEntryDone, type FixedGroup } from "../../data";
import { useTheme } from "../../design-system";
import { capitalize, formatDate, formatMoney } from "../../i18n/format";

const MIN_PERIOD = "2026-06";
const MAX_PERIOD = "2027-04";
/** Con cuántos días de aviso la mascota recuerda el próximo vencimiento. */
const SOON_DAYS = 5;

/** Gastos fijos del mes: total, lo pagado y lo que falta, agrupados por categoría. Tocar una fila edita; el check marca pagado. Params opcionales `period` y `category` (la resalta y la sube). */
export function FixedExpensesScreen() {
  const { t } = useTranslation("fixed");
  const { t: tc } = useTranslation("common");
  const { colors, space, sizes } = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ period?: string; category?: string }>();
  const [selected, setSelected] = useState<string | null>(params.period || null);
  const plan = usePlan(selected ?? undefined);
  const view = useFixedExpenses(selected ?? undefined);
  const toggle = useToggleEntryDone();
  const colorOrder = useCategoryColorOrder(selected ?? undefined);
  const period = selected ?? plan.data?.period ?? null;
  const [refreshing, setRefreshing] = useState(false);
  const highlighted = params.category || null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([qc.invalidateQueries({ queryKey: ["plan"] }), qc.invalidateQueries({ queryKey: ["home"] })]);
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  const header = <ScreenHeader title={t("title")} onBack={() => router.back()} backLabel={t("back")} />;
  const switcher = period ? <PeriodSwitcher period={period} onChange={setSelected} min={MIN_PERIOD} max={MAX_PERIOD} /> : null;

  // La categoría pedida desde Presupuesto va primero.
  const groups: FixedGroup[] = useMemo(() => {
    const all = view.data?.groups ?? [];
    return highlighted ? [...all].sort((a, b) => Number(b.categoryId === highlighted) - Number(a.categoryId === highlighted)) : all;
  }, [view.data, highlighted]);

  const colorOf = (categoryId: string | null) => categoryColorIndex(categoryId ?? "uncategorized", colorOrder);
  const segments: AllocationSegment[] = groups.map((g) => ({
    key: g.categoryId ?? "uncategorized",
    label: g.name || t("group.uncategorized"),
    value: g.total,
    colorIndex: colorOf(g.categoryId),
  }));

  const add = () => router.push({ pathname: "/gastos-fijos/nuevo", params: period ? { period } : {} });
  const edit = (entryId: string) => router.push({ pathname: "/gastos-fijos/editar", params: { entryId, ...(period ? { period } : {}) } });

  if (view.isPending || plan.isPending) {
    return (
      <ScreenTemplate header={header} edges={["top", "bottom"]} testID="fixed-loading">
        <VStack gap={4} accessibilityLabel={t("state.loading")} accessibilityLiveRegion="polite">
          <Skeleton height={170} shape="hero" />
          <Skeleton height={56} shape="pill" />
          <Skeleton height={220} />
        </VStack>
      </ScreenTemplate>
    );
  }

  if (view.isError || plan.isError || !view.data || !period) {
    return (
      <ScreenTemplate header={header} edges={["top", "bottom"]} testID="fixed-error" refreshing={refreshing} onRefresh={onRefresh}>
        {switcher}
        <EmptyState title={t("state.errorTitle")} description={t("state.errorBody")} action={{ label: tc("actions.retry"), onPress: () => void view.refetch() }} />
      </ScreenTemplate>
    );
  }

  const v = view.data;
  const allPaid = v.count > 0 && v.paidCount === v.count;
  const soon = v.nextDue && v.nextDue.days <= SOON_DAYS ? v.nextDue : null;

  return (
    <ScreenTemplate header={header} edges={["top", "bottom"]} testID="fixed" refreshing={refreshing} onRefresh={onRefresh}>
      {switcher}
      <MoneyHero
        testID="fixed-hero"
        label={t("hero.label")}
        amount={v.total}
        amountTestID="fixed-hero-amount"
        caption={
          <Text variant="secondaryStrong" tone="onPrimary">
            {t("hero.caption", { paid: formatMoney(v.paid), pending: formatMoney(v.pending) })}
          </Text>
        }
      />

      {v.count > 0 ? (
        <Surface>
          <AllocationBar testID="fixed-allocation" segments={segments} accessibilityLabel={t("allocation.label")} />
        </Surface>
      ) : null}

      {v.projected ? (
        <Text testID="fixed-projected" variant="secondary" tone="inkMuted">
          {t("projected.notice", { month: capitalize(formatDate(period, "month")) })}
        </Text>
      ) : v.count > 0 ? (
        allPaid ? (
          <MascotMessage moment="fixedAllPaid" mood="festeja" />
        ) : soon ? (
          <MascotMessage moment="fixedNextDue" params={soon.days > 0 ? { name: soon.name, count: soon.days } : { name: soon.name }} mood="atento" />
        ) : (
          <MascotMessage moment="fixedPending" params={{ count: v.count - v.paidCount, amount: formatMoney(v.pending) }} />
        )
      ) : null}

      {v.count === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.body")} />
      ) : (
        groups.map((g) => {
          const key = g.categoryId ?? "uncategorized";
          const marked = g.categoryId != null && g.categoryId === highlighted;
          return (
            <VStack key={key} gap={2} testID={`fixed-group-${key}`}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space[2] }}>
                <Text variant="cardTitle" accessibilityRole="header" style={{ flexShrink: 1 }}>
                  {g.name || t("group.uncategorized")}
                </Text>
                <Text variant="numberSmall">{formatMoney(g.total)}</Text>
              </View>
              <Surface style={marked ? { borderColor: colors.tabActive, borderWidth: sizes.ring } : undefined}>
                {g.items.map((item, i) => {
                  const id = item.entryId ?? item.recurringId ?? `${item.name}-${i}`;
                  return (
                    <View key={id}>
                      {i > 0 ? <Divider /> : null}
                      <FixedExpenseRow
                        testID={`fixed-row-${id}`}
                        toggleTestID={`fixed-toggle-${id}`}
                        name={item.name}
                        amount={item.amount}
                        unitAmount={item.unitAmount}
                        currency={item.currency}
                        frequency={item.frequency}
                        weekday={item.weekday}
                        dueDay={item.dueDay}
                        isDone={item.isDone}
                        icon={categoryIcon(g.name)}
                        colorIndex={colorOf(g.categoryId)}
                        readOnly={v.projected || item.entryId == null}
                        toggling={toggle.isPending && toggle.variables?.id === item.entryId}
                        onPress={item.entryId ? () => edit(item.entryId!) : undefined}
                        onToggle={item.entryId ? () => toggle.mutate({ id: item.entryId!, isDone: !item.isDone }) : undefined}
                      />
                    </View>
                  );
                })}
              </Surface>
            </VStack>
          );
        })
      )}

      {toggle.isError ? (
        <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">
          {t("toggleError")}
        </Text>
      ) : null}

      {!v.projected ? <Button testID="fixed-add" icon="add" label={t("add")} onPress={add} /> : null}
    </ScreenTemplate>
  );
}
