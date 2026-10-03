"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  FREQUENCY_UNIT, LOAN_MODE_LABEL, addMonths, fmtArs, fmtMoney, frenchInstallment, loanKind, loanPaymentLabel,
  loanState, monthDiff, monthlyRatePct, numberToInput, parseMoney, pastPaymentPlan, periodLabel, periodShort,
  proposeLoanPayment, round2, toArs,
  type CategoryDTO, type Currency, type EntryDTO, type Frequency, type LoanDTO, type LoanDirection, type LoanMode,
} from "@/lib/plan/core";
import type { PlanData } from "@/lib/plan/server";
import {
  Chips, DoneToggle, EmptyHint, ErrorText, Fab, Field, ListCard, MoneyInput, Pill, PlanHeader, PrimaryButton,
  ProgressBar, SecondaryButton, SectionTitle, Segmented, Sheet, Switch, TextInput, api, cardStyle, useAction, withPeriod,
} from "./plan-ui";

type SheetState =
  | { type: "loan"; loan?: LoanDTO; direction?: LoanDirection }
  | { type: "payment"; loan: LoanDTO; entry: EntryDTO }
  | { type: "past"; loan: LoanDTO }
  | null;

const DIRECTIONS: readonly { value: LoanDirection; label: string }[] = [
  { value: "OWE", label: "Debo" },
  { value: "OWED", label: "Me deben" },
];

const MODES: readonly { value: LoanMode; label: string }[] = [
  { value: "FIXED", label: "Cuota fija" },
  { value: "SCHEDULE", label: "Variables" },
  { value: "OPEN", label: "Sin cuotas" },
];

const CURRENCIES: readonly { value: Currency; label: string }[] = [
  { value: "ARS", label: "Pesos" },
  { value: "USD", label: "Dólares" },
];

