"use client";

import { useState } from "react";
import Link from "next/link";
import {
  addMonths, cardLabel, fmtMoney, numberToInput, parseMoney, todayIso,
  type CardDTO, type CategoryDTO, type Currency,
} from "@/lib/plan/core";
import type { InboxItemDTO } from "@/lib/plan/inbox";
import {
  Chips, EmptyHint, ErrorText, Field, ListCard, MoneyInput, PlanHeader, PrimaryButton, Sheet,
  TextInput, api, useAction,
} from "./plan-ui";

const DEBIT = "DEBIT";

/** Fecha y hora de un pago, en hora de Buenos Aires. */
function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

/** "YYYY-MM-DD" de un instante, en hora de Buenos Aires. */
function dayOf(iso: string): string {
  return todayIso(new Date(iso));
}

export function InboxClient({ items, categories, cards, today }: {
  items: InboxItemDTO[];
  categories: CategoryDTO[];
  cards: CardDTO[];
  today: string;
}) {
  const [open, setOpen] = useState<InboxItemDTO | null>(null);

  return (
    <>
      <PlanHeader title="Por confirmar" backHref="/plan" />
      {items.length === 0 ? (
        <EmptyHint>
          No hay pagos por confirmar. Los pagos con Apple Pay van a aparecer acá solos.
          <br />
          <Link href="/plan/apple-pay" className="font-semibold underline" style={{ color: "var(--accent)" }}>
            Configurar Apple Pay automático
          </Link>
        </EmptyHint>
      ) : (
        <ListCard>
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setOpen(it)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-opacity active:opacity-70"
              style={{ backgroundColor: "var(--bg-card)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {it.merchant ?? "Pago sin comercio"}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
                  {whenLabel(it.occurredAt)}
                  {it.walletCard && <span className="text-[11px]"> · {it.walletCard}</span>}
                </p>
              </div>
              <p
                className="text-sm font-semibold tabular-nums flex-shrink-0"
                style={{ color: it.amount == null ? "var(--accent-amber)" : "var(--text-primary)" }}
              >
                {it.amount == null ? "Sin monto" : fmtMoney(it.amount, it.currency)}
              </p>
            </button>
          ))}
        </ListCard>
      )}
      {open && (
        <ConfirmSheet
          key={open.id}
          item={open}
          categories={categories}
          cards={cards}
          today={today}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function ConfirmSheet({ item, categories, cards, today, onClose }: {
  item: InboxItemDTO;
  categories: CategoryDTO[];
  cards: CardDTO[];
  today: string;
  onClose: () => void;
}) {
  const action = useAction();
  const [amount, setAmount] = useState(numberToInput(item.amount));
  const [currency] = useState<Currency>(item.currency);
  const [categoryId, setCategoryId] = useState<string | null>(item.suggestedCategoryId);
  const [how, setHow] = useState<string | null>(
    item.suggestedMethod === "CARD" ? item.suggestedCardId : item.suggestedMethod === "DEBIT" ? DEBIT : null,
  );
  const [installments, setInstallments] = useState("1");
  // null = sigue la fecha (resumen del mes siguiente); se toca solo si el usuario lo cambia.
  const [firstPeriodText, setFirstPeriodText] = useState<string | null>(null);
  const [date, setDate] = useState(() => {
    const d = dayOf(item.occurredAt);
    return d > today ? today : d;
  });

  const expenseCategories = categories.filter((c) => c.kind === "EXPENSE" && !c.systemKey && !c.isArchived);
  const isCard = how != null && how !== DEBIT;
  const parsed = parseMoney(amount);

  const firstPeriod = firstPeriodText ?? (date ? addMonths(date.slice(0, 7), 1) : "");

  function confirm() {
    if (!(parsed > 0)) return action.setError("Ingresá el monto");
    if (!categoryId) return action.setError("Elegí una categoría");
    if (!how) return action.setError("Elegí cómo pagaste");
    if (!date) return action.setError("Elegí la fecha");
    const count = Math.max(1, Math.floor(Number(installments)) || 1);
    return action.run(
      () => api("POST", `/api/plan/inbox/${item.id}/confirm`, {
        amount: parsed,
        currency,
        categoryId,
        date,
        method: isCard ? "CARD" : "DEBIT",
        ...(isCard ? { cardId: how, installments: count, firstPeriod } : {}),
      }),
      onClose,
    );
  }

  function dismiss() {
    return action.run(() => api("POST", `/api/plan/inbox/${item.id}/dismiss`), onClose);
  }

  return (
    <Sheet title="Confirmar pago" onClose={onClose}>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {item.merchant ?? "Pago sin comercio"} · {whenLabel(item.occurredAt)}
        {item.walletCard && ` · ${item.walletCard}`}
      </p>
      <Field label="Monto" hint={item.amount == null ? "No llegó el monto: completalo para confirmar." : undefined}>
        <MoneyInput value={amount} onChange={setAmount} currency={currency} large autoFocus={item.amount == null} ariaLabel="Monto" />
      </Field>
      <Field label="Categoría">
        <Chips options={expenseCategories.map((c) => ({ id: c.id, label: c.name }))} value={categoryId} onChange={setCategoryId} />
      </Field>
      <Field label="¿Cómo pagaste?">
        <Chips
          options={[{ id: DEBIT, label: "Débito o efectivo" }, ...cards.map((c) => ({ id: c.id, label: cardLabel(c) }))]}
          value={how}
          onChange={setHow}
        />
      </Field>
      {isCard && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cuotas">
            <TextInput
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              aria-label="Cantidad de cuotas"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
          </Field>
          <Field label="Primera cuota en">
            <TextInput
              type="month"
              aria-label="Resumen de la primera cuota"
              value={firstPeriod}
              onChange={(e) => e.target.value && setFirstPeriodText(e.target.value)}
            />
          </Field>
        </div>
      )}
      <Field label="Fecha">
        <TextInput type="date" aria-label="Fecha" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <ErrorText error={action.error} />
      <PrimaryButton onClick={confirm} busy={action.busy}>Confirmar</PrimaryButton>
      <button
        type="button"
        onClick={dismiss}
        disabled={action.busy}
        className="w-full text-xs font-semibold py-1 disabled:opacity-50"
        style={{ color: "var(--text-secondary)" }}
      >
        Descartar
      </button>
    </Sheet>
  );
}
