import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Button, Chip, Surface, Text, TextField, VStack } from "../../components/atoms";
import { useTheme } from "../../design-system";
import { BigAmountField, DateField, FinanceChip, KeyboardDoneBar, SelectField } from "../../components/molecules";
import { ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { useActiveFinance, useCanWrite } from "../../providers/ActiveFinanceProvider";
import { formatMoney } from "../../i18n/format";
import { numberToInput, parseMoney, todayIso } from "../../domain";
import { accountCreationCurrency, accountErrorMessage } from "./account-errors";
import { useAccountDetail, useAccounts, useResourceCards, useResourceMutation, type AccountDTO } from "./data";
import { AccountsList, CardsGroup } from "./ResourcesOverview";
import { CardManagerSheet } from "./CardManagerSheet";
import { BankPicker, ChipRow, CurrencySelect } from "./pickers";
import { useQueryClient } from "@tanstack/react-query";

const TYPES = [{ id: "BANK", label: "Banco" }, { id: "WALLET", label: "Billetera" }, { id: "CASH", label: "Efectivo" }, { id: "OTHER", label: "Otra" }] as const;
type AccountType = (typeof TYPES)[number]["id"];
function Header({ title }: { title: string }) { return <ScreenHeader title={title} backLabel="Volver" onBack={() => router.back()} />; }
export function AccountsScreen({ createOnly = false }: { createOnly?: boolean } = {}) {
 const params = useLocalSearchParams<{ moneda?: string; financeId?: string; card?: string; action?: string }>();
 const q = useAccounts(createOnly, params.financeId); const cardsQ = useResourceCards(); const [managing, setManaging] = useState<string | "new" | null>(params.card ?? null); const qc = useQueryClient(); const [refreshing, setRefreshing] = useState(false); const mutation = useResourceMutation(); const canWrite = useCanWrite();
 const [editing, setEditing] = useState(createOnly); const [name, setName] = useState(""); const [type, setType] = useState<AccountType>("BANK"); const [currency, setCurrency] = useState<"ARS" | "USD">(() => accountCreationCurrency(params.moneda)); const [balance, setBalance] = useState(""); const [date, setDate] = useState(todayIso());
 const accounts = q.data?.accounts ?? [];
 const { active, finances } = useActiveFinance();
 const { space } = useTheme();
 const writable = finances.filter((f) => f.role !== "VIEWER");
 const [financeId, setFinanceId] = useState<string>(params.financeId ?? active?.id ?? "");
 const financeName = (params.financeId ? finances.find((f) => f.id === params.financeId)?.name : active?.name) ?? "esta finanza";
 return <ScreenTemplate header={<Header title={createOnly ? "Nueva cuenta" : "Cuentas y tarjetas"} />} testID="accounts" edges={["top", "bottom"]} refreshing={refreshing} onRefresh={createOnly ? undefined : () => { setRefreshing(true); void qc.invalidateQueries().finally(() => setRefreshing(false)); }}>
    {q.isPending ? <Text variant="secondary">Cargando…</Text> : q.isError ? <Surface><VStack gap={2}><Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">{accountErrorMessage(q.error)}</Text><Button label="Reintentar" onPress={() => void q.refetch()} /></VStack></Surface> : null}
  {!createOnly && q.isSuccess ? <AccountsList accounts={accounts} showFinance={new Set(accounts.map((a) => a.householdId)).size > 1} onAdd={canWrite ? () => router.push("/cuentas/nueva") : undefined} /> : null}
  {!createOnly && q.isSuccess && !accounts.length ? <Text variant="secondary">Agregá una cuenta para registrar por dónde entra y sale tu dinero.</Text> : null}
  {!createOnly && cardsQ.isSuccess ? <CardsGroup cards={cardsQ.data.cards} showFinance={new Set(cardsQ.data.cards.map((c) => c.householdId)).size > 1} onAdd={canWrite ? () => setManaging("new") : undefined} onOpen={setManaging} /> : null}
  {managing ? <CardManagerSheet cardId={managing === "new" ? null : managing} initialForm={managing === params.card && (params.action === "statement" || params.action === "purchase") ? params.action : undefined} onClose={() => { setManaging(null); if (params.card) router.back(); }} /> : null}
  {editing && canWrite && q.isSuccess ? <VStack gap={4}>
   <VStack gap={1}>
    <Text variant="secondaryStrong" tone="inkMuted" align="center">Saldo inicial</Text>
    <BigAmountField autoFocus accessibilityLabel="Saldo inicial" value={balance} onChange={setBalance} symbol={currency === "USD" ? "US$" : "$"} />
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
     <View style={{ flexShrink: 1 }}>{writable.length > 1 ? <SelectField compact icon="home-outline" label="Finanza donde se agrega" value={financeId} onChange={setFinanceId} options={writable.map((f) => ({ value: f.id, label: f.name }))} /> : <FinanceChip name={writable.find((f) => f.id === financeId)?.name ?? financeName} />}</View>
     <CurrencySelect value={currency} onChange={setCurrency} />
    </View>
   </VStack>
   <VStack gap={2}>
    <Text variant="bodyStrong">Tipo de cuenta</Text>
    <ChipRow value={type} options={TYPES} onChange={(t) => { setType(t); if (t === "CASH") setName("Efectivo"); else if (name === "Efectivo") setName(""); }} />
   </VStack>
   {type === "BANK" || type === "WALLET" ? <VStack gap={2}>
    <Text variant="bodyStrong">{type === "WALLET" ? "Billetera" : "Banco"}</Text>
    <BankPicker value={name} onChange={(n, b) => { setName(n); if (b?.wallet) setType("WALLET"); else if (b && type === "WALLET" && !b.wallet) setType("BANK"); }} />
   </VStack> : null}
   {type === "OTHER" ? <TextField accessibilityLabel="Nombre de la cuenta" placeholder="Nombre de la cuenta" value={name} onChangeText={setName} /> : null}
   <VStack gap={2}>
    <Text variant="bodyStrong">Fecha del saldo</Text>
    <DateField label="Fecha del saldo inicial" value={date} onChange={setDate} />
    <Text variant="secondary" tone="inkMuted">Solo se suman las operaciones desde ese día.</Text>
   </VStack>
   <Button label="Guardar cuenta" busy={mutation.isPending} disabled={!name.trim() || !date} onPress={() => mutation.mutate({ method: "POST", path: "/api/plan/accounts", body: { name, type, currency, ...(financeId ? { householdId: financeId } : {}), openingBalance: parseMoney(balance), openingDate: date } }, { onSuccess: () => { setEditing(false); setName(""); if (createOnly) router.back(); } })} />
  </VStack> : null}
  {mutation.error ? <Text variant="secondary" tone="dangerInk">{accountErrorMessage(mutation.error)}</Text> : null}
  <KeyboardDoneBar />
 </ScreenTemplate>;
}
export function AccountDetailScreen() {
 const { id = "" } = useLocalSearchParams<{ id: string }>(); const q = useAccountDetail(id); const mutation = useResourceMutation();
 const canWrite = useCanWrite(); const a = q.data?.account;
 const [editing, setEditing] = useState(false); const [name, setName] = useState(""); const [balance, setBalance] = useState(""); const [date, setDate] = useState("");
 if (!a) return <ScreenTemplate header={<Header title="Cuenta" />}><Text variant="secondary">{q.isError ? q.error.message : "Cargando…"}</Text><Button label="Reintentar" onPress={() => void q.refetch()} /></ScreenTemplate>;
 const run = (method: string, path: string, body?: unknown) => mutation.mutate({ method, path, body });
 return <ScreenTemplate header={<Header title={a.name} />} edges={["top", "bottom"]}>
  <Text variant="number">{formatMoney(a.balance, a.currency)}</Text><FinanceChip name={a.financeName} />
  {a.balance < 0 ? <Text variant="secondary" tone="dangerInk">Esta cuenta queda en negativo.</Text> : null}
  {a.originFinanceName ? <Text variant="secondary">Origen: {a.originFinanceName}</Text> : null}
  {a.isOwner && canWrite ? <><Button variant="secondary" label="Editar cuenta y saldo inicial" onPress={() => { setName(a.name); setBalance(numberToInput(a.openingBalance)); setDate(a.openingDate ?? ""); setEditing(!editing); }} />
   {editing ? <VStack gap={2}><TextField accessibilityLabel="Nombre" value={name} onChangeText={setName} /><BigAmountField accessibilityLabel="Saldo inicial" value={balance} onChange={setBalance} /><DateField label="Fecha del saldo inicial" value={date} onChange={setDate} clearable /><Button label="Guardar cambios" busy={mutation.isPending} onPress={() => run("PATCH", `/api/plan/accounts/${id}`, { name, openingBalance: parseMoney(balance), openingDate: date || null })} /></VStack> : null}
   {!a.isArchived ? <Button label="Transferir / Sacar efectivo / Cambiar moneda" onPress={() => router.push({ pathname: "/cuentas/transferir", params: { from: a.id } })} /> : null}
   <Button variant="secondary" label={a.isArchived ? "Reactivar cuenta" : a.balance !== 0 ? "Archivar cuenta conservando su saldo" : "Archivar cuenta"} onPress={() => run("PATCH", `/api/plan/accounts/${id}`, { isArchived: !a.isArchived, confirm: true })} />
   <ResourceMoveOptions resource={a} kind="accounts" />
   <Button variant="text" label="Eliminar cuenta sin movimientos" onPress={() => mutation.mutate({ method: "DELETE", path: `/api/plan/accounts/${id}` }, { onSuccess: () => router.back() })} />
  </> : null}
  {mutation.error ? <Text variant="secondary" tone="dangerInk">{mutation.error.message}</Text> : null}
  <KeyboardDoneBar />
  <Text variant="bodyStrong">Movimientos de la cuenta</Text>
  {q.data?.movements.map((m) => <Surface key={`${m.type}-${m.id}`}><Text variant="bodyStrong">{m.name} · {formatMoney(m.amount, m.currency)}</Text><Text variant="secondary">{m.date ?? "Sin fecha"}{m.financeName ? ` · ${m.financeName}` : ""}{m.originFinanceName ? ` · Origen: ${m.originFinanceName}` : ""}</Text>{m.type === "TRANSFER" && a.isOwner ? <Button variant="text" label="Deshacer transferencia" onPress={() => run("DELETE", `/api/plan/account-transfers/${m.id}`)} /> : null}</Surface>)}
  {!q.data?.movements.length ? <Text variant="secondary">Sin movimientos.</Text> : null}
 </ScreenTemplate>;
}
export function ResourceMoveOptions({ resource, kind }: { resource: Pick<AccountDTO, "id" | "householdId">; kind: "accounts" | "cards" }) {
 const { finances } = useActiveFinance(); const mutation = useResourceMutation(); const [target, setTarget] = useState<string | null>(null);
 const source = finances.find((f) => f.id === resource.householdId);
 if (!source || source.role === "VIEWER") return <Text variant="secondary">Para trasladar el historial necesitás permiso de escritura en la finanza de origen.</Text>;
 return <VStack gap={2}><Text variant="bodyStrong">Mover completo a otra finanza</Text><Text variant="secondary">Incluye su historial. Los pagos conservan las cuentas reales que usaron. Quedará la marca de origen.</Text>
  {finances.filter((f) => f.id !== resource.householdId && f.role !== "VIEWER").map((f) => <Chip key={f.id} label={f.name} active={target === f.id} onPress={() => setTarget(f.id)} />)}
  {target ? <Button label="Mover con todo su historial" busy={mutation.isPending} onPress={() => mutation.mutate({ method: "POST", path: `/api/plan/${kind}/${resource.id}/move`, body: { toFinanceId: target } }, { onSuccess: () => setTarget(null) })} /> : null}
  {mutation.error ? <Text variant="secondary" tone="dangerInk">{mutation.error.message}</Text> : null}
 </VStack>;
}