const RATE_FREQUENCIES: readonly { value: Frequency; label: string }[] = [
  { value: "MONTHLY", label: "Mensual" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "DAILY", label: "Diario" },
];

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/** "3 % mensual", "0,1 % diario". */
function rateLabel(loan: Pick<LoanDTO, "interestRate" | "interestFrequency">): string | null {
  if (!loan.interestRate) return null;
  const pct = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 }).format(loan.interestRate);
  return `${pct} % ${FREQUENCY_UNIT[loan.interestFrequency ?? "MONTHLY"]}`;
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export function LoansClient({ data }: { data: PlanData }) {
  const [direction, setDirection] = useState<LoanDirection>("OWE");
  const [sheet, setSheet] = useState<SheetState>(null);

  const ars = (amount: number, currency: Currency) => toArs(amount, currency, data.usdRate);
  const active = data.loans.filter((l) => !l.isClosed);
  const totals = (dir: LoanDirection) => {
    const list = active.filter((l) => l.direction === dir);
    const balance = list.reduce((s, l) => s + ars(loanState(l).balance, l.currency), 0);
    const month = data.entries
      .filter((e) => e.loanId && list.some((l) => l.id === e.loanId))
      .reduce((s, e) => s + ars(e.amount, e.currency), 0);
    return { balance, month };
  };
  const owe = totals("OWE");
  const owed = totals("OWED");

  const list = data.loans.filter((l) => l.direction === direction);
  const open = list.filter((l) => !l.isClosed);
  const closed = list.filter((l) => l.isClosed);
  const entryOf = (loan: LoanDTO) => data.entries.find((e) => e.loanId === loan.id);

  return (
    <>
      <PlanHeader title="Préstamos y deudas" period={data.period} backHref={withPeriod("/plan/mas", data.period)} />

      <div className="grid grid-cols-2 gap-3">
        <TotalCard label="Debés" tone="var(--accent-red)" balance={owe.balance} month={owe.month} verb="a pagar" />
        <TotalCard label="Te deben" tone="var(--accent-green)" balance={owed.balance} month={owed.month} verb="a cobrar" />
      </div>

      <Segmented options={DIRECTIONS} value={direction} onChange={setDirection} />

      {open.length === 0 ? (
        <EmptyHint>
          {direction === "OWE"
            ? "Cargá un préstamo o una deuda: la cuota entra sola al presupuesto de cada mes."
            : "Cargá lo que te deben: cada cuota aparece en tus ingresos del mes."}
        </EmptyHint>
      ) : (
        <section className="space-y-3">
          {open.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              entry={entryOf(loan)}
              data={data}
              onEdit={() => setSheet({ type: "loan", loan })}
              onPayment={(entry) => setSheet({ type: "payment", loan, entry })}
              onPast={() => setSheet({ type: "past", loan })}
            />
          ))}
        </section>
      )}

      {!data.started && open.length > 0 && (
        <p className="text-[11px] text-center px-4" style={{ color: "var(--text-secondary)" }}>
          {periodLabel(data.period)} todavía no está iniciado: las cuotas aparecen cuando lo inicies.
        </p>
      )}

      {closed.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>Terminados</SectionTitle>
          <ListCard>
            {closed.map((loan) => (
              <button
                key={loan.id}
                type="button"
                onClick={() => setSheet({ type: "loan", loan })}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-secondary)" }}>{loan.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {direction === "OWE" ? "Pagado" : "Cobrado"} {fmtMoney(loanState(loan).totalPaid, loan.currency)}
                  </p>
                </div>
                <Pill tone="ok">{direction === "OWE" ? "saldado" : "cobrado"}</Pill>
              </button>
            ))}
          </ListCard>
        </section>
      )}

      <Fab onClick={() => setSheet({ type: "loan", direction })} label={direction === "OWE" ? "Agregar préstamo o deuda" : "Agregar algo que me deben"} />

      {sheet?.type === "loan" && (
        <LoanSheet
          key={sheet.loan?.id ?? "new"}
          loan={sheet.loan}
          direction={sheet.direction}
          period={data.period}
          categories={data.categories}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === "payment" && (
        <PaymentSheet loan={sheet.loan} entry={sheet.entry} onClose={() => setSheet(null)} />
      )}
      {sheet?.type === "past" && (
        <PastPaymentsSheet
          // Se toma el préstamo actualizado para que la hoja refleje lo recién cargado.
          loan={data.loans.find((l) => l.id === sheet.loan.id) ?? sheet.loan}
          period={data.period}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

function TotalCard({ label, tone, balance, month, verb }: {
  label: string;
  tone: string;
  balance: number;
  month: number;
  verb: string;
}) {
  return (
    <div className="rounded-2xl p-4" style={cardStyle}>
      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <p className="text-lg font-bold tabular-nums" style={{ color: balance > 0 ? tone : "var(--text-primary)" }}>{fmtArs(balance)}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
        {month > 0 ? <>Este mes {verb}: <strong className="tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtArs(month)}</strong></> : "Nada este mes"}
      </p>
    </div>
  );
}

function LoanCard({ loan, entry, data, onEdit, onPayment, onPast }: {
  loan: LoanDTO;
  entry: EntryDTO | undefined;
  data: PlanData;
  onEdit: () => void;
  onPayment: (entry: EntryDTO) => void;
  onPast: () => void;
}) {
  const action = useAction();
  const state = loanState(loan);
  const owe = loan.direction === "OWE";
  const of = loan.mode === "FIXED" ? loan.installments ?? 1 : loan.mode === "SCHEDULE" ? loan.schedule.length : null;
  const number = loanPaymentLabel(loan, data.period);
  const upcoming = !entry ? proposeLoanPayment(loan, data.period) : null;
  const meta = [loan.counterpart, LOAN_MODE_LABEL[loan.mode], rateLabel(loan)].filter(Boolean).join(" · ");
  // Cuotas que se pueden cargar como ya pagadas antes de la primera que conoce la app.
  const canAddPast = pastPaymentPlan(loan, 1, data.period).max > 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={cardStyle}>
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(e) => e.key === "Enter" && onEdit()}
        className="p-4 space-y-3 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{loan.name}</p>
            {meta && <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{meta}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtMoney(state.balance, loan.currency)}</p>
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{owe ? "falta pagar" : "falta cobrar"}</p>
          </div>
        </div>
        {of != null && (
          <div className="space-y-1">
            <ProgressBar value={state.paidCount} max={of} tone="var(--accent-green)" />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {state.paidCount} de {of} cuotas {owe ? "pagadas" : "cobradas"}
              </p>
              {canAddPast && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPast(); }}
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  Cargar cuotas ya {owe ? "pagadas" : "cobradas"}
                </button>
              )}
            </div>
          </div>
        )}
        {loan.mode === "OPEN" && loan.endDate && (
          <p className="text-[11px]" style={{ color: loan.endDate < data.today ? "var(--accent-red)" : "var(--text-secondary)" }}>
            Fecha límite: {shortDate(loan.endDate)}/{loan.endDate.slice(2, 4)}
          </p>
        )}
      </div>

      {entry ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onPayment(entry)}
          onKeyDown={(e) => e.key === "Enter" && onPayment(entry)}
          className="flex items-center gap-3 px-4 py-3 border-t cursor-pointer"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
        >
          <DoneToggle
            done={entry.isDone}
            label={`Marcar la cuota de ${loan.name} como ${owe ? "pagada" : "cobrada"}`}
            onToggle={() => action.run(() => api("PATCH", `/api/plan/entries/${entry.id}`, { isDone: !entry.isDone }))}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              {number ? `Cuota ${number}` : `Pago de ${periodShort(data.period)}`}
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {entry.isDone
                ? owe ? "Pagada" : "Cobrada"
                : entry.date ? `Vence el ${shortDate(entry.date)}` : "Sin fecha de vencimiento"}
              {entry.interestAmount ? ` · interés ${fmtMoney(entry.interestAmount, entry.currency)}` : ""}
            </p>
          </div>
          <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)", opacity: entry.isDone ? 0.6 : 1 }}>
            {fmtMoney(entry.amount, entry.currency)}
          </p>
        </div>
      ) : upcoming ? (
        <p className="px-4 py-3 border-t text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          {data.started ? "Sin cuota cargada este mes." : "Al iniciar el mes"} se propone {fmtMoney(upcoming.amount, loan.currency)}.
        </p>
      ) : null}
      {action.error && <p className="px-4 pb-3 text-xs" style={{ color: "var(--accent-red)" }}>{action.error}</p>}
    </div>
  );
}

