"use client";
import { useState } from "react";
import Link from "next/link";
import type { PlanData } from "@/lib/plan/server";
import { fmtMoney, loanDueDate, todayIso } from "@/lib/plan/core";
import { PlanHeader } from "./plan-ui";
export function MovementsClient({ data }: { data: PlanData }) {
 const [kind, setKind] = useState("all"); const [query, setQuery] = useState("");
 const category = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? "";
 const entries = data.entries.map((e) => ({ id: e.id, name: e.name, kind: e.kind, amount: e.amount, currency: e.currency, date: e.collectedAt ?? e.paidAt ?? e.date, done: e.isDone || (!e.recurringId && !e.loanId), due: e.recurringId ? loanDueDate(data.recurrings.find((r) => r.id === e.recurringId)?.dueDay ?? null, e.period) ?? e.date : e.date, meta: [category(e.categoryId), e.accountName, e.originFinanceName ? `Origen: ${e.originFinanceName}` : ""].filter(Boolean).join(" · "), href: e.loanId ? "/plan/prestamos" : e.kind === "INCOME" ? "/plan/ingresos" : "/plan/gastos" }));
 const payments = (data.cardPayments ?? []).map((p) => ({ id: `payment-${p.id}`, name: "Pago de tarjeta", kind: "EXPENSE", amount: p.amount, currency: p.currency, date: todayIso(new Date(p.paidAt)), done: true, due: null, meta: [p.accountName, p.originFinanceName ? `Origen: ${p.originFinanceName}` : ""].filter(Boolean).join(" · "), href: "/plan/tarjetas" }));
 const legacy = data.statements.filter((s) => s.isPaid && !s.payments?.length).map((s) => ({ id: `statement-${s.id}`, name: "Pago de tarjeta", kind: "EXPENSE", amount: s.totalArs, currency: "ARS" as const, date: s.paidAt ? todayIso(new Date(s.paidAt)) : null, done: true, due: null, meta: "Pago anterior a Cuentas", href: "/plan/tarjetas" }));
 const normalized = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
 const matches = (e: { name: string; meta: string; kind: string }) => (kind === "all" || e.kind === kind) && normalized(`${e.name} ${e.meta}`).includes(normalized(query));
 const rows = [...entries, ...payments, ...legacy].filter((e) => e.done && matches(e)).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
 const overdueEntries = entries.filter((e) => !e.done && e.kind === "EXPENSE" && e.due && e.due < data.today && matches(e));
 const overdueCards = data.statements.filter((s) => !s.isPaid && s.dueDate && s.dueDate < data.today).map((s) => ({ id: s.id, name: data.cards.find((c) => c.id === s.cardId)?.name ?? "Tarjeta", amount: s.totalArs, currency: "ARS" as const, due: s.dueDate, href: "/plan/tarjetas", kind: "EXPENSE", meta: "Resumen" })).filter(matches);
 const overdue = [...overdueEntries, ...overdueCards].sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
 return <><PlanHeader title="Movimientos" period={data.period} /><div className="flex gap-2">{[["all", "Todas"], ["INCOME", "Ingresos"], ["EXPENSE", "Gastos"]].map(([id, label]) => <button key={id} className={`rounded-xl border px-4 py-2 ${kind === id ? "font-bold" : ""}`} aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>)}</div><input className="rounded-xl border bg-transparent p-3" aria-label="Buscar movimientos" placeholder="Buscar por nombre, categoría o cuenta" value={query} onChange={(e) => setQuery(e.target.value)} />
 {kind === "EXPENSE" && overdue.length ? <section className="rounded-xl border p-4 space-y-2" style={{ borderColor: "var(--accent-red)" }}><h2 className="font-bold">Pagos vencidos · falta pagar</h2>{overdue.map((e) => <Link href={`${e.href}?period=${data.period}`} key={e.id} className="block text-sm">{e.name} · {fmtMoney(e.amount, e.currency)} · venció el {e.due}</Link>)}</section> : null}
 {!rows.length ? <p>No hay movimientos realizados para este filtro.</p> : rows.map((e) => <Link key={e.id} className="block rounded-xl border p-3" href={`${e.href}?period=${data.period}`}><p className="font-semibold">{e.name} · {e.kind === "INCOME" ? "+" : ""}{fmtMoney(e.amount, e.currency)}</p><p className="text-xs">{e.date ?? "Sin fecha"} · {e.meta}</p></Link>)}
 </>;
}
