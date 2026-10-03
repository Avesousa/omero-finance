"use client";

import { useState } from "react";
import { ChevronRight, Plus, Settings2 } from "lucide-react";
import { CardBrandIcon } from "@/components/tdc/card-brand";
import {
  addMonths, cardLabel, cardLines, cardSubtitle, cardTitle, fmtArs, fmtMoney, fmtUsd, installmentFor, numberToInput, parseMoney,
  periodLabel, periodShort, projectInstallments, round2, statementToPay, toArs,
  type CardDTO, type CardLine, type Currency, type PayMode, type PurchaseDTO, type StatementDTO,
} from "@/lib/plan/core";
import type { PlanData } from "@/lib/plan/server";
import {
  Chips, DoneToggle, EmptyHint, ErrorText, Fab, Field, ListCard, MoneyInput, Pill, PlanHeader,
  PrimaryButton, SecondaryButton, SectionTitle, Segmented, Sheet, SmallAction, TextInput,
  api, cardStyle, useAction,
} from "./plan-ui";

type Tab = "pay" | "purchases" | "future";
type SheetState =
  | { type: "statement"; cardId: string; statement: StatementDTO | null }
  | { type: "purchase"; purchase?: PurchaseDTO }
  | { type: "cards" }
  | { type: "card"; card?: CardDTO; fromList?: boolean }
  | null;

const TABS: readonly { value: Tab; label: string }[] = [
  { value: "pay", label: "A pagar" },
  { value: "purchases", label: "Compras" },
  { value: "future", label: "Cuotas a futuro" },
];

const PAY_MODES: readonly { value: PayMode; label: string }[] = [
  { value: "TOTAL", label: "El total" },
  { value: "MINIMUM", label: "El mínimo" },
  { value: "CUSTOM", label: "Otro monto" },
];

const CURRENCIES: readonly { value: Currency; label: string }[] = [
  { value: "ARS", label: "Pesos" },
  { value: "USD", label: "Dólares" },
];

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