// ─── Cuota del mes ────────────────────────────────────────────────────────────

/** Editar el monto de la cuota de este mes, marcarla pagada o quitarla. */
export function PaymentSheet({ loan, entry, onClose }: { loan: LoanDTO; entry: EntryDTO; onClose: () => void }) {
  const action = useAction();
  const owe = loan.direction === "OWE";
  const [amount, setAmount] = useState(numberToInput(entry.amount));
  const [date, setDate] = useState(entry.date ?? "");
  const [isDone, setIsDone] = useState(entry.isDone);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const number = loanPaymentLabel(loan, entry.period);

  function save() {
    const parsed = parseMoney(amount);
    if (!(parsed > 0)) return action.setError("Ingresá un monto mayor a cero");
    return action.run(
      () => api("PATCH", `/api/plan/entries/${entry.id}`, { amount: parsed, date: date || null, isDone }),
      onClose,
    );
  }

  return (
    <Sheet title={`${loan.name}${number ? ` · cuota ${number}` : ""}`} onClose={onClose}>
      <Field
        label={`Cuota de ${periodLabel(entry.period)}`}
        hint={loan.mode === "SCHEDULE"
          ? undefined
          : "El mes que viene se propone este mismo monto. Cambialo si la cuota es distinta."}
      >
        <MoneyInput value={amount} onChange={setAmount} currency={entry.currency} large autoFocus ariaLabel="Monto de la cuota" />
      </Field>
      {entry.interestAmount ? (
        <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
          Interés generado este mes: <strong className="tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtMoney(entry.interestAmount, entry.currency)}</strong>
          {rateLabel(loan) ? ` (${rateLabel(loan)})` : ""}
        </p>
      ) : null}
      <Field label="Vencimiento">
        <TextInput type="date" aria-label="Vencimiento" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--bg-elevated)" }}>
        <DoneToggle done={isDone} label={owe ? "Pagada" : "Cobrada"} onToggle={() => setIsDone(!isDone)} />
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>{owe ? "Ya la pagué" : "Ya la cobré"}</span>
      </div>
      {!owe && (
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {isDone
            ? "Cuenta como ingreso del mes y suma al disponible."
            : "Mientras no la cobres no suma al disponible: figura aparte como \"por cobrar\"."}
        </p>
      )}
      <ErrorText error={action.error} />
      <PrimaryButton onClick={save} busy={action.busy}>Guardar</PrimaryButton>
      {!confirmDelete ? (
        <button type="button" onClick={() => setConfirmDelete(true)} className="w-full text-xs font-semibold py-1" style={{ color: "var(--accent-red)" }}>
          Quitar la cuota de este mes
        </button>
      ) : (
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setConfirmDelete(false)}>Cancelar</SecondaryButton>
          <SecondaryButton
            tone="danger"
            disabled={action.busy}
            onClick={() => action.run(() => api("DELETE", `/api/plan/entries/${entry.id}`), onClose)}
          >
            Sí, quitar
          </SecondaryButton>
        </div>
      )}
    </Sheet>
  );
}

