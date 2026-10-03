"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  FREQUENCY_LABEL, fmtArs, fmtMoney, isReceivable, loanPaymentLabel, toArs,
  type EntryDTO, type Kind, type LoanDTO,
} from "@/lib/plan/core";
import type { PlanData } from "@/lib/plan/server";
import { EntrySheet } from "./entry-sheet";
import { LoanSheet, PaymentSheet } from "./loans-client";
import {
  DoneToggle, EmptyHint, Fab, ListCard, NotStartedNotice, Pill, PlanHeader, SectionTitle,
  SmallAction, api, cardStyle, useAction,
} from "./plan-ui";

type SheetState =
  | { type: "entry"; entry?: EntryDTO; fixed?: boolean }
  | { type: "loan" }
  | { type: "payment"; loan: LoanDTO; entry: EntryDTO }
  | null;

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

export function EntriesClient({ data, kind }: { data: PlanData; kind: Kind }) {
  const isIncome = kind === "INCOME";
  const [sheet, setSheet] = useState<SheetState>(null);
  const toggle = useAction();

  const entries = data.entries.filter((e) => e.kind === kind);
  const fixed = entries.filter((e) => e.recurringId);
  const loanEntries = entries.filter((e) => e.loanId);
  const variable = entries.filter((e) => !e.recurringId && !e.loanId);

  const ars = (list: EntryDTO[]) => list.reduce((s, e) => s + toArs(e.amount, e.currency, data.usdRate), 0);
  // Lo que me deben y no cobré no cuenta como ingreso del mes: va aparte, como "por cobrar".
  const receivable = ars(entries.filter(isReceivable));
  const total = ars(entries) - receivable;
  // Los que se tildan como pagados / cobrados. En ingresos, las cuotas que me deben
  // ya se informan como "por cobrar", así que acá quedan solo los fijos.
  const tracked = isIncome ? fixed : [...fixed, ...loanEntries];
  const fixedPending = ars(tracked) - ars(tracked.filter((e) => e.isDone));

  const categoryName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? null;
  const ruleOf = (e: EntryDTO) => data.recurrings.find((r) => r.id === e.recurringId);
  const loanOf = (e: EntryDTO) => data.loans.find((l) => l.id === e.loanId);

  const words = isIncome
    ? { title: "Ingresos", fixed: "Ingresos fijos", variable: "Otros ingresos del mes", loans: "Me deben", done: "cobrado", pending: "Falta cobrar" }
    : { title: "Gastos", fixed: "Gastos fijos", variable: "Gastos del mes", loans: "Préstamos y deudas", done: "pagado", pending: "Falta pagar" };

  function open(e: EntryDTO) {
    const loan = loanOf(e);
    setSheet(loan ? { type: "payment", loan, entry: e } : { type: "entry", entry: e });
  }

  function row(e: EntryDTO) {
    const rule = ruleOf(e);
    const loan = loanOf(e);
    const meta = [
      loan ? loan.counterpart : categoryName(e.categoryId),
      e.recurringId ? null : loan ? (e.date ? `vence ${shortDate(e.date)}` : null) : shortDate(e.date),
    ].filter(Boolean).join(" · ");
    const target = categoryName(e.targetCategoryId);
    const number = loan ? loanPaymentLabel(loan, data.period) : null;
    const tracksDone = !!(e.recurringId || e.loanId);
    const waiting = isReceivable(e);

    return (
      <div
        key={e.id}
        role="button"
        tabIndex={0}
        onClick={() => open(e)}
        onKeyDown={(ev) => ev.key === "Enter" && open(e)}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
      >
        {tracksDone && (
          <DoneToggle
            done={e.isDone}
            label={`Marcar ${e.name} como ${words.done}`}
            onToggle={() => toggle.run(() => api("PATCH", `/api/plan/entries/${e.id}`, { isDone: !e.isDone }))}
          />
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: "var(--text-primary)", opacity: tracksDone && e.isDone ? 0.6 : 1 }}
          >
            {e.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {meta && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{meta}</span>}
            {rule && rule.frequency !== "MONTHLY" && <Pill>{FREQUENCY_LABEL[rule.frequency]}</Pill>}
            {number && <Pill>cuota {number}</Pill>}
            {waiting && <Pill tone="near">por cobrar · no suma</Pill>}
            {target && <Pill tone="accent">→ {target}</Pill>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p
            className="text-sm font-semibold tabular-nums"
            style={{ color: waiting ? "var(--text-secondary)" : "var(--text-primary)" }}
          >
            {fmtMoney(e.amount, e.currency)}
          </p>
          {e.currency === "USD" && data.usdRate > 0 && (
            <p className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
              ≈ {fmtArs(e.amount * data.usdRate)}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <PlanHeader title={words.title} period={data.period} />

      {!data.started ? (
        <NotStartedNotice period={data.period} />
      ) : (
        <>
          <div className="rounded-2xl p-4" style={cardStyle}>
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
              {isIncome ? "Ingresos del mes" : "Gastos del mes (sin tarjetas)"}
            </p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {fmtArs(total)}
            </p>
            {tracked.length > 0 && (
              <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>
                {fixedPending > 0.5
                  ? <>{words.pending}: <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtArs(fixedPending)}</span> de fijos</>
                  : <>Todos los fijos{!isIncome && loanEntries.length > 0 ? " y cuotas" : ""} ya están marcados como {words.done}s</>}
              </p>
            )}
            {receivable > 0.5 && (
              <p className="text-xs mt-1.5" style={{ color: "var(--accent-amber)" }}>
                Por cobrar: <span className="font-semibold tabular-nums">{fmtArs(receivable)}</span>. No suma al
                disponible hasta que lo marques como cobrado.
              </p>
            )}
          </div>

          <section className="space-y-2">
            <SectionTitle right={<SmallAction onClick={() => setSheet({ type: "entry", fixed: true })}><Plus size={12} /> Fijo</SmallAction>}>
              {words.fixed}
            </SectionTitle>
            {fixed.length === 0 ? (
              <EmptyHint>
                {isIncome
                  ? "Cargá tu sueldo u otros ingresos que se repiten. Los traigo solos cada mes."
                  : "Cargá alquiler, servicios y todo lo que se repite. Los traigo solos cada mes."}
              </EmptyHint>
            ) : (
              <ListCard>{fixed.map(row)}</ListCard>
            )}
          </section>

          <section className="space-y-2">
            <SectionTitle right={<SmallAction onClick={() => setSheet({ type: "loan" })}><Plus size={12} /> Agregar</SmallAction>}>
              {words.loans}
            </SectionTitle>
            {loanEntries.length === 0 ? (
              <EmptyHint>
                {isIncome
                  ? "Si alguien te devuelve plata en cuotas, cargalo acá y cada cuota entra sola."
                  : "Préstamos y deudas en cuotas: cargalos una vez y cada cuota entra sola al mes."}
              </EmptyHint>
            ) : (
              <ListCard>{loanEntries.map(row)}</ListCard>
            )}
          </section>

          <section className="space-y-2">
            <SectionTitle right={<SmallAction onClick={() => setSheet({ type: "entry" })}><Plus size={12} /> Agregar</SmallAction>}>
              {words.variable}
            </SectionTitle>
            {variable.length === 0 ? (
              <EmptyHint>
                {isIncome ? "Nada extra por ahora." : "Todavía no cargaste gastos este mes."}
              </EmptyHint>
            ) : (
              <ListCard>{variable.map(row)}</ListCard>
            )}
          </section>

          {toggle.error && (
            <p role="alert" className="text-xs text-center" style={{ color: "var(--accent-red)" }}>{toggle.error}</p>
          )}

          <Fab onClick={() => setSheet({ type: "entry" })} label={`Agregar ${isIncome ? "ingreso" : "gasto"}`} />
        </>
      )}

      {sheet?.type === "entry" && (
        <EntrySheet
          kind={kind}
          period={data.period}
          categories={data.categories}
          entry={sheet.entry}
          rule={sheet.entry ? ruleOf(sheet.entry) : undefined}
          defaultFixed={sheet.fixed}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === "loan" && (
        <LoanSheet
          direction={isIncome ? "OWED" : "OWE"}
          period={data.period}
          categories={data.categories}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === "payment" && (
        <PaymentSheet loan={sheet.loan} entry={sheet.entry} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
