import { useMemo } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Divider, ErrorText, EmptyHint, ListCard, Pill, ProgressBar, Screen, SectionTitle } from "../../components/ui";
import { API_URL } from "../../lib/api";
import { buildSummary, fmtArs, periodLabel, type BudgetRow } from "../../lib/core";
import { usePeriod } from "../../lib/period";
import { useStoredChoice } from "../../lib/prefs";
import { usePlan, useRefetchOnFocus } from "../../lib/queries";
import { colors } from "../../lib/theme";
import type { PlanData } from "../../lib/types";

type MonthView = "available" | "free";
const VIEWS: readonly { value: MonthView; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "free", label: "Libre" },
];
const VIEW_VALUES = VIEWS.map((v) => v.value);
const DETAIL_VALUES = ["open", "closed"] as const;

export default function Mes() {
  const { period, prev, next } = usePeriod();
  const q = usePlan(period);
  useRefetchOnFocus(q.refetch);

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 }}>
      <Pressable testID="prev-month" accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={prev} hitSlop={12} style={{ padding: 6 }}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <Text testID="month-title" style={{ color: colors.text, fontSize: 20, fontWeight: "700", textTransform: "capitalize" }}>
        {periodLabel(period)}
      </Text>
      <Pressable testID="next-month" accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={next} hitSlop={12} style={{ padding: 6 }}>
        <Ionicons name="chevron-forward" size={24} color={colors.text} />
      </Pressable>
    </View>
  );

  return (
    <Screen header={header} onRefresh={() => q.refetch()} refreshing={q.isRefetching && !q.isLoading}>
      {q.isLoading ? (
        <EmptyHint>Cargando…</EmptyHint>
      ) : q.error ? (
        <Card style={{ padding: 16, gap: 8 }}>
          <ErrorText error={q.error.message} />
          <Pressable onPress={() => q.refetch()}>
            <Text style={{ color: colors.accent, fontWeight: "600" }}>Reintentar</Text>
          </Pressable>
        </Card>
      ) : q.data ? (
        q.data.started ? <Summary data={q.data} /> : <NotStarted period={period} />
      ) : null}
    </Screen>
  );
}