// ─── Cuotas anteriores ────────────────────────────────────────────────────────

/**
 * Cargar cuotas que ya estaban saldadas antes de que la app conociera el préstamo.
 * Quedan como pagadas en sus meses: corrigen el número de cuota y el saldo sin tocar este mes.
 */
export function PastPaymentsSheet({ loan, period, onClose }: { loan: LoanDTO; period: string; onClose: () => void }) {
  const action = useAction();
  const owe = loan.direction === "OWE";
  const done = owe ? "pagadas" : "cobradas";
  const state = loanState(loan);
  const base = pastPaymentPlan(loan, 0, period);
  const isSchedule = loan.mode === "SCHEDULE";
  const of = isSchedule ? loan.schedule.length : Math.max(1, loan.installments ?? 1);

  // Si la primera cuota del préstamo es anterior a la primera cargada, se sugiere completar ese hueco.
  const gap = monthDiff(loan.startPeriod, base.anchor);
  const [countText, setCountText] = useState(String(isSchedule ? base.max : Math.min(base.max, gap > 0 ? gap : 1)));
  const defaultAmount = loan.payments[0]?.amount ?? loan.installmentAmount ??
    frenchInstallment(loan.principal, monthlyRatePct(loan, loan.startPeriod), of);
  const [amount, setAmount] = useState(numberToInput(defaultAmount));

  const count = isSchedule ? base.max : Math.max(0, Math.floor(Number(countText)) || 0);
  const plan = pastPaymentPlan(loan, count, period);
  const parsedAmount = parseMoney(amount);
  const oldest = loan.payments[0];
  const canRemove = !!oldest && oldest.isDone && oldest.period < period;

  function save() {
    if (!(count >= 1)) return action.setError("Poné cuántas cuotas");
    if (count > base.max) return action.setError(`Como mucho podés cargar ${base.max} ${base.max === 1 ? "cuota" : "cuotas"} más`);
    if (!isSchedule && !(parsedAmount > 0)) return action.setError("Ingresá el monto de cada cuota");
    return action.run(
      () => api("POST", `/api/plan/loans/${loan.id}/past-payments`, {
        count, before: period, ...(isSchedule ? {} : { amount: parsedAmount }),
      }),
      onClose,
    );
  }

  return (
    <Sheet title={`Cuotas ya ${done}`} onClose={onClose}>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        <strong style={{ color: "var(--text-primary)" }}>{loan.name}</strong>: hoy figuran {state.paidCount} de {of} cuotas {done}.
        Cargá acá las que ya estaban saldadas antes de {periodLabel(base.anchor)}: bajan el saldo y corrigen el
        número de cuota, sin tocar el disponible de este mes.
      </p>

      {base.max === 0 ? (
        <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
          No quedan cuotas anteriores para cargar.
        </p>
      ) : isSchedule ? (
        <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)" }}>
          {base.max === 1 ? "Hay 1 cuota" : `Hay ${base.max} cuotas`} del cronograma anteriores a {periodLabel(base.anchor)}{" "}
          ({plan.periods.map(periodShort).join(", ")}). Se van a marcar como {done} con el monto de cada una.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="¿Cuántas cuotas?">
              <TextInput
                type="number"
                inputMode="numeric"
                min={1}
                max={base.max}
                aria-label="Cantidad de cuotas anteriores"
                value={countText}
                onChange={(e) => setCountText(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Monto de cada una">
              <MoneyInput value={amount} onChange={setAmount} currency={loan.currency} ariaLabel="Monto de cada cuota anterior" />
            </Field>
          </div>
          {plan.periods.length > 0 && parsedAmount > 0 && (
            <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)" }}>
              {plan.periods.length === 1
                ? <>Se carga la de {periodLabel(plan.periods[0])}.</>
                : <>Se cargan de {periodLabel(plan.periods[0])} a {periodLabel(plan.periods[plan.periods.length - 1])}.</>}{" "}
              Vas a quedar con <strong>{state.paidCount + plan.periods.length} de {of}</strong> cuotas {done}
              {loan.interestRate
                ? " y el saldo se recalcula con el interés."
                : <> y un saldo de <strong>{fmtMoney(Math.max(0, round2(state.balance - plan.periods.length * parsedAmount)), loan.currency)}</strong>.</>}
            </p>
          )}
        </>
      )}

      <ErrorText error={action.error} />
      {base.max > 0 && (
        <PrimaryButton onClick={save} busy={action.busy}>
          {count === 1 ? "Cargar 1 cuota" : `Cargar ${count} cuotas`}
        </PrimaryButton>
      )}
      {canRemove && (
        <button
          type="button"
          disabled={action.busy}
          onClick={() => action.run(() => api("DELETE", `/api/plan/loans/${loan.id}/past-payments`))}
          className="w-full text-xs font-semibold py-1 disabled:opacity-50"
          style={{ color: "var(--accent-red)" }}
        >
          Quitar la cuota de {periodLabel(oldest.period)} (la más antigua)
        </button>
      )}
    </Sheet>
  );
}

