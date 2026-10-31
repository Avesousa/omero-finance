import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { HStack, IconButton, Skeleton, Surface, Text, TextField, VStack } from "../../components/atoms";
import { EmptyState, PeriodSwitcher, SegmentedToggle } from "../../components/molecules";
import { MovementRow, ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { useMovements, type MovementsKind, type MovementsView } from "../../data";
import { formatMoney, formatWeekdayDate } from "../../i18n/format";
import { addDays } from "../../domain";

const MIN_PERIOD = "2026-06";
const MAX_PERIOD = "2027-04";

function initialKind(param: string | undefined): MovementsKind {
  return param === "income" || param === "expense" ? param : "all";
}

/** Movimientos del mes: ingresos y gastos agrupados por día, con filtro Todos / Ingresos / Gastos y buscador. Params `kind` y `period`. */
export function MovementsScreen() {
  const { t } = useTranslation("movements");
  const { t: tc } = useTranslation("common");
  const params = useLocalSearchParams<{ kind?: string; period?: string }>();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(params.period || null);
  const [kind, setKind] = useState<MovementsKind>(() => initialKind(params.kind));
  const [query, setQuery] = useState("");
  const { data, isPending, isError, refetch } = useMovements(selected ?? undefined, { kind, query });
  const [refreshing, setRefreshing] = useState(false);
  const period = selected ?? data?.period ?? null;

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
  const edit = (entryId: string, entryPeriod: string) => router.push({ pathname: "/movimientos/editar", params: { entryId, period: entryPeriod } });

  if (isPending) {
    return (
      <ScreenTemplate header={header} edges={["top", "bottom"]} testID="movements-loading">
        <VStack gap={4} accessibilityLabel={t("state.loading")} accessibilityLiveRegion="polite">
          <Skeleton height={56} shape="pill" />
          <Skeleton height={44} shape="pill" />
          <Skeleton height={52} />
          <Skeleton height={220} />
        </VStack>
      </ScreenTemplate>
    );
  }

  if (isError || !data || !period) {
    return (
      <ScreenTemplate header={header} edges={["top", "bottom"]} testID="movements-error" refreshing={refreshing} onRefresh={onRefresh}>
        {switcher}
        <EmptyState title={t("state.errorTitle")} description={t("state.errorBody")} action={{ label: tc("actions.retry"), onPress: () => void refetch() }} />
      </ScreenTemplate>
    );
  }

  return (
    <ScreenTemplate header={header} edges={["top", "bottom"]} testID="movements" refreshing={refreshing} onRefresh={onRefresh}>
      {switcher}
      {data.totalCount === 0 ? (
        <EmptyState
          title={t("state.emptyTitle")}
          description={t("state.emptyBody")}
          action={{ label: t("state.emptyAction"), onPress: () => router.push("/cargar") }}
        />
      ) : (
        <>
          <SegmentedToggle<MovementsKind>
            testID="movements-filter"
            accessibilityLabel={t("filter.label")}
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: t("filter.all") },
              { value: "income", label: t("filter.income") },
              { value: "expense", label: t("filter.expense") },
            ]}
          />
          <HStack>
            <TextField
              testID="movements-search"
              accessibilityLabel={t("search.label")}
              placeholder={t("search.placeholder")}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCorrect={false}
              style={{ flex: 1 }}
            />
            {query ? <IconButton testID="movements-search-clear" icon="close" accessibilityLabel={t("search.clear")} onPress={() => setQuery("")} /> : null}
          </HStack>
          {data.count === 0 ? (
            <EmptyState mascot={false} title={t("state.noResultsTitle")} description={t("state.noResultsBody")} />
          ) : (
            <MovementsList view={data} kind={kind} onOpen={edit} />
          )}
        </>
      )}
    </ScreenTemplate>
  );
}

function MovementsList({ view, kind, onOpen }: { view: MovementsView; kind: MovementsKind; onOpen: (id: string, period: string) => void }) {
  const { t } = useTranslation("movements");
  const dayLabel = (date: string) =>
    date === view.today
        ? t("day.today")
        : date === addDays(view.today, -1)
          ? t("day.yesterday")
          : formatWeekdayDate(date);
  const section = (id: string, label: string, items: MovementsView["days"][number]["items"]) => (
    <VStack key={id} gap={2} testID={`movements-day-${id}`}>
      <Text variant="secondaryStrong" tone="inkMuted" accessibilityRole="header">
        {label}
      </Text>
      <Surface>
        {items.map((m) => (
          <MovementRow
            key={m.id}
            testID={`movement-${m.id}`}
            kind={m.kind}
            name={m.name}
            categoryName={m.categoryName}
            amount={m.amount}
            currency={m.currency}
            fixed={m.fixed}
            installment={m.installment}
            hasStatus={m.hasStatus}
            isDone={m.isDone}
            dueDate={id === "upcoming" ? m.date : null}
            proposed={m.projected}
            onPress={() => onOpen(m.id, view.period)}
          />
        ))}
      </Surface>
    </VStack>
  );
  const income = formatMoney(view.totals.income);
  const expenses = formatMoney(view.totals.expenses);
  const totals = kind === "income" ? t("totals.income", { income }) : kind === "expense" ? t("totals.expense", { expenses }) : t("totals.all", { income, expenses });
  return (
    <VStack gap={4}>
      <VStack gap={1} testID="movements-totals" accessibilityLiveRegion="polite">
        <Text variant="bodyStrong">{totals}</Text>
        <Text variant="secondary" tone="inkMuted">
          {t("totals.count", { count: view.count })}
        </Text>
      </VStack>
      {view.days.map((day) => section(day.date, dayLabel(day.date), day.items))}
      {view.upcoming ? section("upcoming", t("day.upcoming"), view.upcoming.items) : null}
      {view.undated ? section("undated", t("day.undated"), view.undated.items) : null}
    </VStack>
  );
}
