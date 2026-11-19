"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { AccountDTO } from "@/lib/plan/account-types";
import { Field, NativeSelect } from "./plan-ui";
export function AccountPicker({ value, onChange, currency, label = "Cuenta", financeId }: { value: string; onChange: (id: string) => void; currency: "ARS" | "USD"; label?: string; financeId?: string }) {
 const [accounts, setAccounts] = useState<AccountDTO[]>([]); const [error, setError] = useState("");
 useEffect(() => { let alive = true; fetch(`/api/plan/accounts?activeOnly=1${financeId ? `&financeId=${encodeURIComponent(financeId)}` : ""}`).then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error); if (alive) setAccounts(b.accounts); }).catch((e) => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [financeId]);
 const eligible = accounts.filter((a) => a.currency === currency && (!a.isArchived || a.id === value));
 return <Field label={label} hint={error || (!eligible.length ? "Creá una cuenta de esta moneda en la finanza para continuar." : undefined)}><NativeSelect value={value} onChange={onChange} ariaLabel={label}><option value="">Elegí una cuenta</option>{eligible.map((a) => <option key={a.id} value={a.id}>{a.name}{a.isArchived ? " (archivada)" : ""}</option>)}</NativeSelect>{!eligible.length ? <Link className="text-sm underline" href="/plan/cuentas">Ir a Cuentas</Link> : null}</Field>;
}
