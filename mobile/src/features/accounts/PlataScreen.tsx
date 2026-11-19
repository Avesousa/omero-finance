import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Button, Icon, Skeleton, Text } from "../../components/atoms";
import { ActionCircle, SectionTitle } from "../../components/molecules";
import { AccountTile, AddTile, CardFace, GroupedMovements, PlataHero, type MovementGroup } from "../../components/organisms";
import { ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { useTheme } from "../../design-system";
import { cardMonth, cardsTotals, statementStatus, useCards } from "../../data";
import { useActiveFinance, useCanWrite } from "../../providers/ActiveFinanceProvider";
import { capitalize, formatDate, formatMoney, formatPeriod } from "../../i18n/format";
import { cardColor, dayLabel, dayMonth, eyebrowFor, statePill } from "../cards/cardDisplay";
import { CardPager } from "../cards/CardPager";
import { accountLook } from "./accountVisual";
import { UnassignedSheet } from "./UnassignedSheet";
import { useUnassigned } from "./unassigned";
import { formatSigned } from "./format";
import { useAccounts, useRecentMovements, type RecentMovementDTO } from "./data";

const stateDot = (s: string, c: { warning: string; danger: string; primary: string; positive: string; border: string }) => s === "estimated" ? c.warning : s === "overdue" ? c.danger : s === "paid" ? c.positive : s === "empty" ? c.border : c.primary;
const STATE_TEXT: Record<string, string> = { estimated: "Estimado", overdue: "Vencido", paid: "Pagado", empty: "Sin compras", upcoming: "Resumen cargado", dueSoon: "Resumen cargado" };

/** Plata (pantalla principal de Cuentas y tarjetas): plata libre, acciones, cuentas, tarjetas, vencimientos y últimos movimientos. */
export function PlataScreen() {
  const { colors, space } = useTheme();
  const canWrite = useCanWrite();
  const { active } = useActiveFinance();
  const accountsQ = useAccounts();
  const cardsQ = useCards();
  const movesQ = useRecentMovements(4);
  const [open, setOpen] = useState(false);
  const [explain, setExplain] = useState(false);

  const [top, setTop] = useState(0);
  const accounts = (accountsQ.data?.accounts ?? []).filter((a) => !a.isArchived);
  const unassigned = useUnassigned(accounts);
  const ars = accounts.filter((a) => a.currency === "ARS").reduce((n, a) => n + a.balance, 0);
  const ov = cardsQ.data;
  const month = ov ? capitalize(formatDate(ov.period, "month")) : "";
  const toPay = ov ? cardsTotals(ov, ov.period).toPay : 0;
  const free = ars - toPay;

  const cards = useMemo(() => (ov?.cards ?? []).filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i).map((c) => {
    const m = cardMonth(ov!, c.id, ov!.period);
    const status = statementStatus(m.statement, m.projectedArs, ov!.today);
    return { card: c, status, amount: m.statement ? m.statement.totalArs : m.projectedArs, dueDate: m.statement?.dueDate ?? null, installments: m.installmentsCount };
  }), [ov]);
  const dues = useMemo(() => cards.filter((c) => c.dueDate && c.status !== "paid").sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1)).slice(0, 6), [cards]);

  const moveGroup: MovementGroup[] = useMemo(() => {
    const items = (movesQ.data?.movements ?? []).map((m: RecentMovementDTO) => ({
      key: `${m.type}-${m.id}-${m.accountId}`, ico: m.masked ? "··" : m.name.slice(0, 2).toUpperCase(), name: m.name, muted: m.masked,
      meta: `${dayLabel(m.date)} · ${m.accountName}`, amount: formatSigned(m.amount, m.currency, m.type === "TRANSFER"), positive: m.type !== "TRANSFER" && m.amount > 0,
      fin: m.financeName ?? undefined,
    }));
    return items.length ? [{ key: "recent", title: "", items }] : [];
  }, [movesQ.data]);

  const header = (
    <View>
      <View style={{ height: 4, backgroundColor: colors.primary }} />
      <ScreenHeader title="Tu plata" onBack={() => router.back()} backLabel="Volver" />
    </View>
  );
  const look = (a: (typeof accounts)[number]) => accountLook(a, { primary: colors.primary, muted: colors.inkMuted, positive: colors.positiveInk });
  const hscroll = { marginHorizontal: -space[5] } as const;

  return (
    <ScreenTemplate header={header} testID="plata" edges={["top"]} refreshing={accountsQ.isRefetching || cardsQ.isRefetching} onRefresh={() => { void accountsQ.refetch(); void cardsQ.refetch(); void movesQ.refetch(); }} contentStyle={{ gap: space[6] }}>
      {accountsQ.isPending || cardsQ.isPending ? <Skeleton height={190} shape="hero" /> : (
        <PlataHero label="PLATA LIBRE" amount={`${free < 0 ? "−" : ""}${formatMoney(Math.abs(free))}`} message={toPay > 0 ? `Ya separamos lo de las tarjetas de ${month.toLowerCase()}.` : "No tenés tarjetas por pagar este mes."} testID="plata-hero">
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={{ alignSelf: "flex-start", minHeight: 36, paddingHorizontal: space[3], flexDirection: "row", alignItems: "center", gap: space[1] + 2, borderRadius: 999, backgroundColor: "transparent" }}>
            <Text variant="secondaryStrong" tone="onPrimary">{open ? "Ocultar cuenta" : "Ver la cuenta"}</Text>
            <Icon name={open ? "chevron-up" : "chevron-down"} size="sm" tone="onPrimary" />
          </Pressable>
          {open ? (
            <View style={{ gap: space[1] + 2, paddingTop: space[1] }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text variant="body" tone="onPrimary">En tus cuentas</Text><Text variant="bodyStrong" tone="onPrimary">{formatMoney(ars)}</Text></View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text variant="body" tone="onPrimary">Tarjetas de {month.toLowerCase()}</Text><Text variant="bodyStrong" tone="onPrimary">−{formatMoney(toPay)}</Text></View>
            </View>
          ) : null}
        </PlataHero>
      )}

      {canWrite ? (
        <View accessibilityRole="toolbar" accessibilityLabel="Acciones rápidas" style={{ flexDirection: "row", gap: space[2] }}>
          <ActionCircle testID="plata-move" icon="swap-horizontal-outline" label="Mover" onPress={() => router.push("/cuentas/transferir")} />
          <ActionCircle testID="plata-income" icon="download-outline" label="Ingresar" onPress={() => router.push("/ingresos/nuevo")} />
          <ActionCircle testID="plata-pay" emphasis="solid" icon="card-outline" label="Pagar tarjeta" onPress={() => router.push({ pathname: "/tarjetas", params: { action: "pay" } })} />
          <ActionCircle testID="plata-cash" icon="cash-outline" label="Efectivo" onPress={() => router.push({ pathname: "/cuentas/transferir", params: { to: "cash" } })} />
        </View>
      ) : null}

      <View style={{ gap: space[3] }}>
        <SectionTitle title={`CUENTAS · ${accounts.length}`} action={{ label: "Ver todas", onPress: () => router.push("/cuentas/todas") }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={hscroll} contentContainerStyle={{ gap: space[3], paddingHorizontal: space[5] }}>
          {accounts.map((a) => { const l = look(a); return <AccountTile key={a.id} name={a.name} balance={formatMoney(a.balance, a.currency)} currency={a.currency} color={l.color} initials={l.initials} onPress={() => router.push({ pathname: "/cuentas/[id]", params: { id: a.id } })} />; })}
          {unassigned.amount !== 0 && unassigned.balance != null ? <AccountTile name="Sin definir" balance={`${unassigned.amount < 0 ? "−" : ""}${formatMoney(Math.abs(unassigned.amount))}`} currency="ARS" color={colors.inkMuted} initials="?" onPress={() => setExplain(true)} /> : null}
          {canWrite ? <AddTile label="Agregar cuenta" onPress={() => router.push("/cuentas/nueva")} /> : null}
        </ScrollView>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionTitle title={`TARJETAS · RESÚMENES DE ${month.toUpperCase()}`} action={cards.length ? { label: "Ver", onPress: () => router.push({ pathname: "/tarjetas", params: { card: "all" } }) } : undefined} />
        {cards.length ? (
          <>
            <CardPager dots peek={space[5]} data={cards} index={top} onIndexChange={setTop} keyOf={(c) => c.card.id} renderItem={(c, _i, w) => (
              <CardFace width={w} color={cardColor(c.card.entity)} title={c.card.name} subtitle={c.card.entity ?? undefined} network={c.card.brand} eyebrow={eyebrowFor(c.status, c.dueDate)} amount={formatMoney(c.amount)} state={statePill(c.status)} extra={c.installments ? `${c.installments} ${c.installments === 1 ? "cuota" : "cuotas"} este mes` : undefined} onPress={() => router.push({ pathname: "/tarjetas", params: { card: c.card.id } })} />
            )} />
          </>
        ) : canWrite && !cardsQ.isPending ? <Button variant="secondary" icon="add" label="Agregar tarjeta" onPress={() => router.push({ pathname: "/tarjetas", params: { action: "new" } })} /> : null}
      </View>

      {dues.length ? (
        <View style={{ gap: space[3] }}>
          <SectionTitle title="PRÓXIMOS VENCIMIENTOS" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={hscroll} contentContainerStyle={{ gap: space[3], paddingHorizontal: space[5] }}>
            {dues.map((d) => { const dm = dayMonth(d.dueDate!); return (
              <View key={d.card.id} style={{ width: 168, padding: space[4], gap: space[2], borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
                    <Text variant="number" style={{ fontSize: 18, lineHeight: 20 }}>{dm.day}</Text>
                    <Text variant="label" tone="inkMuted">{dm.month}</Text>
                  </View>
                  <Text variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>{d.card.name}</Text>
                </View>
                <Text variant="money" numberOfLines={1} adjustsFontSizeToFit>{formatMoney(d.amount)}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] + 2 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stateDot(d.status, colors) }} />
                  <Text variant="secondary" tone="inkMuted">{STATE_TEXT[d.status]}</Text>
                </View>
              </View>
            ); })}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ gap: space[3] }}>
        <SectionTitle title="ÚLTIMOS MOVIMIENTOS" action={{ label: "Ver todos", onPress: () => router.push("/movimientos") }} />
        {movesQ.isPending ? <Skeleton height={120} /> : moveGroup.length ? <GroupedMovements groups={moveGroup} /> : <Text variant="secondary" tone="inkMuted">Todavía no hay movimientos en tus cuentas.</Text>}
      </View>
      {explain && unassigned.balance != null ? <UnassignedSheet balance={unassigned.balance} accountsTotal={unassigned.accountsTotal} onClose={() => setExplain(false)} /> : null}
      {active ? <Text variant="secondary" tone="inkMuted" align="center">Finanza activa: {active.name}</Text> : null}
    </ScreenTemplate>
  );
}
