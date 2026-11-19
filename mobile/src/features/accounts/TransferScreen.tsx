import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Text, TextField, VStack } from "../../components/atoms";
import { BigAmountField, DateField, KeyboardDoneBar, SelectField } from "../../components/molecules";
import { ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { parseMoney, todayIso } from "../../domain";
import { useAccounts, useResourceMutation } from "./data";
export function TransferScreen() {
 const params = useLocalSearchParams<{ from?: string }>(); const q = useAccounts(true); const mutation = useResourceMutation();
 const [warning, setWarning] = useState<string | null>(null);
 const [from, setFrom] = useState(params.from ?? ""); const [to, setTo] = useState(""); const [kind, setKind] = useState("TRANSFER"); const [amount, setAmount] = useState(""); const [received, setReceived] = useState(""); const [date, setDate] = useState(todayIso());
 const accounts = q.data?.accounts.filter((a) => a.isOwner && !a.isArchived) ?? [];
 return <ScreenTemplate header={<ScreenHeader title="Mover dinero" onBack={() => router.back()} backLabel="Volver" />} edges={["top", "bottom"]}>
  <Text variant="secondary">Entre tus cuentas de esta finanza. No cuenta como ingreso ni gasto.</Text>
  <SelectField label="Tipo de operación" value={kind} onChange={(id) => { setKind(id); setTo(""); }} options={[{ value: "TRANSFER", label: "Transferir" }, { value: "CASH_WITHDRAWAL", label: "Sacar efectivo" }, { value: "BUY_USD", label: "Comprar / vender dólares" }]} />
  <Text variant="bodyStrong">Sale de</Text><SelectField label="Sale de" placeholder="Elegir cuenta" value={from || null} onChange={setFrom} options={accounts.map((a) => ({ value: a.id, label: a.name, hint: a.currency }))} />
  <Text variant="bodyStrong">Entra a{kind === "CASH_WITHDRAWAL" ? " (se crea Efectivo si falta)" : ""}</Text>
  <SelectField label="Entra a" placeholder="Elegir cuenta" value={to || null} onChange={setTo} options={accounts.filter((a) => a.id !== from && (kind === "CASH_WITHDRAWAL" ? a.type === "CASH" : true)).map((a) => ({ value: a.id, label: a.name, hint: a.currency }))} />
  <Text variant="bodyStrong">Monto que sale</Text><BigAmountField accessibilityLabel="Monto que sale" value={amount} onChange={setAmount} />
  {kind === "BUY_USD" ? <VStack gap={2}><Text variant="bodyStrong">Monto que entra</Text><BigAmountField accessibilityLabel="Monto que entra" value={received} onChange={setReceived} /><Text variant="secondary">El tipo de cambio queda guardado con esta operación.</Text></VStack> : null}
  <Text variant="bodyStrong">Fecha</Text><DateField label="Fecha de la operación" value={date} onChange={setDate} />
  <Button label="Confirmar operación" busy={mutation.isPending} disabled={!from || !(parseMoney(amount) > 0) || (kind !== "CASH_WITHDRAWAL" && !to)} onPress={() => mutation.mutate({ method: "POST", path: "/api/plan/account-transfers", body: { kind, fromAccountId: from, toAccountId: to || undefined, amountFrom: parseMoney(amount), amountTo: parseMoney(received), date } }, { onSuccess: (res) => { if (res.warning) { setWarning(res.warning); setAmount(""); } else router.back(); } })} />
  {warning ? <><Text variant="secondary" tone="dangerInk">{warning}</Text><Button variant="secondary" label="Volver a la cuenta" onPress={() => router.back()} /></> : null}
  {mutation.error ? <Text variant="secondary" tone="dangerInk">{mutation.error.message}</Text> : null}
 <KeyboardDoneBar />
 </ScreenTemplate>;
}
