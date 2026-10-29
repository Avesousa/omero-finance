import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Divider, DoneToggle, EmptyHint, ErrorText, ListCard, Pill, Screen, SectionTitle, Title,
  useAction,
} from "../../components/ui";
import { api } from "../../lib/api";
import {
  daysInPeriod, fmtArs, fmtMoney, isReceivable, periodLabel, toArs, type EntryDTO, type Kind,
} from "../../lib/core";
import { usePeriod } from "../../lib/period";
import { usePlan, useQueryClient, useRefetchOnFocus } from "../../lib/queries";
import { colors } from "../../lib/theme";
import type { PlanData } from "../../lib/types";

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

export default function Fijos() {
  const { period, prev, next } = usePeriod();
  const q = usePlan(period);
  useRefetchOnFocus(q.refetch);
  const qc = useQueryClient();
  const toggle = useAction();

  function flip(e: EntryDTO) {
    const key = ["plan", period];
    const before = qc.getQueryData<PlanData>(key);
    // Se marca al toque; si el servidor falla se vuelve atrás.
    if (before) {
      qc.setQueryData<PlanData>(key, {
        ...before,
        entries: before.entries.map((x) => (x.id === e.id ? { ...x, isDone: !e.isDone } : x)),
      });
    }
    toggle.run(
      () => api("PATCH", `/api/plan/entries/${e.id}`, { isDone: !e.isDone }),
    ).then((r) => {
      if (r === undefined && before) qc.setQueryData(key, before);
      qc.invalidateQueries({ queryKey: ["plan"] });
    });
  }

  const header = (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 4 }}>
      <Title
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={prev} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={next} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        }
      >
        Fijos
      </Title>
      <Text style={{ color: colors.textSecondary, fontSize: 13, textTransform: "capitalize" }}>{periodLabel(period)}</Text>
    </View>
  );

  return (
    <Screen header={header} onRefresh={() => q.refetch()} refreshing={q.isRefetching && !q.isLoading}>
      {q.isLoading ? (
        <EmptyHint>Cargando…</EmptyHint>
      ) : q.error ? (
        <ErrorText error={q.error.message} />
      ) : q.data && !q.data.started ? (
        <EmptyHint>Todavía no iniciaste {periodLabel(period)}. Inicialo desde la web y acá vas a ver tus fijos.</EmptyHint>
      ) : q.data ? (
        <>
          <Section data={q.data} kind="EXPENSE" onToggle={flip} />
          <Section data={q.data} kind="INCOME" onToggle={flip} />
          {toggle.error && <ErrorText error={toggle.error} />}
        </>
      ) : null}
    </Screen>
  );
}

function Section({ data, kind, onToggle }: { data: PlanData; kind: Kind; onToggle: (e: EntryDTO) => void }) {
  const isIncome = kind === "INCOME";
  const list = data.entries.filter((e) => e.kind === kind && (e.recurringId || e.loanId));
  const ars = (l: EntryDTO[]) => l.reduce((s, e) => s + toArs(e.amount, e.currency, data.usdRate), 0);
  const total = ars(list);
  const doneTotal = ars(list.filter((e) => e.isDone));
  const words = isIncome
    ? { title: "Ingresos fijos", done: "Cobrado", mark: "cobrado", empty: "No hay ingresos fijos este mes." }
    : { title: "Gastos fijos y cuotas", done: "Pagado", mark: "pagado", empty: "No hay gastos fijos este mes." };

  const dueOf = (e: EntryDTO): string | null => {
    if (e.date) return shortDate(e.date);
    const rule = data.recurrings.find((r) => r.id === e.recurringId);
    if (rule?.dueDay) {
      const day = Math.min(rule.dueDay, daysInPeriod(data.period));
      return shortDate(`${data.period}-${String(day).padStart(2, "0")}`);
    }
    return null;
  };
  const loanOf = (e: EntryDTO) => data.loans.find((l) => l.id === e.loanId);

  return (
    <View style={{ gap: 8 }}>
      <SectionTitle
        right={
          list.length > 0 ? (
            <Text testID={`total-${kind}`} style={{ color: colors.textSecondary, fontSize: 12 }}>
              {words.done} {fmtArs(doneTotal)} de {fmtArs(total)}
            </Text>
          ) : null
        }
      >
        {words.title}
      </SectionTitle>
      {list.length === 0 ? (
        <EmptyHint>{words.empty}</EmptyHint>
      ) : (
        <ListCard>
          {list.map((e, i) => {
            const due = dueOf(e);
            const loan = loanOf(e);
            const waiting = isReceivable(e);
            return (
              <View key={e.id}>
                {i > 0 && <Divider />}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <DoneToggle done={e.isDone} label={`Marcar ${e.name} como ${words.mark}`} onToggle={() => onToggle(e)} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "500", opacity: e.isDone ? 0.6 : 1 }}>
                      {e.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {due ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>vence {due}</Text>
                      ) : null}
                      {loan ? <Pill>cuota</Pill> : null}
                      {waiting ? <Pill tone="amber">por cobrar · no suma</Pill> : null}
                    </View>
                  </View>
                  <Text style={{ color: waiting ? colors.textSecondary : colors.text, fontSize: 15, fontWeight: "600" }}>
                    {fmtMoney(e.amount, e.currency)}
                  </Text>
                </View>
              </View>
            );
          })}
        </ListCard>
      )}
    </View>
  );
}
