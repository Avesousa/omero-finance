import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Icon, IconButton, InitialsTile, Skeleton, Text, TextField, VStack } from "../../components/atoms";
import { ActionCircle, BigAmountField, DateField, FilterChips, KeyboardDoneBar, SectionTitle } from "../../components/molecules";
import { GroupedMovements, PlataHero, ScreenHeader, type MovementGroup } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { palette } from "../../design-system/tokens/palette";
import { useTheme } from "../../design-system";
import { useActiveFinance, useCanWrite } from "../../providers/ActiveFinanceProvider";
import { numberToInput, parseMoney } from "../../domain";
import { formatMoney } from "../../i18n/format";
import { dayLabel, dayMonth } from "../cards/cardDisplay";
import { financeDisplayName, financeDotColor } from "../finances/financeDisplay";
import { accountLook } from "./accountVisual";
import { formatSigned } from "./format";
import { accountErrorMessage } from "./account-errors";
import { useAccountDetail, useResourceMutation, type AccountMovementDTO } from "./data";
import { ResourceMoveOptions } from "./AccountsScreen";

const TYPE_LABEL = { BANK: "Banco", WALLET: "Billetera", CASH: "Efectivo", OTHER: "Otra" } as const;
const dayTitle = (iso: string | null) => { if (!iso) return "SIN FECHA"; const { day, month } = dayMonth(iso); const l = dayLabel(iso); return l === "Hoy" || l === "Ayer" ? `${l.toUpperCase()} · ${day} ${month}` : `${day} ${month}`; };
const daysAgo = (iso: string | null) => (iso ? Math.round((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000) : 999);

/** Evolución de los últimos 30 días: barras con el saldo al cierre de cada tramo, hacia atrás desde el saldo de hoy. */
function Evolution({ balance, movements }: { balance: number; movements: AccountMovementDTO[] }) {
  const N = 12;
  const points = Array.from({ length: N }, (_, i) => {
    const age = 30 - ((i + 1) * 30) / N + 30 / N; // días atrás de ese tramo
    const after = movements.filter((m) => daysAgo(m.date) < age).reduce((n, m) => n + m.amount, 0);
    return balance - after;
  });
  const lo = Math.min(...points, balance), hi = Math.max(...points, balance);
  const span = hi - lo || 1;
  return (
    <View accessibilityLabel="Evolución del saldo en 30 días" accessibilityRole="image" style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 44 }}>
      {[...points].reverse().concat(balance).map((p, i, arr) => <View key={i} style={{ flex: 1, height: 8 + ((p - lo) / span) * 36, borderRadius: 3, backgroundColor: palette.white, opacity: i === arr.length - 1 ? 1 : 0.45 }} />)}
    </View>
  );
}

