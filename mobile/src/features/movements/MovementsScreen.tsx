import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button, HStack, IconButton, Skeleton, Surface, Text, TextField, VStack } from "../../components/atoms";
import { EmptyState, PeriodSwitcher, SegmentedToggle } from "../../components/molecules";
import { MovementRow, ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { pendingIncomes, usePlan, useMovements, type MovementsKind, type MovementsView } from "../../data";
import { formatMoney, formatWeekdayDate } from "../../i18n/format";
import { addDays } from "../../domain";
import { MoveToFinanceSheet, useMoveTargets } from "../finances/MoveToFinanceSheet";
import { useCanWrite } from "../../providers/ActiveFinanceProvider";

/** Solo se mueven los movimientos reales: no los fijos, las cuotas de préstamo ni las propuestas de un mes sin iniciar. */
const movable = (m: { fixed: boolean; installment: boolean; projected: boolean; statement?: boolean }) => !m.statement && !m.fixed && !m.installment && !m.projected;

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
  const plan = usePlan(selected ?? undefined);
  const toCollect = plan.data ? pendingIncomes(plan.data).length : 0;
  const { t: tf } = useTranslation("finances");
  // Modo selección para mover a otra finanza: solo si hay otra finanza donde cargar y mi rol lo permite.
  const canMove = useMoveTargets().length > 0;
  const canWrite = useCanWrite();
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const selecting = picked !== null;
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size === 0 ? null : next;
    });

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
      {kind === "income" && canWrite && toCollect > 0 ? (
        <Button testID="movements-confirm-income" variant="secondary" label={t("collection.action", { count: toCollect })} onPress={() => router.push({ pathname: "/ingresos/pendientes", params: { period } })} />
      ) : null}
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
      {data.count === 0 && !data.overdue ? (
        <EmptyState mascot={false} title={t(data.totalCount === 0 ? "state.emptyTitle" : "state.noResultsTitle")} description={t(data.totalCount === 0 ? "state.emptyBody" : "state.noResultsBody")} />
      ) : (
        <MovementsList
          view={data}
          kind={kind}
          onOpen={edit}
          selection={canMove ? { picked, toggle } : null}
          readOnly={!canWrite}
        />
      )}
      {selecting ? (
        <Surface testID="movements-selection-bar">
          <VStack gap={2}>
            <Text variant="bodyStrong" accessibilityLiveRegion="polite">{tf("move.selectedCount", { count: picked.size })}</Text>
            <HStack gap={2}>
              <Button testID="movements-move" label={tf("move.action")} onPress={() => setMoveOpen(true)} fullWidth={false} />
              <Button variant="text" label={tf("move.cancelSelect")} onPress={() => setPicked(null)} />
            </HStack>
          </VStack>
        </Surface>
      ) : null}
      <MoveToFinanceSheet
        visible={moveOpen}
        entryIds={picked ? [...picked] : []}
        onClose={() => setMoveOpen(false)}
        onMoved={() => setPicked(null)}
      />
    </ScreenTemplate>
  );
}

interface Selection {
  picked: Set<string> | null;
  toggle: (id: string) => void;
}

function MovementsList({
  view,
  kind,
  onOpen,
  selection,
  readOnly,
}: {
  view: MovementsView;
  kind: MovementsKind;
  onOpen: (id: string, period: string) => void;
  selection: Selection | null;
  /** Lector: las filas no se abren para editar. */
  readOnly: boolean;
}) {
  const { t } = useTranslation("movements");
  const dayLabel = (date: string) =>
    date === view.today
        ? t("day.today")
        : date === addDays(view.today, -1)
          ? t("day.yesterday")
          : formatWeekdayDate(date);
  const openMovement = (m: MovementsView["days"][number]["items"][number], overdue: boolean) => {
    if (selection?.picked != null) {
      if (movable(m)) selection.toggle(m.id);
    } else if (m.statement) router.push("/tarjetas");
    else if (m.installment) router.push("/deudas");
    else if (overdue && m.fixed) router.push("/gastos-fijos");
    else onOpen(m.id, view.period);
  };
  const section = (id: string, label: string, items: MovementsView["days"][number]["items"]) => (
    <VStack key={id} gap={2} testID={`movements-day-${id}`}>
      <Text variant="secondaryStrong" tone={id === "overdue" ? "dangerInk" : "inkMuted"} accessibilityRole="header">
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
            dueDate={id === "overdue" ? m.date : null}
            overdue={id === "overdue"}
            proposed={m.projected}
            selectionMode={selection?.picked != null}
            selected={selection?.picked?.has(m.id) ?? false}
            unselectable={!movable(m)}
            onLongPress={selection && movable(m) ? () => selection.toggle(m.id) : undefined}
            onPress={
              readOnly
                ? undefined
                : () => openMovement(m, id === "overdue")
            }
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
      {view.overdue ? section("overdue", t("day.overdue"), view.overdue.items) : null}
      <VStack gap={1} testID="movements-totals" accessibilityLiveRegion="polite">
        <Text variant="bodyStrong">{totals}</Text>
        <Text variant="secondary" tone="inkMuted">
          {t("totals.count", { count: view.count })}
        </Text>
      </VStack>
      {view.days.map((day) => section(day.date, dayLabel(day.date), day.items))}
      {view.undated ? section("undated", t("day.undated"), view.undated.items) : null}
    </VStack>
  );
}
