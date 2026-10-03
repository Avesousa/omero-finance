"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, CreditCard, HandCoins, Pencil, Repeat, ShoppingBag } from "lucide-react";
import {
  addDays, addMonths, buildSummary, cardLines, fmtArs, fmtMoney, numberToInput, parseMoney, periodLabel, toArs,
  type Currency, type Kind,
} from "@/lib/plan/core";
import type { PlanData } from "@/lib/plan/server";
import { BudgetRowView } from "./budget-rows";
import { EntrySheet } from "./entry-sheet";
import {
  ErrorText, Field, ListCard, MoneyInput, PlanHeader, PrimaryButton, SectionTitle, Sheet, Switch,
  api, cardStyle, useAction, withPeriod,
} from "./plan-ui";

export function MonthClient({ data }: { data: PlanData }) {
  return (
    <>
      <PlanHeader title="Mi mes" period={data.period} />
      {data.started ? <MonthSummary data={data} /> : <StartMonth data={data} />}
    </>
  );
}

// ─── Inicio de mes guiado ─────────────────────────────────────────────────────

function StartMonth({ data }: { data: PlanData }) {
  const action = useAction();
  const [rate, setRate] = useState(numberToInput(data.usdRate || null));
  const [rows, setRows] = useState(() =>
    data.proposal.map((p) => ({ ...p, include: true, text: numberToInput(p.amount) })),
  );
  const [loanRows, setLoanRows] = useState(() =>
    data.loanProposal.map((p) => ({ ...p, include: true, text: numberToInput(p.amount) })),
  );
  const [copyBudget, setCopyBudget] = useState(data.previousBudgets.length > 0);
  const [updateRules, setUpdateRules] = useState(true);

  const month = periodLabel(data.period);
  const isFirstTime = rows.length === 0 && loanRows.length === 0 && data.previousBudgets.length === 0;
  const edited = rows.some((r) => r.include && parseMoney(r.text) !== r.amount);
  const prevBudgetTotal = data.previousBudgets.reduce((s, b) => s + b.amount, 0);

  function setRow(id: string, patch: Partial<{ include: boolean; text: string }>) {
    setRows((list) => list.map((r) => (r.recurringId === id ? { ...r, ...patch } : r)));
  }

  function setLoanRow(id: string, patch: Partial<{ include: boolean; text: string }>) {
    setLoanRows((list) => list.map((r) => (r.loanId === id ? { ...r, ...patch } : r)));
  }

  const ars = (r: { text: string; currency: Currency }) => (parseMoney(r.text) || 0) * (r.currency === "USD" ? parseMoney(rate) || 0 : 1);

  function total(kind: Kind) {
    return rows.filter((r) => r.kind === kind && r.include).reduce((s, r) => s + ars(r), 0);
  }

  function start() {
    const included = rows.filter((r) => r.include);
    const includedLoans = loanRows.filter((r) => r.include);
    if (included.some((r) => !(parseMoney(r.text) >= 0))) {
      return action.setError("Revisá los montos: hay alguno vacío o inválido");
    }
    if (includedLoans.some((r) => !(parseMoney(r.text) > 0))) {
      return action.setError("Revisá las cuotas: hay alguna vacía o en cero");
    }
    return action.run(() => api("POST", "/api/plan/month", {
      period: data.period,
      usdRate: parseMoney(rate) || 0,
      entries: included.map((r) => ({ recurringId: r.recurringId, amount: parseMoney(r.text) })),
      loans: includedLoans.map((r) => ({ loanId: r.loanId, amount: parseMoney(r.text) })),
      budgets: copyBudget ? data.previousBudgets : [],
      updateRules: edited && updateRules,
    }));
  }

  function group(kind: Kind, title: string) {
    const list = rows.filter((r) => r.kind === kind);
    if (list.length === 0) return null;
    return (
      <section className="space-y-2">
        <SectionTitle right={<span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtArs(total(kind))}</span>}>
          {title}
        </SectionTitle>
        <ListCard>
          {list.map((r) => (
            <StartRow
              key={r.recurringId}
              row={{ ...r, detail: r.occurrences > 1 ? `${r.occurrences} × ${fmtMoney(r.unitAmount, r.currency)}` : null }}
              onChange={(patch) => setRow(r.recurringId, patch)}
            />
          ))}
        </ListCard>
      </section>
    );
  }

  function loanGroup() {
    if (loanRows.length === 0) return null;
    const net = loanRows
      .filter((r) => r.include)
      .reduce((s, r) => s + (r.kind === "INCOME" ? ars(r) : -ars(r)), 0);
    return (
      <section className="space-y-2">
        <SectionTitle right={<span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtArs(Math.abs(net))}</span>}>
          Cuotas de préstamos
        </SectionTitle>
        <ListCard>
          {loanRows.map((r) => (
            <StartRow
              key={r.loanId}
              row={{
                ...r,
                detail: [
                  r.kind === "INCOME" ? "a cobrar" : "a pagar",
                  r.number ? `cuota ${r.number}/${r.of}` : null,
                  r.interest ? `interés ${fmtMoney(r.interest, r.currency)}` : null,
                ].filter(Boolean).join(" · "),
              }}
              onChange={(patch) => setLoanRow(r.loanId, patch)}
            />
          ))}
        </ListCard>
        <p className="text-[11px] px-1" style={{ color: "var(--text-secondary)" }}>
          Te propongo la cuota del mes pasado. Cambiala si este mes es distinta.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="gradient-strip h-1 w-full" />
        <div className="px-5 py-4 space-y-1">
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Empecemos {month}
          </p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {isFirstTime
              ? "Es tu primer mes acá. Inicialo y cargá de a poco: primero lo que entra, después lo fijo."
              : "Traje tus fijos y tu presupuesto anterior. Cambiá solo lo que sea distinto este mes."}
          </p>
        </div>
      </div>

      {group("INCOME", "Ingresos fijos")}
      {group("EXPENSE", "Gastos fijos")}
      {loanGroup()}

      {data.previousBudgets.length > 0 && (
        <div className="rounded-2xl p-4" style={cardStyle}>
          <Switch
            checked={copyBudget}
            onChange={setCopyBudget}
            label={`Copiar el presupuesto de ${periodLabel(data.previousBudgetPeriod!)} (${fmtArs(prevBudgetTotal)})`}
          />
        </div>
      )}

      <div className="rounded-2xl p-4 space-y-3" style={cardStyle}>
        <Field label="Dólar del mes" hint="Se usa para pasar a pesos lo que cargues en dólares. Lo podés cambiar después.">
          <MoneyInput value={rate} onChange={setRate} ariaLabel="Dólar del mes" />
        </Field>
        {edited && (
          <Switch
            checked={updateRules}
            onChange={setUpdateRules}
            label="Guardar los montos que cambié como base para los próximos meses"
          />
        )}
      </div>

      <ErrorText error={action.error} />
      <PrimaryButton onClick={start} busy={action.busy}>Iniciar {month}</PrimaryButton>
    </>
  );
}

