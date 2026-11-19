"use client";
import { useEffect, useState } from "react";
import type { Currency } from "@/lib/plan/core";
import type { FinanceDTO } from "@/lib/plan/finances";
import { AccountPicker } from "./account-picker";
import { ErrorText, Field, NativeSelect, PrimaryButton, api, useAction } from "./plan-ui";
export function MoveEntryControl({ id, currency, onMoved }: { id: string; currency: Currency; onMoved: () => void }) {
 const [targets, setTargets] = useState<FinanceDTO[]>([]); const [target, setTarget] = useState(""); const [account, setAccount] = useState(""); const [error, setError] = useState(""); const action = useAction();
 useEffect(() => { let alive = true; fetch("/api/plan/finances").then((r) => r.json()).then((b) => { if (b.error) throw new Error(b.error); if (alive) setTargets(b.finances.filter((f: FinanceDTO) => f.id !== b.activeId && f.role !== "VIEWER")); }).catch((e) => { if (alive) setError(e.message); }); return () => { alive = false; }; }, []);
 if (!targets.length) return error ? <ErrorText error={error} /> : null;
 return <section className="border-t pt-3 space-y-3"><Field label="Mover completo a otra finanza"><NativeSelect value={target} onChange={(id) => { setTarget(id); setAccount(""); }} ariaLabel="Finanza destino"><option value="">Elegí destino</option>{targets.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</NativeSelect></Field>
 {target ? <><AccountPicker key={target} value={account} onChange={setAccount} currency={currency} financeId={target} label="Cuenta de destino" /><p className="text-xs">El movimiento deja de contar en origen y pasa completo a destino. Se recalculan los saldos de ambas cuentas; no se genera otra operación. Guardá cualquier cambio antes de moverlo.</p><PrimaryButton busy={action.busy} onClick={() => { if (!account) return action.setError("Elegí la cuenta de destino"); return action.run(() => api("POST", "/api/plan/entries/move", { entryIds: [id], toFinanceId: target, accountId: account }), onMoved); }}>Mover movimiento completo</PrimaryButton></> : null}<ErrorText error={action.error} /></section>;
}
