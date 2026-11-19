"use client";
import { useState } from "react";
import { AccountPicker } from "./account-picker";
import { DoneToggle, Sheet, PrimaryButton, ErrorText, api, useAction } from "./plan-ui";
export function StatementPaymentControl({ id, isPaid, hasUsd }: { id: string; isPaid: boolean; hasUsd: boolean }) {
 const [open, setOpen] = useState(false); const [accountId, setAccountId] = useState(""); const [usdAccountId, setUsdAccountId] = useState(""); const action = useAction();
 return <><DoneToggle done={isPaid} label={isPaid ? "Deshacer pago del resumen" : "Pagar resumen"} onToggle={() => { if (isPaid) void action.run(() => api("POST", `/api/plan/card-statements/${id}/unpay`, {})); else setOpen(true); }} />
 {open ? <Sheet title="Pagar resumen" onClose={() => setOpen(false)}><AccountPicker currency="ARS" value={accountId} onChange={setAccountId} label="Pagar desde" />{hasUsd ? <><p className="text-sm">Elegí una cuenta USD para pagarlos por separado, o dejala vacía para convertirlos a pesos con el tipo de cambio del mes.</p><AccountPicker currency="USD" value={usdAccountId} onChange={setUsdAccountId} label="Cuenta USD (opcional)" /></> : null}<ErrorText error={action.error} /><PrimaryButton busy={action.busy} onClick={() => action.run(() => api("POST", `/api/plan/card-statements/${id}/pay`, { accountId, usdAccountId: usdAccountId || undefined }), () => setOpen(false))}>Confirmar pago</PrimaryButton></Sheet> : null}<ErrorText error={action.error} /></>;
}