function StartRow({ row, onChange }: {
  row: { name: string; currency: Currency; include: boolean; text: string; detail: string | null };
  onChange: (patch: Partial<{ include: boolean; text: string }>) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <input
        type="checkbox"
        aria-label={`Incluir ${row.name}`}
        checked={row.include}
        onChange={(e) => onChange({ include: e.target.checked })}
        className="w-4 h-4 flex-shrink-0"
        style={{ accentColor: "var(--accent)" }}
      />
      <div className="flex-1 min-w-0" style={{ opacity: row.include ? 1 : 0.45 }}>
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{row.name}</p>
        {row.detail && (
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{row.detail}</p>
        )}
      </div>
      <div className="w-36 flex-shrink-0" style={{ opacity: row.include ? 1 : 0.45 }}>
        <MoneyInput
          value={row.text}
          onChange={(text) => onChange({ text })}
          currency={row.currency}
          ariaLabel={`Monto de ${row.name}`}
        />
      </div>
    </div>
  );
}

// ─── Resumen del mes ──────────────────────────────────────────────────────────

function MonthSummary({ data }: { data: PlanData }) {
  const [sheet, setSheet] = useState<Kind | null>(null);
  const [editRate, setEditRate] = useState(false);

  const summary = useMemo(() => buildSummary(data), [data]);
  const lines = useMemo(
    () => cardLines(data.cards, data.statements, data.purchases, data.period, data.usdRate),
    [data],
  );

  const negative = summary.availableArs < 0;
  const hasBudget = data.budgets.length > 0;
  const href = (path: string) => withPeriod(path, data.period);

  // ── Cosas para mirar ──
  const notices: { key: string; tone: string; text: React.ReactNode; href: string }[] = [];
  for (const r of summary.overRows) {
    notices.push({
      key: `over-${r.categoryId}`,
      tone: "var(--accent-red)",
      href: href("/plan/presupuesto"),
      text: <><strong>{r.name}</strong>: gastaste {fmtArs(r.actual)} y el presupuesto es {fmtArs(r.budget)}. Te pasaste {fmtArs(-r.remaining)}.</>,
    });
  }
  if (hasBudget && summary.unassignedArs < -0.5) {
    notices.push({
      key: "overbudget",
      tone: "var(--accent-red)",
      href: href("/plan/presupuesto"),
      text: <>Presupuestaste {fmtArs(-summary.unassignedArs)} más de lo que entra este mes.</>,
    });
  }
  const soon = addDays(data.today, 7);
  for (const l of lines) {
    const st = l.statement;
    if (st && !st.isPaid && st.dueDate && st.dueDate <= soon) {
      const [, m, d] = st.dueDate.split("-");
      notices.push({
        key: `due-${st.id}`,
        tone: "var(--accent-amber)",
        href: href("/plan/tarjetas"),
        text: <><strong>{l.cardName}</strong> {st.dueDate < data.today ? "venció" : "vence"} el {Number(d)}/{Number(m)}: {fmtArs(l.toPayArs)}.</>,
      });
    }
  }
  for (const e of data.entries) {
    if (!e.loanId || e.isDone || !e.date || e.date > soon) continue;
    const [, m, d] = e.date.split("-");
    const income = e.kind === "INCOME";
    notices.push({
      key: `loan-${e.id}`,
      tone: income ? "var(--accent-green)" : "var(--accent-amber)",
      href: href("/plan/prestamos"),
      text: <>
        {income ? "Cobro de " : "Cuota de "}<strong>{e.name}</strong> {e.date < data.today ? "venció" : "vence"} el {Number(d)}/{Number(m)}:{" "}
        {fmtArs(toArs(e.amount, e.currency, data.usdRate))}.
      </>,
    });
  }
  const fixedPending = summary.fixedArs - summary.fixedPaidArs;

  const breakdown = [
    { label: "Ingresos", value: summary.incomeArs, sign: "+", icon: ArrowDownLeft, href: href("/plan/ingresos"), tone: "var(--accent-green)" },
    { label: "Gastos fijos", value: summary.fixedArs, sign: "−", icon: Repeat, href: href("/plan/gastos"), tone: "var(--text-secondary)" },
    { label: "Gastos del mes", value: summary.variableArs, sign: "−", icon: ShoppingBag, href: href("/plan/gastos"), tone: "var(--text-secondary)" },
    ...(summary.loansArs > 0
      ? [{ label: "Préstamos y deudas", value: summary.loansArs, sign: "−", icon: HandCoins, href: href("/plan/prestamos"), tone: "var(--text-secondary)" }]
      : []),
    { label: summary.cardsHasEstimate ? "Tarjetas (estimado)" : "Tarjetas", value: summary.cardsArs, sign: "−", icon: CreditCard, href: href("/plan/tarjetas"), tone: "var(--text-secondary)" },
  ];

  return (
    <>
      {/* Disponible */}
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="gradient-strip h-1 w-full" />
        <div className="px-5 pt-4 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
            Disponible este mes
          </p>
          <p
            className="text-4xl font-bold tabular-nums mt-1"
            style={{ color: negative ? "var(--accent-red)" : "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            {fmtArs(summary.availableArs)}
          </p>
          <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>
            {negative
              ? "Este mes sale más de lo que entra. Mirá qué se puede mover."
              : `Lo que queda después de fijos, gastos${summary.loansArs > 0 ? ", préstamos" : ""} y tarjetas.`}
          </p>
        </div>
        <div className="border-t divide-y" style={{ borderColor: "var(--border)" }}>
          {breakdown.map(({ label, value, sign, icon: Icon, href: to, tone }) => (
            <Link key={label} href={to} className="flex items-center gap-3 px-5 py-2.5" style={{ borderColor: "var(--border)" }}>
              <Icon size={15} style={{ color: tone, flexShrink: 0 }} />
              <span className="flex-1 text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {sign} {fmtArs(value)}
              </span>
              <ChevronRight size={14} style={{ color: "var(--border-strong)" }} />
            </Link>
          ))}
        </div>
      </div>

      {/* Carga rápida */}
      <div className="grid grid-cols-2 gap-3">
        <QuickButton onClick={() => setSheet("EXPENSE")} icon={ArrowUpRight} label="Cargar gasto" />
        <QuickButton onClick={() => setSheet("INCOME")} icon={ArrowDownLeft} label="Cargar ingreso" />
      </div>

      {/* Para mirar */}
      {(notices.length > 0 || fixedPending > 0.5) && (
        <section className="space-y-2">
          <SectionTitle>Para mirar</SectionTitle>
          <ListCard>
            {notices.map((n) => (
              <Link key={n.key} href={n.href} className="flex items-start gap-3 px-4 py-3">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: n.tone }} />
                <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{n.text}</span>
              </Link>
            ))}
            {fixedPending > 0.5 && (
              <Link href={href("/plan/gastos")} className="flex items-start gap-3 px-4 py-3">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: "var(--text-secondary)" }} />
                <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>
                  Te falta pagar {fmtArs(fixedPending)} de gastos fijos.
                </span>
              </Link>
            )}
          </ListCard>
        </section>
      )}

      {/* Presupuesto vs gasto */}
      <section className="space-y-2">
        <SectionTitle
          right={
            <Link href={href("/plan/presupuesto")} className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
              {hasBudget ? "Editar" : "Armar"}
            </Link>
          }
        >
          Presupuesto
        </SectionTitle>
        {!hasBudget && summary.rows.length === 0 ? (
          <Link
            href={href("/plan/presupuesto")}
            className="block rounded-2xl px-4 py-5 text-sm text-center"
            style={{ border: "1px dashed var(--border-strong)", color: "var(--text-secondary)" }}
          >
            Todavía no armaste el presupuesto de {periodLabel(data.period)}.{" "}
            <span style={{ color: "var(--accent)" }}>Armarlo ahora</span>
          </Link>
        ) : (
          <>
            {hasBudget && (
              <div className="flex justify-between text-xs px-1" style={{ color: "var(--text-secondary)" }}>
                <span>Presupuestado <strong className="tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtArs(summary.budgetTotalArs)}</strong></span>
                {summary.unassignedArs > 0.5 && (
                  <span>Sin destino <strong className="tabular-nums" style={{ color: "var(--accent-green)" }}>{fmtArs(summary.unassignedArs)}</strong></span>
                )}
              </div>
            )}
            <ListCard>
              {summary.rows.map((r) => <BudgetRowView key={r.categoryId ?? "none"} row={r} />)}
            </ListCard>
          </>
        )}
      </section>

      {/* Dólar */}
      <button
        type="button"
        onClick={() => setEditRate(true)}
        className="flex items-center justify-between px-4 py-3 rounded-2xl text-left"
        style={cardStyle}
      >
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Dólar de {periodLabel(data.period)}</span>
        <span className="flex items-center gap-2 text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {data.usdRate > 0 ? fmtArs(data.usdRate) : "Sin cargar"}
          <Pencil size={12} style={{ color: "var(--text-secondary)" }} />
        </span>
      </button>

      <p className="text-[11px] text-center px-4" style={{ color: "var(--text-secondary)" }}>
        Próximo mes: {periodLabel(addMonths(data.period, 1))} se inicia con estos mismos fijos y presupuesto.
      </p>

      {sheet && (
        <EntrySheet kind={sheet} period={data.period} categories={data.categories} onClose={() => setSheet(null)} />
      )}
      {editRate && <RateSheet period={data.period} usdRate={data.usdRate} onClose={() => setEditRate(false)} />}
    </>
  );
}

function QuickButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold"
      style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function RateSheet({ period, usdRate, onClose }: { period: string; usdRate: number; onClose: () => void }) {
  const action = useAction();
  const [rate, setRate] = useState(numberToInput(usdRate || null));

  function save() {
    const parsed = parseMoney(rate);
    if (!(parsed > 0)) return action.setError("Ingresá un valor mayor a cero");
    return action.run(() => api("PATCH", "/api/plan/month", { period, usdRate: parsed }), onClose);
  }

  return (
    <Sheet title={`Dólar de ${periodLabel(period)}`} onClose={onClose}>
      <Field label="1 dólar =" hint="Todo lo cargado en dólares en este mes se pasa a pesos con este valor.">
        <MoneyInput value={rate} onChange={setRate} large autoFocus ariaLabel="Valor del dólar" />
      </Field>
      <ErrorText error={action.error} />
      <PrimaryButton onClick={save} busy={action.busy}>Guardar</PrimaryButton>
    </Sheet>
  );
}