/** Detalle de una cuenta: saldo, evolución, acciones y movimientos filtrables por finanza. */
export function AccountDetailScreen() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { colors, mode, space, sizes } = useTheme();
  const canWrite = useCanWrite();
  const { finances } = useActiveFinance();
  const q = useAccountDetail(id);
  const [fin, setFin] = useState("all");
  const [admin, setAdmin] = useState(false);
  const a = q.data?.account;
  const moves = q.data?.movements ?? [];

  const flow = useMemo(() => {
    const recent = moves.filter((m) => daysAgo(m.date) <= 30);
    return { in: recent.filter((m) => m.amount > 0).reduce((n, m) => n + m.amount, 0), out: -recent.filter((m) => m.amount < 0).reduce((n, m) => n + m.amount, 0) };
  }, [moves]);
  const finOptions = useMemo(() => {
    const names = [...new Set(moves.map((m) => m.financeName).filter((n): n is string => !!n))];
    return [{ id: "all", label: "Todo" }, ...names.map((n) => ({ id: n, label: n })), ...(moves.some((m) => m.masked) ? [{ id: "hidden", label: "Otras" }] : [])];
  }, [moves]);
  const groups: MovementGroup[] = useMemo(() => {
    const keep = (m: AccountMovementDTO) => fin === "all" || (fin === "hidden" ? !!m.masked : m.financeName === fin);
    const by = new Map<string, AccountMovementDTO[]>();
    for (const m of moves.filter(keep)) by.set(m.date ?? "", [...(by.get(m.date ?? "") ?? []), m]);
    return [...by.entries()].map(([date, list]) => ({
      key: date || "none", title: dayTitle(date || null),
      items: list.map((m) => {
        const f = finances.find((x) => x.name === m.financeName);
        return {
          key: `${m.type}-${m.id}`, ico: m.masked ? "··" : m.type === "TRANSFER" ? "⇄" : m.name.slice(0, 2).toUpperCase(), name: m.masked ? "Otra finanza" : m.name, muted: m.masked,
          meta: m.masked ? "De una finanza que no podés ver" : m.type === "TRANSFER" ? `Entre tus cuentas${m.originFinanceName ? ` · origen ${m.originFinanceName}` : ""}` : m.type === "CARD_PAYMENT" ? "Pago de tarjeta" : m.originFinanceName ? `Cambio de finanza · ${m.originFinanceName}` : "Movimiento",
          amount: formatSigned(m.amount, m.currency, m.type === "TRANSFER"), positive: m.type !== "TRANSFER" && m.amount > 0,
          fin: m.masked ? "Oculto" : m.financeName ?? undefined, finDot: f ? financeDotColor(f, mode) : undefined,
        };
      }),
    }));
  }, [moves, fin, finances, mode]);

  const header = (
    <View>
      <View style={{ height: 4, backgroundColor: colors.primary }} />
      <ScreenHeader title="Cuenta" onBack={() => router.back()} backLabel="Volver" right={a?.isOwner && canWrite ? <IconButton testID="account-admin" icon="settings-outline" accessibilityLabel="Administrar cuenta" onPress={() => setAdmin(true)} /> : undefined} />
    </View>
  );
  if (!a) return <ScreenTemplate header={header} edges={["top", "bottom"]}>{q.isError ? <><Text variant="secondary" tone="dangerInk">{accountErrorMessage(q.error)}</Text><Button label="Reintentar" onPress={() => void q.refetch()} /></> : <Skeleton height={220} shape="hero" />}</ScreenTemplate>;

  const look = accountLook(a, { primary: colors.primary, muted: colors.inkMuted, positive: colors.positiveInk });
  const money = (n: number) => formatMoney(n, a.currency);
  return (
    <ScreenTemplate header={header} testID="account-detail" edges={["top", "bottom"]} contentStyle={{ gap: space[5] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <InitialsTile color={look.color} initials={look.initials} size={48} />
        <View style={{ flex: 1 }}>
          <Text variant="screenTitle" numberOfLines={1}>{a.name}</Text>
          <Text variant="secondary" tone="inkMuted">{TYPE_LABEL[a.type]} · {a.currency}{a.isArchived ? " · archivada" : ""}</Text>
        </View>
      </View>

      <PlataHero label="SALDO HOY" amount={`${a.balance < 0 ? "−" : ""}${money(Math.abs(a.balance))}`} testID="account-hero">
        <Evolution balance={a.balance} movements={moves} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text variant="secondarySemi" tone="onPrimary">Entró {money(flow.in)}</Text>
          <Text variant="secondarySemi" tone="onPrimary">Salió {money(flow.out)}</Text>
          <Text variant="secondarySemi" tone="onPrimary">30 días</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          <View style={{ paddingHorizontal: space[3] - 2, paddingVertical: 4, borderRadius: 999, backgroundColor: palette.glass }}><Text variant="secondaryStrong" tone="onPrimary">Usada por {a.financeName}</Text></View>
          {a.originFinanceName ? <View style={{ paddingHorizontal: space[3] - 2, paddingVertical: 4, borderRadius: 999, backgroundColor: palette.glass }}><Text variant="secondaryStrong" tone="onPrimary">Origen {a.originFinanceName}</Text></View> : null}
        </View>
      </PlataHero>
      {a.balance < 0 ? <Text variant="secondary" tone="dangerInk">Esta cuenta queda en negativo.</Text> : null}

      {canWrite && !a.isArchived ? (
        <View accessibilityRole="toolbar" accessibilityLabel="Acciones de la cuenta" style={{ flexDirection: "row", gap: space[2] }}>
          <ActionCircle icon="download-outline" label="Ingresar" onPress={() => router.push("/ingresos/nuevo")} />
          <ActionCircle icon="swap-horizontal-outline" label="Mover" onPress={() => router.push({ pathname: "/cuentas/transferir", params: { from: a.id } })} />
          <ActionCircle icon="cash-outline" label="Efectivo" onPress={() => router.push({ pathname: "/cuentas/transferir", params: { from: a.id, to: "cash" } })} />
          {a.isOwner ? <ActionCircle icon="create-outline" label="Ajustar saldo" onPress={() => setAdmin(true)} /> : null}
        </View>
      ) : null}

      <View style={{ gap: space[3] }}>
        <SectionTitle title="MOVIMIENTOS" />
        {finOptions.length > 2 ? <FilterChips accessibilityLabel="Filtrar por finanza" options={finOptions.map((o) => ({ ...o, dot: undefined }))} value={fin} onChange={setFin} /> : null}
        {q.isPending ? <Skeleton height={140} /> : groups.length ? <GroupedMovements groups={groups} /> : (
          <View style={{ gap: space[3], alignItems: "flex-start" }}>
            <Text variant="body" tone="inkMuted">Esta cuenta está tranqui. Cargá el primer movimiento.</Text>
            {canWrite ? <Button variant="secondary" fullWidth={false} icon="download-outline" label="Ingresar" onPress={() => router.push("/ingresos/nuevo")} /> : null}
          </View>
        )}
      </View>
      {admin ? <AdminSheet onClose={() => setAdmin(false)} accountId={id} /> : null}
    </ScreenTemplate>
  );
}

/** Administrar la cuenta (solo su dueño): editar nombre y saldo inicial, archivar, mover de finanza o eliminar. */
function AdminSheet({ onClose, accountId }: { onClose: () => void; accountId: string }) {
  const { colors, space, radius } = useTheme();
  const q = useAccountDetail(accountId);
  const mutation = useResourceMutation();
  const a = q.data?.account;
  const [name, setName] = useState(a?.name ?? ""); const [balance, setBalance] = useState(a ? numberToInput(a.openingBalance) : ""); const [date, setDate] = useState(a?.openingDate ?? "");
  if (!a) return null;
  const run = (method: string, path: string, body?: unknown, onSuccess?: () => void) => mutation.mutate({ method, path, body }, { onSuccess });
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={{ flex: 1, backgroundColor: colors.overlay }} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[6], maxHeight: "92%" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: space[3] }}>
            <Text variant="screenTitle" style={{ flex: 1 }}>Administrar cuenta</Text>
            <IconButton icon="close" accessibilityLabel="Cerrar" onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space[4], paddingBottom: space[4] }}>
            <VStack gap={2}><Text variant="bodyStrong">Nombre</Text><TextField accessibilityLabel="Nombre" value={name} onChangeText={setName} /></VStack>
            <VStack gap={1}><Text variant="secondaryStrong" tone="inkMuted" align="center">Saldo inicial</Text><BigAmountField accessibilityLabel="Saldo inicial" value={balance} onChange={setBalance} symbol={a.currency === "USD" ? "US$" : "$"} /></VStack>
            <VStack gap={2}><Text variant="bodyStrong">Fecha del saldo</Text><DateField label="Fecha del saldo inicial" value={date} onChange={setDate} clearable /></VStack>
            <Button label="Guardar cambios" busy={mutation.isPending} onPress={() => run("PATCH", `/api/plan/accounts/${accountId}`, { name, openingBalance: parseMoney(balance), openingDate: date || null }, onClose)} />
            <Button variant="secondary" label={a.isArchived ? "Reactivar cuenta" : a.balance !== 0 ? "Archivar conservando su saldo" : "Archivar cuenta"} onPress={() => run("PATCH", `/api/plan/accounts/${accountId}`, { isArchived: !a.isArchived, confirm: true }, onClose)} />
            <ResourceMoveOptions resource={a} kind="accounts" />
            {mutation.error ? <Text variant="secondary" tone="dangerInk">{mutation.error.message}</Text> : null}
            <Button variant="text" label="Eliminar cuenta sin movimientos" onPress={() => run("DELETE", `/api/plan/accounts/${accountId}`, undefined, () => { onClose(); router.back(); })} />
          </ScrollView>
        </View>
        <KeyboardDoneBar />
      </KeyboardAvoidingView>
    </Modal>
  );
}