export function CardsClient({ data }: { data: PlanData }) {
  const [tab, setTab] = useState<Tab>("pay");
  const [sheet, setSheet] = useState<SheetState>(null);

  const hasCards = data.cards.length > 0;
  const lines = cardLines(data.cards, data.statements, data.purchases, data.period, data.usdRate);
  const lineByCard = new Map(lines.map((l) => [l.cardId, l]));
  const total = lines.reduce((s, l) => s + l.toPayArs, 0);
  const paid = lines.filter((l) => l.isPaid).reduce((s, l) => s + l.toPayArs, 0);
  const cardById = (id: string) => data.cards.find((c) => c.id === id);
  const cardName = (id: string) => {
    const card = cardById(id);
    return card ? cardLabel(card) : "Tarjeta";
  };

  return (
    <>
      <PlanHeader title="Tarjetas" period={data.period} />

      {!hasCards ? (
        <div className="rounded-2xl p-5 space-y-3 text-center" style={cardStyle}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Todavía no hay tarjetas</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Agregá tus tarjetas una sola vez. Después cargás compras y resúmenes en segundos.
          </p>
          <PrimaryButton onClick={() => setSheet({ type: "card" })}>Agregar tarjeta</PrimaryButton>
        </div>
      ) : (
        <>
          <div className="rounded-2xl p-4" style={cardStyle}>
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
              Tarjetas en {periodLabel(data.period)}
            </p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtArs(total)}</p>
            <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>
              {lines.some((l) => l.isEstimate)
                ? "Incluye estimaciones por cuotas: cargá el resumen cuando llegue."
                : total > 0
                  ? `Pagado ${fmtArs(paid)} · falta ${fmtArs(total - paid)}`
                  : "Nada para pagar este mes."}
            </p>
          </div>

          <Segmented options={TABS} value={tab} onChange={setTab} />

          {tab === "pay" && (
            <section className="space-y-3">
              {data.cards.map((card) => (
                <StatementCard
                  key={card.id}
                  card={card}
                  line={lineByCard.get(card.id)}
                  usdRate={data.usdRate}
                  onEdit={(statement) => setSheet({ type: "statement", cardId: card.id, statement })}
                />
              ))}
              <button
                type="button"
                onClick={() => setSheet({ type: "cards" })}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-1 w-full"
                style={{ color: "var(--accent)" }}
              >
                <Settings2 size={13} /> Administrar tarjetas
              </button>
            </section>
          )}

          {tab === "purchases" && (
            <PurchasesTab data={data} cardName={cardName} onOpen={(purchase) => setSheet({ type: "purchase", purchase })} />
          )}

          {tab === "future" && <FutureTab data={data} />}

          {tab !== "future" && (
            <Fab onClick={() => setSheet({ type: "purchase" })} label="Agregar compra con tarjeta" />
          )}
        </>
      )}

      {sheet?.type === "statement" && (
        <StatementSheet
          period={data.period}
          cardId={sheet.cardId}
          card={cardById(sheet.cardId)}
          statement={sheet.statement}
          usdRate={data.usdRate}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === "purchase" && (
        <PurchaseSheet data={data} purchase={sheet.purchase} onClose={() => setSheet(null)} />
      )}
      {sheet?.type === "cards" && (
        <ManageCardsSheet
          cards={data.cards}
          onEdit={(card) => setSheet({ type: "card", card, fromList: true })}
          onAdd={() => setSheet({ type: "card", fromList: true })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === "card" && (
        <CardSheet
          key={sheet.card?.id ?? "new"}
          card={sheet.card}
          purchaseCount={sheet.card ? data.purchases.filter((p) => p.cardId === sheet.card!.id).length : 0}
          statementCount={sheet.card ? data.cardStatementCounts[sheet.card.id] ?? 0 : 0}
          onClose={() => setSheet(sheet.fromList ? { type: "cards" } : null)}
        />
      )}
    </>
  );
}

// ─── A pagar ──────────────────────────────────────────────────────────────────

/** Logo de la marca + banco + "Visa · Titular": lo que permite reconocer la tarjeta. */
function CardIdentity({ card, extra }: { card: CardDTO; extra?: string }) {
  const sub = cardSubtitle(card);
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-0">
      <CardBrandIcon name={card.name} cardType={card.cardType} size={26} showBank={false} />
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{cardTitle(card)}</p>
        {sub && <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{sub}</p>}
        {extra && <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>{extra}</p>}
      </div>
    </div>
  );
}

function StatementCard({ card, line, usdRate, onEdit }: {
  card: CardDTO;
  line: CardLine | undefined;
  usdRate: number;
  onEdit: (statement: StatementDTO | null) => void;
}) {
  const action = useAction();
  const st = line?.statement ?? null;

  if (!st) {
    return (
      <div className="rounded-2xl p-4 space-y-3" style={cardStyle}>
        <div className="flex items-center justify-between gap-3">
          <CardIdentity card={card} />
          <SmallAction onClick={() => onEdit(null)}><Plus size={12} /> Cargar resumen</SmallAction>
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {line && line.projectedArs > 0
            ? <>Sin resumen todavía. Por las cuotas cargadas, estimo <strong className="tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtArs(line.projectedArs)}</strong>.</>
            : "Sin resumen ni cuotas este mes."}
        </p>
      </div>
    );
  }

  const toPay = statementToPay(st, usdRate);
  const full = statementToPay({ ...st, payMode: "TOTAL" }, usdRate);
  const leftover = full - toPay;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ ...cardStyle, opacity: st.isPaid ? 0.75 : 1 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onEdit(st)}
        onKeyDown={(e) => e.key === "Enter" && onEdit(st)}
        className="p-4 space-y-3 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <DoneToggle
            done={st.isPaid}
            label={`Marcar ${cardLabel(card)} como pagada`}
            onToggle={() => action.run(() => api("PATCH", `/api/plan/card-statements/${st.id}`, { isPaid: !st.isPaid }))}
          />
          <CardIdentity
            card={card}
            extra={st.isPaid ? "Pagada" : st.dueDate ? `Vence el ${shortDate(st.dueDate)}` : "Sin fecha de vencimiento"}
          />
          <div className="text-right flex-shrink-0">
            <p className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtArs(toPay)}</p>
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
              {st.payMode === "TOTAL" ? "pago total" : st.payMode === "MINIMUM" ? "pago mínimo" : "monto elegido"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini label="Total" value={fmtArs(st.totalArs)} />
          <Mini label="Mínimo" value={st.minimumArs != null ? fmtArs(st.minimumArs) : "—"} />
          <Mini label="En dólares" value={st.usdAmount ? fmtUsd(st.usdAmount) : "—"} />
        </div>

        {leftover > 0.5 && (
          <p className="text-[11px]" style={{ color: "var(--accent-amber)" }}>
            Quedan {fmtArs(leftover)} sin pagar, que van a generar intereses.
          </p>
        )}
      </div>
      {action.error && <p className="px-4 pb-3 text-xs" style={{ color: "var(--accent-red)" }}>{action.error}</p>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl py-2 px-1" style={{ backgroundColor: "var(--bg-elevated)" }}>
      <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <p className="text-xs font-semibold tabular-nums truncate" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function StatementSheet({ period, cardId, card, statement, usdRate, onClose }: {
  period: string;
  cardId: string;
  card: CardDTO | undefined;
  statement: StatementDTO | null;
  usdRate: number;
  onClose: () => void;
}) {
  const action = useAction();
  const [total, setTotal] = useState(numberToInput(statement?.totalArs));
  const [minimum, setMinimum] = useState(numberToInput(statement?.minimumArs));
  const [usd, setUsd] = useState(numberToInput(statement?.usdAmount));
  const [dueDate, setDueDate] = useState(statement?.dueDate ?? "");
  const [payMode, setPayMode] = useState<PayMode>(statement?.payMode ?? "TOTAL");
  const [custom, setCustom] = useState(numberToInput(statement?.customAmount));

  const num = (text: string) => (text.trim() === "" ? null : parseMoney(text));
  const preview = statementToPay(
    { totalArs: num(total) ?? 0, minimumArs: num(minimum), usdAmount: num(usd), payMode, customAmount: num(custom) },
    usdRate,
  );

  function save() {
    const totalArs = num(total);
    if (totalArs == null || !(totalArs >= 0)) return action.setError("Ingresá el monto total del resumen");
    if (payMode === "MINIMUM" && num(minimum) == null) return action.setError("Cargá el pago mínimo para elegir esa opción");
    if (payMode === "CUSTOM" && !(Number(num(custom)) > 0)) return action.setError("Ingresá cuánto vas a pagar");
    return action.run(
      () => api("POST", "/api/plan/card-statements", {
        cardId, period, totalArs,
        minimumArs: num(minimum), usdAmount: num(usd), dueDate: dueDate || null,
        payMode, customAmount: payMode === "CUSTOM" ? num(custom) : null,
      }),
      onClose,
    );
  }

  return (
    <Sheet title={`Resumen de ${periodLabel(period)}`} onClose={onClose}>
      {card && (
        <div className="rounded-xl px-3 py-2.5 flex" style={{ backgroundColor: "var(--bg-elevated)" }}>
          <CardIdentity card={card} />
        </div>
      )}
      <Field label="Monto total en pesos">
        <MoneyInput value={total} onChange={setTotal} large autoFocus={!statement} ariaLabel="Monto total en pesos" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pago mínimo">
          <MoneyInput value={minimum} onChange={setMinimum} ariaLabel="Pago mínimo" />
        </Field>
        <Field label="Monto en dólares">
          <MoneyInput value={usd} onChange={setUsd} currency="USD" ariaLabel="Monto en dólares" />
        </Field>
      </div>
      <Field label="Fecha de vencimiento">
        <TextInput type="date" aria-label="Fecha de vencimiento" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
      <Field label="¿Cuánto vas a pagar?">
        <div className="space-y-2">
          <Segmented options={PAY_MODES} value={payMode} onChange={setPayMode} />
          {payMode === "CUSTOM" && <MoneyInput value={custom} onChange={setCustom} ariaLabel="Monto a pagar" />}
        </div>
      </Field>
      <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)" }}>
        Cuenta para el mes: <strong className="tabular-nums">{fmtArs(preview)}</strong>
        {num(usd) && payMode === "TOTAL" ? ` (incluye ${fmtUsd(num(usd)!)} a ${fmtArs(usdRate)})` : ""}
      </p>
      <ErrorText error={action.error} />
      <PrimaryButton onClick={save} busy={action.busy}>Guardar resumen</PrimaryButton>
      {statement && (
        <button
          type="button"
          onClick={() => action.run(() => api("DELETE", `/api/plan/card-statements/${statement.id}`), onClose)}
          className="w-full text-xs font-semibold py-1"
          style={{ color: "var(--accent-red)" }}
        >
          Quitar este resumen
        </button>
      )}
    </Sheet>
  );
}

// ─── Compras ──────────────────────────────────────────────────────────────────

function PurchasesTab({ data, cardName, onOpen }: {
  data: PlanData;
  cardName: (id: string) => string;
  onOpen: (p: PurchaseDTO) => void;
}) {
  const active = data.purchases.filter((p) => installmentFor(p, data.period));
  const others = data.purchases.filter((p) => !installmentFor(p, data.period));
  const categoryName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? null;

  function row(p: PurchaseDTO) {
    const inst = installmentFor(p, data.period);
    const last = addMonths(p.firstPeriod, p.installments - 1);
    const status = inst
      ? p.installments > 1 ? `cuota ${inst.number}/${inst.of}` : "1 pago"
      : p.firstPeriod > data.period ? `empieza en ${periodShort(p.firstPeriod)}` : `terminó en ${periodShort(last)}`;
    const meta = [cardName(p.cardId), categoryName(p.categoryId)].filter(Boolean).join(" · ");
    return (
      <div
        key={p.id}
        role="button"
        tabIndex={0}
        onClick={() => onOpen(p)}
        onKeyDown={(e) => e.key === "Enter" && onOpen(p)}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.description}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{meta}</span>
            <Pill tone={inst ? "accent" : "muted"}>{status}</Pill>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {fmtMoney(inst ? inst.amount : p.amount, p.currency)}
          </p>
          {p.installments > 1 && (
            <p className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
              total {fmtMoney(p.amount, p.currency)}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (data.purchases.length === 0) {
    return (
      <EmptyHint>
        Cargá una compra con tarjeta y sus cuotas: se reparten solas en los meses que siguen.
      </EmptyHint>
    );
  }

  return (
    <>
      <section className="space-y-2">
        <SectionTitle
          right={
            <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {fmtArs(active.reduce((s, p) => s + toArs(installmentFor(p, data.period)!.amount, p.currency, data.usdRate), 0))}
            </span>
          }
        >
          Cuotas de {periodLabel(data.period)}
        </SectionTitle>
        {active.length === 0
          ? <EmptyHint>Ninguna cuota cae en este mes.</EmptyHint>
          : <ListCard>{active.map(row)}</ListCard>}
      </section>
      {others.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>Otras compras</SectionTitle>
          <ListCard>{others.map(row)}</ListCard>
        </section>
      )}
    </>
  );
}

const INSTALLMENT_OPTIONS = ["1", "3", "6", "9", "12", "18", "24"].map((n) => ({ id: n, label: n }));

function PurchaseSheet({ data, purchase, onClose }: { data: PlanData; purchase?: PurchaseDTO; onClose: () => void }) {
  const action = useAction();
  const [cardId, setCardId] = useState<string | null>(purchase?.cardId ?? (data.cards.length === 1 ? data.cards[0].id : null));
  const [description, setDescription] = useState(purchase?.description ?? "");
  const [amount, setAmount] = useState(numberToInput(purchase?.amount));
  const [currency, setCurrency] = useState<Currency>(purchase?.currency ?? "ARS");
  const [installments, setInstallments] = useState(String(purchase?.installments ?? 1));
  const [firstPeriod, setFirstPeriod] = useState(purchase?.firstPeriod ?? data.period);
  const [categoryId, setCategoryId] = useState<string | null>(purchase?.categoryId ?? null);

  const parsed = parseMoney(amount);
  const count = Math.max(1, Math.floor(Number(installments)) || 1);
  const firstOptions = [data.period, addMonths(data.period, 1)];
  if (!firstOptions.includes(firstPeriod)) firstOptions.unshift(firstPeriod);

  const categories = data.categories.filter(
    (c) => c.kind === "EXPENSE" && !c.systemKey && (!c.isArchived || c.id === categoryId),
  );

  function save() {
    if (!cardId) return action.setError("Elegí la tarjeta");
    if (!description.trim()) return action.setError("Poné qué compraste");
    if (!(parsed > 0)) return action.setError("Ingresá el monto total");
    const body = { cardId, description: description.trim(), amount: parsed, currency, installments: count, firstPeriod, categoryId };
    return action.run(
      () => purchase
        ? api("PATCH", `/api/plan/card-purchases/${purchase.id}`, body)
        : api("POST", "/api/plan/card-purchases", body),
      onClose,
    );
  }

  return (
    <Sheet title={purchase ? "Editar compra" : "Compra con tarjeta"} onClose={onClose}>
      <Field label="Tarjeta">
        <Chips options={data.cards.map((c) => ({ id: c.id, label: cardLabel(c) }))} value={cardId} onChange={(id) => id && setCardId(id)} />
      </Field>
      <Field label="Monto total de la compra">
        <div className="space-y-2">
          <MoneyInput value={amount} onChange={setAmount} currency={currency} large autoFocus={!purchase} ariaLabel="Monto total" />
          <Segmented options={CURRENCIES} value={currency} onChange={setCurrency} />
        </div>
      </Field>
      <Field label="¿Qué compraste?">
        <TextInput aria-label="Descripción" placeholder="Ej: Heladera" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Cuotas">
        <div className="space-y-2">
          <Chips options={INSTALLMENT_OPTIONS} value={installments} onChange={(id) => id && setInstallments(id)} />
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            aria-label="Cantidad de cuotas"
            value={installments}
            onChange={(e) => setInstallments(e.target.value)}
          />
        </div>
      </Field>
      <Field label="La primera cuota entra en el resumen de">
        <Segmented
          options={firstOptions.map((p) => ({ value: p, label: periodLabel(p) }))}
          value={firstPeriod}
          onChange={setFirstPeriod}
        />
      </Field>
      {parsed > 0 && (
        <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)" }}>
          {count === 1
            ? <>1 pago de <strong>{fmtMoney(parsed, currency)}</strong> en {periodLabel(firstPeriod)}</>
            : <>{count} cuotas de <strong>{fmtMoney(round2(parsed / count), currency)}</strong> · termina en {periodLabel(addMonths(firstPeriod, count - 1))}</>}
        </p>
      )}
      <Field label="Categoría (opcional)">
        <Chips options={categories.map((c) => ({ id: c.id, label: c.name }))} value={categoryId} onChange={setCategoryId} />
      </Field>
      <ErrorText error={action.error} />
      <PrimaryButton onClick={save} busy={action.busy}>{purchase ? "Guardar cambios" : "Agregar compra"}</PrimaryButton>
      {purchase && (
        <button
          type="button"
          onClick={() => action.run(() => api("DELETE", `/api/plan/card-purchases/${purchase.id}`), onClose)}
          className="w-full text-xs font-semibold py-1"
          style={{ color: "var(--accent-red)" }}
        >
          Eliminar compra
        </button>
      )}
    </Sheet>
  );
}

// ─── Cuotas a futuro ──────────────────────────────────────────────────────────

function FutureTab({ data }: { data: PlanData }) {
  const months = projectInstallments(data.purchases, data.period, 12, data.usdRate);
  const max = Math.max(...months.map((m) => m.totalArs), 1);
  const lastWithDebt = [...months].reverse().find((m) => m.totalArs > 0);

  if (!lastWithDebt) {
    return <EmptyHint>No hay cuotas comprometidas en los próximos 12 meses.</EmptyHint>;
  }

  return (
    <section className="space-y-2">
      <SectionTitle>Ya comprometido en cuotas</SectionTitle>
      <div className="rounded-2xl p-4 space-y-3" style={cardStyle}>
        {months.map((m) => (
          <div key={m.period} className="flex items-center gap-3">
            <span className="text-xs w-14 flex-shrink-0 capitalize" style={{ color: "var(--text-secondary)" }}>
              {periodShort(m.period)}
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-elevated)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${(m.totalArs / max) * 100}%`, backgroundColor: "var(--accent)" }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums w-24 text-right flex-shrink-0" style={{ color: m.totalArs > 0 ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {m.totalArs > 0 ? fmtArs(m.totalArs) : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] px-1" style={{ color: "var(--text-secondary)" }}>
        Solo cuenta las compras cargadas acá. Las cuotas en dólares se pasan a pesos con el dólar de este mes.
      </p>
    </section>
  );
}

// ─── Mis tarjetas ─────────────────────────────────────────────────────────────

function ManageCardsSheet({ cards, onEdit, onAdd, onClose }: {
  cards: CardDTO[];
  onEdit: (card: CardDTO) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Mis tarjetas" onClose={onClose}>
      <ListCard>
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onEdit(card)}
            aria-label={`Editar ${cardLabel(card)}`}
            className="w-full flex items-center gap-3 px-4 py-3 text-left"
          >
            <CardIdentity card={card} />
            <ChevronRight size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          </button>
        ))}
      </ListCard>
      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Tocá una tarjeta para cambiarle el banco, el tipo o el titular, o para eliminarla.
      </p>
      <PrimaryButton onClick={onAdd}>Agregar tarjeta</PrimaryButton>
    </Sheet>
  );
}

const CARD_TYPES = [
  { id: "VISA", label: "Visa" },
  { id: "MC", label: "Mastercard" },
  { id: "AMEX", label: "Amex" },
];

const BANKS = ["Banco Nación", "Galicia", "BBVA", "Santander", "MercadoPago", "Brubank", "Naranja X", "Cencopay"];

function CardSheet({ card, purchaseCount, statementCount, onClose }: {
  card?: CardDTO;
  purchaseCount: number;
  statementCount: number;
  onClose: () => void;
}) {
  const action = useAction();
  const [entity, setEntity] = useState(card?.entity ?? "");
  const [cardType, setCardType] = useState<string | null>(card ? card.cardType?.toUpperCase() ?? null : "VISA");
  const [ownerName, setOwnerName] = useState(card?.ownerName ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const preset = BANKS.find((b) => b.toLowerCase() === entity.trim().toLowerCase()) ?? null;
  const usage = [
    purchaseCount > 0 ? `${purchaseCount} ${purchaseCount === 1 ? "compra" : "compras"}` : null,
    statementCount > 0 ? `${statementCount} ${statementCount === 1 ? "resumen" : "resúmenes"}` : null,
  ].filter(Boolean).join(" y ");

  function save() {
    if (!entity.trim() || !cardType || !ownerName.trim()) return action.setError("Completá tipo, banco y titular");
    const body = { entity: entity.trim(), cardType, ownerName: ownerName.trim() };
    return action.run(
      () => card ? api("PATCH", `/api/plan/cards/${card.id}`, body) : api("POST", "/api/plan/cards", body),
      onClose,
    );
  }

  return (
    <Sheet title={card ? "Editar tarjeta" : "Nueva tarjeta"} onClose={onClose}>
      {card && !card.entity && (
        <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
          Hoy figura como <strong style={{ color: "var(--text-primary)" }}>{card.name}</strong>. Completá los datos para reconocerla mejor.
        </p>
      )}
      <Field label="Tipo">
        <Chips options={CARD_TYPES} value={cardType} onChange={(id) => id && setCardType(id)} />
      </Field>
      <Field label="Banco o entidad">
        <div className="space-y-2">
          <Chips options={BANKS.map((b) => ({ id: b, label: b }))} value={preset} onChange={(id) => setEntity(id ?? "")} />
          <TextInput
            aria-label="Banco o entidad"
            placeholder="O escribilo: Ej. Banco Ciudad"
            maxLength={40}
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
          />
        </div>
      </Field>
      <Field label="Titular">
        <TextInput
          aria-label="Titular"
          placeholder="Nombre del titular"
          maxLength={40}
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
        />
      </Field>
      <ErrorText error={action.error} />
      <PrimaryButton onClick={save} busy={action.busy}>{card ? "Guardar cambios" : "Agregar tarjeta"}</PrimaryButton>

      {card && !confirmDelete && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="w-full text-xs font-semibold py-1"
          style={{ color: "var(--accent-red)" }}
        >
          Eliminar tarjeta
        </button>
      )}
      {card && confirmDelete && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: usage ? "var(--accent-red)" : "var(--text-secondary)" }}>
            {usage
              ? `Esta tarjeta tiene ${usage} en Plan simple. Si la eliminás, se borran con ella y no se puede deshacer.`
              : "No tiene compras ni resúmenes cargados en Plan simple."}
          </p>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setConfirmDelete(false)}>Cancelar</SecondaryButton>
            <SecondaryButton
              tone="danger"
              disabled={action.busy}
              onClick={() => action.run(() => api("DELETE", `/api/plan/cards/${card.id}?confirm=1`), onClose)}
            >
              {usage ? "Eliminar todo" : "Sí, eliminar"}
            </SecondaryButton>
          </div>
        </div>
      )}
    </Sheet>
  );
}
