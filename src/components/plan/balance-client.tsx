"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import {
  addMonths, balanceAt, fmtArs, fmtMoney, loanBalanceItem, netWorth, numberToInput, parseMoney, periodLabel, periodShort,
  type BalanceItemDTO, type BalanceType, type Currency, type LoanDTO,
} from "@/lib/plan/core";
import {
  EmptyHint, ErrorText, Field, ListCard, MoneyInput, Pill, PlanHeader, PrimaryButton, SecondaryButton,
  SectionTitle, Segmented, Sheet, SmallAction, TextInput, api, cardStyle, useAction, withPeriod,
} from "./plan-ui";

type SheetState = { type: BalanceType; item?: BalanceItemDTO } | null;

const CURRENCIES: readonly { value: Currency; label: string }[] = [
  { value: "ARS", label: "Pesos" },
  { value: "USD", label: "Dólares" },
];

export function BalanceClient({ items: manualItems, loans, period, usdRate }: {
  items: BalanceItemDTO[];
  loans: LoanDTO[];
  period: string;
  usdRate: number;
}) {
  const [sheet, setSheet] = useState<SheetState>(null);

  // Préstamos y deudas: su saldo sale de las cuotas pagadas, no se carga a mano.
  const loanItems = loans.map(loanBalanceItem);
  const visibleLoans = loanItems.filter((i, idx) => {
    const value = balanceAt(i, period);
    return value != null && (!loans[idx].isClosed || value > 0.5);
  });
  const items = [...manualItems, ...loanItems];
  const active = manualItems.filter((i) => !i.isArchived);
  const now = netWorth(items, period, usdRate);
  const prevPeriod = addMonths(period, -1);
  const hasPrev = items.some((i) => !i.isArchived && balanceAt(i, prevPeriod) != null);
  const prev = netWorth(items, prevPeriod, usdRate);
  const delta = now.netArs - prev.netArs;

  const history = Array.from({ length: 6 }, (_, i) => addMonths(period, i - 5)).map((p) => ({
    period: p,
    net: netWorth(items, p, usdRate).netArs,
    hasData: items.some((i) => !i.isArchived && balanceAt(i, p) != null),
  }));
  const maxAbs = Math.max(...history.map((h) => Math.abs(h.net)), 1);

  function group(type: BalanceType, title: string, empty: string) {
    const list = active.filter((i) => i.type === type);
    const fromLoans = visibleLoans.filter((i) => i.type === type);
    return (
      <section className="space-y-2">
        <SectionTitle right={<SmallAction onClick={() => setSheet({ type })}><Plus size={12} /> Agregar</SmallAction>}>
          {title}
        </SectionTitle>
        {fromLoans.length > 0 && (
          <ListCard>
            {fromLoans.map((item) => {
              const value = balanceAt(item, period);
              return (
                <Link key={item.id} href={withPeriod("/plan/prestamos", period)} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Pill tone="accent">{type === "DEBT" ? "préstamo" : "me deben"}</Pill>
                      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>se actualiza con las cuotas</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--text-primary)" }}>
                    {value != null ? fmtMoney(value, item.currency) : "—"}
                  </p>
                  <ChevronRight size={14} style={{ color: "var(--border-strong)", flexShrink: 0 }} />
                </Link>
              );
            })}
          </ListCard>
        )}
        {list.length === 0 ? (fromLoans.length > 0 ? null : <EmptyHint>{empty}</EmptyHint>) : (
          <ListCard>
            {list.map((item) => {
              const value = balanceAt(item, period);
              const before = balanceAt(item, prevPeriod);
              const updated = item.values[period] != null;
              const change = value != null && before != null ? value - before : 0;
              // En deudas, bajar es bueno; en lo que tenés, subir es bueno.
              const good = type === "DEBT" ? change < 0 : change > 0;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSheet({ type, item })}
                  onKeyDown={(e) => e.key === "Enter" && setSheet({ type, item })}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {!updated && <Pill>sin actualizar este mes</Pill>}
                      {Math.abs(change) > 0.5 && (
                        <Pill tone={good ? "ok" : "over"}>
                          {change > 0 ? "subió" : "bajó"} {fmtMoney(Math.abs(change), item.currency)}
                        </Pill>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--text-primary)" }}>
                    {value != null ? fmtMoney(value, item.currency) : "—"}
                  </p>
                </div>
              );
            })}
          </ListCard>
        )}
      </section>
    );
  }

  return (
    <>
      <PlanHeader title="Patrimonio" period={period} backHref={withPeriod("/plan/mas", period)} />

      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="gradient-strip h-1 w-full" />
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
            Patrimonio neto
          </p>
          <p
            className="text-4xl font-bold tabular-nums mt-1"
            style={{ color: now.netArs < 0 ? "var(--accent-red)" : "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            {fmtArs(now.netArs)}
          </p>
          {hasPrev && Math.abs(delta) > 0.5 && (
            <p className="text-xs mt-1.5" style={{ color: delta > 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
              {delta > 0 ? "▲" : "▼"} {fmtArs(Math.abs(delta))} contra {periodLabel(prevPeriod)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-elevated)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Tenés</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--accent-green)" }}>{fmtArs(now.assetsArs)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-elevated)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Debés</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--accent-red)" }}>{fmtArs(now.debtsArs)}</p>
            </div>
          </div>
        </div>
      </div>

      {history.filter((h) => h.hasData).length > 1 && (
        <section className="space-y-2">
          <SectionTitle>Últimos 6 meses</SectionTitle>
          <div className="rounded-2xl p-4 space-y-2.5" style={cardStyle}>
            {history.map((h) => (
              <div key={h.period} className="flex items-center gap-3">
                <span className="text-xs w-14 flex-shrink-0 capitalize" style={{ color: "var(--text-secondary)" }}>{periodShort(h.period)}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-elevated)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(Math.abs(h.net) / maxAbs) * 100}%`,
                      backgroundColor: h.net < 0 ? "var(--accent-red)" : "var(--accent)",
                    }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums w-28 text-right flex-shrink-0" style={{ color: h.hasData ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  {h.hasData ? fmtArs(h.net) : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {group("ASSET", "Lo que tenés", "Ahorros, inversiones, dólares, fondo de emergencia.")}
      {group("DEBT", "Lo que debés", "Préstamos, saldo de tarjetas refinanciado, deudas con personas.")}

      <p className="text-[11px] text-center px-4" style={{ color: "var(--text-secondary)" }}>
        Actualizá los saldos una vez por mes. Si no tocás uno, se arrastra el último valor.
      </p>

      {sheet && <BalanceSheet type={sheet.type} item={sheet.item} period={period} onClose={() => setSheet(null)} />}
    </>
  );
}

function BalanceSheet({ type, item, period, onClose }: {
  type: BalanceType;
  item?: BalanceItemDTO;
  period: string;
  onClose: () => void;
}) {
  const action = useAction();
  const [name, setName] = useState(item?.name ?? "");
  const [currency, setCurrency] = useState<Currency>(item?.currency ?? "ARS");
  const [amount, setAmount] = useState(numberToInput(item ? balanceAt(item, period) : null));
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    const parsed = parseMoney(amount);
    if (!name.trim()) return action.setError("Ponele un nombre");
    if (!(parsed >= 0)) return action.setError("Ingresá el saldo (puede ser cero)");
    return action.run(
      () => item
        ? api("PATCH", `/api/plan/balance/${item.id}`, { name: name.trim(), period, amount: parsed })
        : api("POST", "/api/plan/balance", { type, name: name.trim(), currency, period, amount: parsed }),
      onClose,
    );
  }

  const noun = type === "ASSET" ? "Lo que tenés" : "Lo que debés";

  return (
    <Sheet title={item ? item.name : noun} onClose={onClose}>
      <Field label="Nombre">
        <TextInput
          aria-label="Nombre"
          placeholder={type === "ASSET" ? "Ej: Fondo de emergencia" : "Ej: Préstamo personal"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={!item}
        />
      </Field>
      <Field label={`Saldo a ${periodLabel(period)}`}>
        <div className="space-y-2">
          <MoneyInput value={amount} onChange={setAmount} currency={currency} large autoFocus={!!item} ariaLabel="Saldo" />
          {!item && <Segmented options={CURRENCIES} value={currency} onChange={setCurrency} />}
        </div>
      </Field>
      <ErrorText error={action.error} />
      <PrimaryButton onClick={save} busy={action.busy}>{item ? "Guardar saldo" : "Agregar"}</PrimaryButton>
      {item && !confirmDelete && (
        <button type="button" onClick={() => setConfirmDelete(true)} className="w-full text-xs font-semibold py-1" style={{ color: "var(--accent-red)" }}>
          Eliminar
        </button>
      )}
      {item && confirmDelete && (
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setConfirmDelete(false)}>Cancelar</SecondaryButton>
          <SecondaryButton
            tone="danger"
            disabled={action.busy}
            onClick={() => action.run(() => api("DELETE", `/api/plan/balance/${item.id}`), onClose)}
          >
            Sí, borrar con su historial
          </SecondaryButton>
        </div>
      )}
    </Sheet>
  );
}