function NotStarted({ period }: { period: string }) {
  const month = periodLabel(period);
  return (
    <Card style={{ padding: 20, gap: 12 }}>
      <Text testID="not-started" style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
        Todavía no iniciaste {month}.
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
        Inicialo desde la web y después vas a verlo acá con calma.
      </Text>
      {API_URL ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openURL(`${API_URL}/plan?period=${period}`)}
          style={{ backgroundColor: colors.accent, borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: colors.accentFg, fontWeight: "700", fontSize: 15 }}>Abrir la web</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

interface Line {
  label: string; value: number; sign: string; note?: string | null; muted?: boolean;
}

function Summary({ data }: { data: PlanData }) {
  const [view, setView] = useStoredChoice<MonthView>("omero_month_view", VIEW_VALUES, "available");
  const [detail, setDetail] = useStoredChoice<(typeof DETAIL_VALUES)[number]>("omero_reserved_detail", DETAIL_VALUES, "open");
  const summary = useMemo(() => buildSummary(data), [data]);

  const negative = summary.availableArs < 0;
  const freeNegative = summary.freeArs < -0.5;
  const hasBudget = data.budgets.length > 0;

  const pendingNote = (pending: number, estimate = false) =>
    pending > 0.5 ? `falta pagar ${fmtArs(pending)}${estimate ? " (estimado)" : ""}` : null;

  const availableRows: Line[] = [
    { label: "Ingresos", value: summary.incomeArs, sign: "+" },
    ...(summary.receivableArs > 0
      ? [{ label: "Por cobrar (no suma todavía)", value: summary.receivableArs, sign: "", muted: true }]
      : []),
    { label: "Gastos fijos pagados", value: summary.fixedPaidArs, sign: "−", note: pendingNote(summary.fixedArs - summary.fixedPaidArs) },
    { label: "Gastos del mes", value: summary.variableArs, sign: "−" },
    ...(summary.loansArs > 0
      ? [{ label: "Préstamos y deudas pagados", value: summary.loansPaidArs, sign: "−", note: pendingNote(summary.loansArs - summary.loansPaidArs) }]
      : []),
    {
      label: "Tarjetas pagadas", value: summary.cardsPaidArs, sign: "−",
      note: pendingNote(summary.cardsArs - summary.cardsPaidArs, summary.cardsHasEstimate),
    },
  ];

  const pendingParts = [
    summary.fixedArs - summary.fixedPaidArs > 0.5 ? `fijos ${fmtArs(summary.fixedArs - summary.fixedPaidArs)}` : null,
    summary.loansArs - summary.loansPaidArs > 0.5 ? `préstamos ${fmtArs(summary.loansArs - summary.loansPaidArs)}` : null,
    summary.cardsArs - summary.cardsPaidArs > 0.5
      ? `tarjetas ${fmtArs(summary.cardsArs - summary.cardsPaidArs)}${summary.cardsHasEstimate ? " (estimado)" : ""}`
      : null,
  ].filter(Boolean).join(" · ");

  const freeRows: Line[] = [
    { label: "Disponible", value: summary.availableArs, sign: "" },
    { label: "Pendiente de pago", value: summary.pendingArs, sign: "−", note: pendingParts || null },
    ...(hasBudget || summary.budgetLeftArs > 0.5
      ? [{ label: "Presupuesto por gastar", value: summary.budgetLeftArs, sign: "−" }]
      : []),
  ];

  const isFree = view === "free";
  const main = isFree
    ? {
        value: summary.freeArs,
        color: freeNegative ? colors.red : colors.green,
        text: freeNegative
          ? "No alcanza para cubrir lo reservado. Mirá qué se puede mover."
          : "Lo que queda del disponible después de reservar lo pendiente de pago y el presupuesto por gastar.",
        rows: freeRows,
      }
    : {
        value: summary.availableArs,
        color: negative ? colors.red : colors.text,
        text: negative
          ? "Ya pagaste más de lo que entró este mes."
          : "Lo que entró menos lo que ya pagaste. Lo que todavía no pagaste sigue acá.",
        rows: availableRows,
      };
  const other = isFree
    ? { view: "available" as const, label: "Disponible", value: summary.availableArs, color: negative ? colors.red : colors.text, text: "Lo que entró menos lo que ya pagaste." }
    : {
        view: "free" as const, label: "Libre", value: summary.freeArs, color: freeNegative ? colors.red : colors.green,
        text: summary.reservedArs > 0.5
          ? `Disponible menos ${fmtArs(summary.reservedArs)} reservados. Tocá para ver en qué.`
          : "Nada reservado: todo el disponible está libre.",
      };

  return (
    <>
      {data.inboxPendingCount > 0 && (
        <Pressable
          testID="inbox-banner"
          accessibilityRole="link"
          onPress={() => router.navigate("/por-confirmar")}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8,
            backgroundColor: colors.accentSubtle, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: 16,
            paddingHorizontal: 16, paddingVertical: 12,
          }}
        >
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "600", flex: 1 }}>
            Tenés {data.inboxPendingCount} {data.inboxPendingCount === 1 ? "pago" : "pagos"} con Apple Pay por confirmar
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </Pressable>
      )}

      <ListCard>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <View
            accessibilityLabel="Qué número ver"
            style={{
              alignSelf: "flex-start", flexDirection: "row", backgroundColor: colors.elevated, borderColor: colors.border,
              borderWidth: 1, borderRadius: 999, padding: 2,
            }}
          >
            {VIEWS.map((v) => {
              const on = view === v.value;
              return (
                <Pressable
                  key={v.value}
                  testID={`view-${v.value}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setView(v.value)}
                  style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, backgroundColor: on ? colors.accent : "transparent" }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", color: on ? colors.accentFg : colors.textSecondary }}>
                    {v.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text testID="main-amount" style={{ color: main.color, fontSize: 38, fontWeight: "800", letterSpacing: -0.8, marginTop: 10 }}>
            {fmtArs(main.value)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 6 }}>{main.text}</Text>
        </View>

        <Divider />
        {main.rows.map((r, i) => (
          <View key={r.label}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 11 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{r.label}</Text>
                {r.note ? <Text style={{ color: colors.amber, fontSize: 11, marginTop: 1 }}>{r.note}</Text> : null}
              </View>
              <Text style={{ color: r.muted ? colors.textSecondary : colors.text, fontSize: 14, fontWeight: "600" }}>
                {r.sign} {fmtArs(r.value)}
              </Text>
            </View>
          </View>
        ))}

        {isFree && summary.reservedRows.length > 0 && (
          <>
            <Divider />
            <Pressable
              testID="reserved-toggle"
              accessibilityRole="button"
              accessibilityState={{ expanded: detail === "open" }}
              onPress={() => setDetail(detail === "open" ? "closed" : "open")}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 11 }}
            >
              <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>
                En qué está reservado
              </Text>
              <Text testID="reserved-total" style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                {fmtArs(summary.reservedArs)}
              </Text>
              <Ionicons name={detail === "open" ? "chevron-up" : "chevron-down"} size={14} color={colors.borderStrong} />
            </Pressable>
            {detail === "open" && (
              <View testID="reserved-rows" style={{ paddingBottom: 8 }}>
                {summary.reservedRows.map((r) => (
                  <View
                    key={`${r.categoryId ?? "none"}-${r.isCards ? "cards" : "cat"}`}
                    style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingVertical: 6 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14 }}>{r.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                        {[
                          r.pending > 0.5 ? `falta pagar ${fmtArs(r.pending)}` : null,
                          r.budgetLeft > 0.5 ? `presupuesto sin gastar ${fmtArs(r.budgetLeft)}` : null,
                        ].filter(Boolean).join(" + ")}
                      </Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 14 }}>{fmtArs(r.reserved)}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <Divider />
        <Pressable
          testID="other-toggle"
          accessibilityRole="button"
          accessibilityLabel={`Ver ${other.label}`}
          onPress={() => setView(other.view)}
          style={{ backgroundColor: colors.elevated, paddingHorizontal: 20, paddingVertical: 14 }}
        >
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>
              {other.label}
            </Text>
            <Text testID="other-amount" style={{ color: other.color, fontSize: 20, fontWeight: "800" }}>
              {fmtArs(other.value)}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{other.text}</Text>
        </Pressable>
      </ListCard>

      {summary.rows.length > 0 && (
        <View style={{ gap: 8 }}>
          <SectionTitle>Presupuesto</SectionTitle>
          <ListCard>
            {summary.rows.map((r, i) => (
              <View key={r.categoryId ?? "none"}>
                {i > 0 && <Divider />}
                <BudgetItem row={r} />
              </View>
            ))}
          </ListCard>
        </View>
      )}
    </>
  );
}

function statusColor(s: BudgetRow["status"]): string {
  return s === "over" ? colors.red : s === "near" || s === "unbudgeted" ? colors.amber : s === "ok" ? colors.green : colors.borderStrong;
}

function budgetMessage(row: BudgetRow): string {
  switch (row.status) {
    case "over": return `Te pasaste ${fmtArs(-row.remaining)}`;
    case "near": return row.remaining < 0.5 ? "Justo en el tope" : `Quedan ${fmtArs(row.remaining)}`;
    case "ok": return `Quedan ${fmtArs(row.remaining)}`;
    default: return "Sin presupuesto";
  }
}

function BudgetItem({ row }: { row: BudgetRow }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{row.name}</Text>
            {row.status === "over" && <Pill tone="red">excedido</Pill>}
            {row.status === "near" && <Pill tone="amber">cerca del tope</Pill>}
          </View>
          <Text style={{ color: row.status === "over" ? colors.red : colors.textSecondary, fontSize: 12 }}>{budgetMessage(row)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{fmtArs(row.actual)}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{row.budget > 0 ? `de ${fmtArs(row.budget)}` : "—"}</Text>
        </View>
      </View>
      <ProgressBar value={row.actual} max={row.budget} color={statusColor(row.status)} />
      {row.pending > 0.5 && (
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
          Pagado {fmtArs(row.paid)} · falta pagar {fmtArs(row.pending)}
        </Text>
      )}
    </View>
  );
}