// ─── Alta y edición ───────────────────────────────────────────────────────────

interface ScheduleRow { key: number; period: string; amount: string }

export function LoanSheet({ loan, direction: initialDirection, period, categories, onClose }: {
  loan?: LoanDTO;
  direction?: LoanDirection;
  period: string;
  categories: CategoryDTO[];
  onClose: () => void;
}) {
  const action = useAction();
  const isEdit = !!loan;
  const startLocked = isEdit && loan.payments.length > 0;

  const [direction, setDirection] = useState<LoanDirection>(loan?.direction ?? initialDirection ?? "OWE");
  const [mode, setMode] = useState<LoanMode>(loan?.mode ?? "FIXED");
  const [name, setName] = useState(loan?.name ?? "");
  const [counterpart, setCounterpart] = useState(loan?.counterpart ?? "");
  const [currency, setCurrency] = useState<Currency>(loan?.currency ?? "ARS");
  const [principal, setPrincipal] = useState(numberToInput(loan && loan.mode !== "SCHEDULE" ? loan.principal : null));
  const [installments, setInstallments] = useState(String(loan?.installments ?? 12));
  const [installmentAmount, setInstallmentAmount] = useState(numberToInput(loan?.installmentAmount));
  const [hasRate, setHasRate] = useState(!!loan?.interestRate);
  const [rate, setRate] = useState(loan?.interestRate ? String(loan.interestRate).replace(".", ",") : "");
  const [rateFrequency, setRateFrequency] = useState<Frequency>(loan?.interestFrequency ?? "MONTHLY");
  const [startPeriod, setStartPeriod] = useState(loan?.startPeriod ?? period);
  const [dueDay, setDueDay] = useState(loan?.dueDay ? String(loan.dueDay) : "");
  const [endDate, setEndDate] = useState(loan?.endDate ?? "");
  const [categoryId, setCategoryId] = useState<string | null | undefined>(loan ? loan.categoryId : undefined);
  const [schedule, setSchedule] = useState<ScheduleRow[]>(() =>
    loan?.schedule.length
      ? loan.schedule.map((s, i) => ({ key: i, period: s.period, amount: numberToInput(s.amount) }))
      : [{ key: 0, period, amount: "" }],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Cuotas que ya venía pagando: null = todavía no lo tocó (se sugiere según la primera cuota).
  const [paidBeforeText, setPaidBeforeText] = useState<string | null>(null);
  const [pastScheduleDone, setPastScheduleDone] = useState(true);

  const owe = direction === "OWE";
  const kind = loanKind(direction);
  const ownCategories = categories.filter((c) => c.kind === kind && !c.systemKey && (!c.isArchived || c.id === categoryId));
  const defaultCategory = ownCategories.find((c) => c.name === (owe ? "Deudas y préstamos" : "Cobro de deudas"));
  const selectedCategory = categoryId === undefined ? defaultCategory?.id ?? null : categoryId;

  const parsedRate = hasRate ? parseMoney(rate) : 0;
  const monthlyPct = monthlyRatePct({ interestRate: parsedRate || null, interestFrequency: rateFrequency }, startPeriod);
  const parsedPrincipal = parseMoney(principal);
  const count = Math.max(1, Math.floor(Number(installments)) || 1);
  const suggested = parsedPrincipal > 0 ? frenchInstallment(parsedPrincipal, monthlyPct, count) : null;
  const scheduleTotal = round2(schedule.reduce((s, r) => s + (parseMoney(r.amount) || 0), 0));

  // Las cuotas anteriores se cargan como pagadas en los meses previos a este.
  const pastAnchor = startPeriod > period ? startPeriod : period;
  const suggestedPaidBefore = startPeriod < period ? String(Math.min(monthDiff(startPeriod, period), count)) : "";
  const paidBefore = Math.max(0, Math.floor(Number(paidBeforeText ?? suggestedPaidBefore)) || 0);
  const pastScheduleRows = schedule.filter((r) => r.amount.trim() !== "" && r.period < period).length;

  function addScheduleRow() {
    setSchedule((rows) => {
      const last = rows[rows.length - 1];
      return [...rows, {
        key: Math.max(...rows.map((r) => r.key), 0) + 1,
        period: last ? addMonths(last.period, 1) : period,
        amount: last?.amount ?? "",
      }];
    });
  }

  function save() {
    if (!name.trim()) return action.setError("Ponele un nombre");
    if (hasRate && !(parsedRate > 0)) return action.setError("Ingresá el % de interés o desactivalo");
    const day = dueDay.trim() === "" ? null : Number(dueDay);
    if (day != null && !(Number.isInteger(day) && day >= 1 && day <= 31)) return action.setError("El día de vencimiento va de 1 a 31");

    const body: Record<string, unknown> = {
      direction, mode, name: name.trim(), counterpart: counterpart.trim() || null, currency,
      categoryId: selectedCategory,
      interestRate: hasRate ? parsedRate : null,
      interestFrequency: hasRate ? rateFrequency : null,
      startPeriod, dueDay: day,
    };

    if (mode === "FIXED") {
      if (!(parsedPrincipal > 0)) return action.setError(owe ? "Ingresá cuánto te prestaron" : "Ingresá cuánto prestaste");
      if (!(count >= 1 && count <= 360)) return action.setError("Las cuotas van de 1 a 360");
      const custom = parseMoney(installmentAmount);
      Object.assign(body, { principal: parsedPrincipal, installments: count, installmentAmount: custom > 0 ? custom : null });
      if (!isEdit && paidBefore > 0) {
        if (paidBefore > count) return action.setError("No podés haber pagado más cuotas que las que tiene el préstamo");
        Object.assign(body, { paidBefore, before: pastAnchor });
      }
    } else if (mode === "OPEN") {
      if (!(parsedPrincipal > 0)) return action.setError("Ingresá el saldo");
      const pay = parseMoney(installmentAmount);
      if (!(pay > 0)) return action.setError(owe ? "Ingresá cuánto pensás pagar por mes" : "Ingresá cuánto esperás cobrar por mes");
      Object.assign(body, { principal: parsedPrincipal, installmentAmount: pay, endDate: endDate || null });
    } else {
      const rows = schedule.filter((r) => r.amount.trim() !== "");
      if (rows.length === 0) return action.setError("Cargá al menos una cuota");
      if (rows.some((r) => !/^\d{4}-\d{2}$/.test(r.period) || !(parseMoney(r.amount) > 0))) {
        return action.setError("Revisá las cuotas: cada una necesita mes y monto");
      }
      if (new Set(rows.map((r) => r.period)).size !== rows.length) return action.setError("Hay dos cuotas en el mismo mes");
      const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
      Object.assign(body, {
        schedule: sorted.map((r) => ({ period: r.period, amount: parseMoney(r.amount) })),
        startPeriod: startLocked ? startPeriod : sorted[0].period,
      });
      if (!isEdit && pastScheduleDone && pastScheduleRows > 0) Object.assign(body, { paidBefore: pastScheduleRows, before: period });
    }

    return action.run(
      () => isEdit ? api("PATCH", `/api/plan/loans/${loan.id}`, body) : api("POST", "/api/plan/loans", body),
      onClose,
    );
  }

  const title = isEdit ? loan.name : owe ? "Nuevo préstamo o deuda" : "Algo que me deben";
  const paidCount = loan ? loanState(loan).paidCount : 0;

  return (
    <Sheet title={title} onClose={onClose}>
      {!isEdit && (
        <>
          <Segmented options={DIRECTIONS} value={direction} onChange={(d) => { setDirection(d); setCategoryId(undefined); }} />
          <Field label="¿Cómo se paga?">
            <Segmented options={MODES} value={mode} onChange={setMode} />
          </Field>
        </>
      )}
      {isEdit && (
        <div className="flex flex-wrap gap-1.5">
          <Pill tone="accent">{owe ? "Debo" : "Me deben"}</Pill>
          <Pill>{LOAN_MODE_LABEL[mode]}</Pill>
          {loan.isClosed && <Pill tone="ok">Terminado</Pill>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre">
          <TextInput
            aria-label="Nombre"
            placeholder={owe ? "Ej: Préstamo auto" : "Ej: Préstamo a Juan"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!isEdit}
          />
        </Field>
        <Field label={owe ? "¿Con quién?" : "¿Quién te debe?"}>
          <TextInput
            aria-label="Con quién"
            placeholder={owe ? "Banco, persona…" : "Nombre"}
            maxLength={60}
            value={counterpart}
            onChange={(e) => setCounterpart(e.target.value)}
          />
        </Field>
      </div>

      {mode !== "SCHEDULE" && (
        <Field label={mode === "FIXED" ? (owe ? "¿Cuánto te prestaron?" : "¿Cuánto prestaste?") : "Saldo pendiente"}>
          <div className="space-y-2">
            <MoneyInput value={principal} onChange={setPrincipal} currency={currency} large ariaLabel="Monto" />
            {!isEdit && <Segmented options={CURRENCIES} value={currency} onChange={setCurrency} />}
          </div>
        </Field>
      )}
      {mode === "SCHEDULE" && !isEdit && (
        <Field label="Moneda">
          <Segmented options={CURRENCIES} value={currency} onChange={setCurrency} />
        </Field>
      )}

      {mode === "FIXED" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cuotas">
              <TextInput
                type="number"
                inputMode="numeric"
                min={1}
                max={360}
                aria-label="Cantidad de cuotas"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
              />
            </Field>
            <Field label="Primera cuota">
              <TextInput
                type="month"
                aria-label="Mes de la primera cuota"
                value={startPeriod}
                disabled={startLocked}
                onChange={(e) => e.target.value && setStartPeriod(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Cuota del primer mes"
            hint={suggested
              ? `Si la dejás vacía uso ${fmtMoney(suggested, currency)}${monthlyPct > 0 ? " (sistema francés)" : ""}. Los meses siguientes se propone la cuota del mes anterior, y la podés cambiar.`
              : "Los meses siguientes se propone la cuota del mes anterior, y la podés cambiar."}
          >
            <MoneyInput
              value={installmentAmount}
              onChange={setInstallmentAmount}
              currency={currency}
              placeholder={suggested ? numberToInput(suggested) : "0"}
              ariaLabel="Cuota del primer mes"
            />
          </Field>
          {!isEdit && (
            <Field
              label={owe ? "Cuotas que ya pagaste (opcional)" : "Cuotas que ya te pagaron (opcional)"}
              hint={paidBefore > 0
                ? `Las cargo como ${owe ? "pagadas" : "cobradas"} en los ${paidBefore === 1 ? "" : `${paidBefore} `}${paidBefore === 1 ? "mes anterior" : "meses anteriores"} a ${periodLabel(pastAnchor)}: bajan el saldo y la próxima cuota queda como la ${Math.min(paidBefore + 1, count)} de ${count}. No tocan el disponible de este mes.`
                : "Si el préstamo viene de antes, poné cuántas cuotas ya estaban saldadas para que el número de cuota y el saldo sean los reales."}
            >
              <TextInput
                type="number"
                inputMode="numeric"
                min={0}
                max={count}
                placeholder="0"
                aria-label="Cuotas ya pagadas"
                value={paidBeforeText ?? suggestedPaidBefore}
                onChange={(e) => setPaidBeforeText(e.target.value)}
              />
            </Field>
          )}
        </>
      )}

      {mode === "OPEN" && (
        <>
          <Field label={owe ? "¿Cuánto pensás pagar por mes?" : "¿Cuánto esperás cobrar por mes?"} hint="Cada mes se propone el monto del mes anterior. Lo cambiás cuando quieras.">
            <MoneyInput value={installmentAmount} onChange={setInstallmentAmount} currency={currency} ariaLabel="Pago por mes" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde">
              <TextInput
                type="month"
                aria-label="Primer mes"
                value={startPeriod}
                disabled={startLocked}
                onChange={(e) => e.target.value && setStartPeriod(e.target.value)}
              />
            </Field>
            <Field label="Fecha límite (opcional)">
              <TextInput type="date" aria-label="Fecha límite" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
        </>
      )}

      {mode === "SCHEDULE" && (
        <Field label="Cuotas" hint={`Total: ${fmtMoney(scheduleTotal, currency)} en ${schedule.length} ${schedule.length === 1 ? "cuota" : "cuotas"}`}>
          <div className="space-y-2">
            {schedule.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <TextInput
                  type="month"
                  aria-label="Mes de la cuota"
                  className="w-36 flex-shrink-0"
                  value={row.period}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) setSchedule((rows) => rows.map((r) => (r.key === row.key ? { ...r, period: value } : r)));
                  }}
                />
                <div className="flex-1 min-w-0">
                  <MoneyInput
                    value={row.amount}
                    onChange={(amount) => setSchedule((rows) => rows.map((r) => (r.key === row.key ? { ...r, amount } : r)))}
                    currency={currency}
                    ariaLabel={`Cuota de ${periodLabel(row.period)}`}
                  />
                </div>
                {schedule.length > 1 && (
                  <button
                    type="button"
                    aria-label="Quitar cuota"
                    onClick={() => setSchedule((rows) => rows.filter((r) => r.key !== row.key))}
                    className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addScheduleRow}
              className="flex items-center gap-1 text-xs font-semibold py-1"
              style={{ color: "var(--accent)" }}
            >
              <Plus size={13} /> Agregar cuota
            </button>
          </div>
        </Field>
      )}
      {mode === "SCHEDULE" && !isEdit && pastScheduleRows > 0 && (
        <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-elevated)" }}>
          <Switch
            checked={pastScheduleDone}
            onChange={setPastScheduleDone}
            label={`${pastScheduleRows === 1 ? "La cuota anterior" : `Las ${pastScheduleRows} cuotas anteriores`} a ${periodLabel(period)} ya ${pastScheduleRows === 1 ? "está" : "están"} ${owe ? (pastScheduleRows === 1 ? "pagada" : "pagadas") : (pastScheduleRows === 1 ? "cobrada" : "cobradas")}`}
          />
        </div>
      )}

      <Field label="Día de vencimiento (opcional)">
        <TextInput
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          placeholder="Ej: 10"
          aria-label="Día de vencimiento"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
        />
      </Field>

      <div className="space-y-2 rounded-xl p-3" style={{ backgroundColor: "var(--bg-elevated)" }}>
        <Segmented
          options={[{ value: "no", label: "Sin interés" }, { value: "yes", label: "Con interés" }]}
          value={hasRate ? "yes" : "no"}
          onChange={(v) => setHasRate(v === "yes")}
        />
        {hasRate && (
          <>
            <div className="relative">
              <TextInput
                inputMode="decimal"
                aria-label="Porcentaje de interés"
                placeholder="Ej: 3,5"
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^\d,]/g, ""))}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>%</span>
            </div>
            <Segmented options={RATE_FREQUENCIES} value={rateFrequency} onChange={setRateFrequency} />
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Al iniciar cada mes se calcula el interés sobre el saldo pendiente
              {monthlyPct > 0 && rateFrequency !== "MONTHLY"
                ? ` (en ${periodLabel(startPeriod)}: ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(monthlyPct)} %)`
                : ""}.
            </p>
          </>
        )}
      </div>

      <Field label="Categoría">
        <Chips options={ownCategories.map((c) => ({ id: c.id, label: c.name }))} value={selectedCategory} onChange={(id) => setCategoryId(id)} />
      </Field>

      {isEdit && paidCount > 0 && (
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {paidCount} {paidCount === 1 ? "cuota registrada" : "cuotas registradas"}. Los cambios valen para las cuotas que vienen.
        </p>
      )}

      <ErrorText error={action.error} />
      <PrimaryButton onClick={save} busy={action.busy}>{isEdit ? "Guardar cambios" : "Agregar"}</PrimaryButton>

      {isEdit && !confirmDelete && (
        <button type="button" onClick={() => setConfirmDelete(true)} className="w-full text-xs font-semibold py-1" style={{ color: "var(--accent-red)" }}>
          Eliminar
        </button>
      )}
      {isEdit && confirmDelete && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: loan.payments.length > 0 ? "var(--accent-red)" : "var(--text-secondary)" }}>
            {loan.payments.length > 0
              ? `Tiene ${loan.payments.length} ${loan.payments.length === 1 ? "cuota cargada" : "cuotas cargadas"} en tus meses. Se borran con él y no se puede deshacer.`
              : "Todavía no tiene cuotas cargadas."}
          </p>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setConfirmDelete(false)}>Cancelar</SecondaryButton>
            <SecondaryButton
              tone="danger"
              disabled={action.busy}
              onClick={() => action.run(() => api("DELETE", `/api/plan/loans/${loan.id}?confirm=1`), onClose)}
            >
              Sí, eliminar
            </SecondaryButton>
          </div>
        </div>
      )}
    </Sheet>
  );
}
