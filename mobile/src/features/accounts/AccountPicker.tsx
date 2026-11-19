import { useEffect } from "react";
import { router } from "expo-router";
import { Button, Text, VStack } from "../../components/atoms";
import { SelectField } from "../../components/molecules";
import { accountErrorMessage } from "./account-errors";
import { useAccounts } from "./data";

export function AccountPicker({ value, onChange, currency, label = "Cuenta", financeId, autoSelect = true }: { value: string | null; onChange: (id: string | null) => void; currency: "ARS" | "USD"; label?: string; financeId?: string; autoSelect?: boolean }) {
 const q = useAccounts(true, financeId);
 const accounts = q.data?.accounts.filter((a) => (!a.isArchived || a.id === value) && a.currency === currency) ?? [];
 const suggested = accounts.find((a) => !a.isArchived)?.id;
 const valid = accounts.some((a) => a.id === value);
 useEffect(() => { if (q.isSuccess && !valid) { if (autoSelect && suggested) onChange(suggested); else if (value != null) onChange(null); } }, [q.isSuccess, valid, suggested, onChange, autoSelect, value]);
 return <VStack gap={2}>
  <Text variant="bodyStrong">{label}</Text>
  {q.isPending ? <Text variant="secondary">Cargando cuentas…</Text> : q.isError ? <><Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">{accountErrorMessage(q.error)}</Text><Button variant="text" label="Reintentar cuentas" onPress={() => void q.refetch()} /></> : accounts.length ? <SelectField label={label} placeholder="Elegir cuenta" value={value} onChange={onChange} options={accounts.map((a) => ({ value: a.id, label: `${a.name}${a.isArchived ? " (archivada)" : ""}`, hint: a.currency }))} /> : <><Text variant="secondary">Creá una cuenta en {currency} en esta finanza para continuar.</Text><Button variant="text" label="Crear cuenta" onPress={() => router.push({ pathname: "/cuentas/nueva", params: { moneda: currency, ...(financeId ? { financeId } : {}) } })} /></>}
 </VStack>;
}
