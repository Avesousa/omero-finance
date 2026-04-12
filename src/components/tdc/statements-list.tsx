"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, DollarSign, Edit2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { StatementForm } from "./statement-form";
import { PaymentModal } from "./payment-modal";
import { CardBrandIcon } from "./card-brand";
import { type CardItem, cardDisplayLabel } from "./card-management";

export interface StatementData {
  id: string;
  cardName: string;
  totalAmountArs: number;
  usdAmount: number | null;
  dollarRateSnapshot: number | null;
  amountToPay: number;
  dueDate: string;
  minimumPayment: number | null;
  payMinimum: boolean;
  committedOverride: number | null;
  isPaid: boolean;
  paidAt: string | null;
  paymentSource: string | null;
  daysUntilDue: number;
  month: string;
  year: number;
}

interface StatementsListProps {
  statements: StatementData[];
  month: string;
  year: number;
  cards: CardItem[];
  currentRate: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n);
}

function dueDateLabel(iso: string, days: number) {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const label = `${dd}/${mm}/${d.getUTCFullYear()}`;
  if (days < 0)   return { text: `Venció ${label}`,    color: "var(--accent-red)" };
  if (days === 0) return { text: `Vence hoy`,          color: "var(--accent-red)" };
  if (days <= 3)  return { text: `Vence ${label}`,     color: "var(--accent-amber)" };
  return { text: `Vence ${label}`, color: "var(--text-secondary)" };
}

function paymentSourceLabel(src: string | null): string {
  if (!src) return "";
  if (src === "AHORRO_USD")      return "Ahorro USD";
  if (src === "SUELDO_AVELINO")  return "Sueldo Avelino";
  if (src === "SUELDO_MARIA")    return "Sueldo Maria";
  if (src === "AHORRO")          return "Ahorro";
  if (src.startsWith("CAMBIO_USD:")) {
    const parts = src.split(":");
    return `Cambio USD @ $${parts[1]}`;
  }
  return "Otro";
}

type CommitMode = "total" | "minimo" | "otro";

function getInitialMode(s: StatementData): CommitMode {
  if (s.payMinimum) return "minimo";
  if (s.committedOverride != null) return "otro";
  return "total";
}

function StatementRow({
  s, month, year, cards, currentRate,
}: {
  s: StatementData; month: string; year: number; cards: CardItem[];
  currentRate: number;
}) {
  const router                    = useRouter();
  const [isPaid, setIsPaid]       = useState(s.isPaid);
  const [paySource, setPaySource] = useState(s.paymentSource);
  const [loading, setLoading]     = useState(false);
  const [editing, setEditing]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPayModal, setShowPayModal]   = useState(false);
  const [commitMode, setCommitMode]       = useState<CommitMode>(getInitialMode(s));
  const [otroValue, setOtroValue]         = useState(
    s.committedOverride != null ? String(Math.round(s.committedOverride)) : ""
  );

  // Use current rate for live USD→ARS display; snapshot only locked at payment time
  const usdInArs  = s.usdAmount ? s.usdAmount * currentRate : 0;
  const totalArs  = s.amountToPay + usdInArs;
  const parsedOtro = parseFloat(otroValue) || 0;

  const committedAmount =
    commitMode === "minimo" ? (s.minimumPayment ?? totalArs) :
    commitMode === "otro"   ? (parsedOtro || totalArs)       :
    totalArs;

  const due = dueDateLabel(s.dueDate, s.daysUntilDue);

  async function applyMode(mode: CommitMode, override?: number) {
    const body: Record<string, unknown> =
      mode === "minimo" ? { payMinimum: true,  committedOverride: null } :
      mode === "otro"   ? { payMinimum: false, committedOverride: override ?? null } :
                          { payMinimum: false, committedOverride: null };
    await fetch(`/api/tdc/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  async function selectMode(mode: CommitMode) {
    setCommitMode(mode);
    if (mode !== "otro") await applyMode(mode);
  }

  async function saveOtro() {
    const val = parseFloat(otroValue);
    if (!isNaN(val) && val > 0) {
      await applyMode("otro", val);
    }
  }

  async function undoPaid() {
    setLoading(true);
    try {
      await fetch(`/api/tdc/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: false }),
      });
      setIsPaid(false);
      setPaySource(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      await fetch(`/api/tdc/${s.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <div
        className="rounded-2xl border p-4 space-y-3"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: isPaid ? "var(--accent-green)" : s.daysUntilDue <= 3 ? "var(--accent-amber)" : "var(--border)",
          opacity: isPaid ? 0.75 : 1,
        }}
      >
        {/* Top row: card name + amount */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {(() => {
                const cardObj = cards.find((c) => c.name === s.cardName);
                return cardObj?.entity && cardObj?.cardType ? (
                  <>
                    <CardBrandIcon cardType={cardObj.cardType} size={24} showBank={false} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {cardObj.entity}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {[cardObj.cardType, cardObj.ownerName].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </>
                ) : (
                  <CardBrandIcon name={s.cardName} size={24} showBank />
                );
              })()}
            </div>
            <p className="text-xs" style={{ color: due.color }}>{due.text}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-bold tabular-nums" style={{ color: isPaid ? "var(--accent-green)" : "var(--text-primary)" }}>
              {fmt(committedAmount)}
            </p>
            {commitMode !== "total" && (
              <p className="text-[10px] tabular-nums line-through" style={{ color: "var(--text-secondary)" }}>
                {fmt(totalArs)}
              </p>
            )}
            {s.usdAmount && (
              <p className="text-[10px] tabular-nums" style={{
                color: "var(--accent)",
                textDecoration: commitMode !== "total" ? "line-through" : "none",
                opacity: commitMode !== "total" ? 0.5 : 1,
              }}>
                {`USD ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(s.usdAmount)}`}
                {usdInArs > 0 && ` ≈ ${fmt(usdInArs)}`}
              </p>
            )}
          </div>
        </div>

        {/* Committed toggle: Total / Mínimo / Otro — always shown for unpaid cards */}
        {!isPaid && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: "var(--text-secondary)" }}>
                Comprometer
              </p>
              <button
                onClick={() => selectMode("total")}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                style={{
                  backgroundColor: commitMode === "total" ? "var(--accent)" : "var(--bg-elevated)",
                  color:           commitMode === "total" ? "#fff"          : "var(--text-secondary)",
                }}
              >
                Total {fmt(totalArs)}
              </button>
              <button
                onClick={() => selectMode("minimo")}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                style={{
                  backgroundColor: commitMode === "minimo" ? "var(--accent-amber)" : "var(--bg-elevated)",
                  color:           commitMode === "minimo" ? "#fff"                : "var(--text-secondary)",
                }}
              >
                Mínimo {s.minimumPayment ? fmt(s.minimumPayment) : "—"}
              </button>
              <button
                onClick={() => selectMode("otro")}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                style={{
                  backgroundColor: commitMode === "otro" ? "var(--accent-green)" : "var(--bg-elevated)",
                  color:           commitMode === "otro" ? "#fff"                : "var(--text-secondary)",
                }}
              >
                Otro {commitMode === "otro" && parsedOtro > 0 ? fmt(parsedOtro) : ""}
              </button>
            </div>
            {/* Free input shown when "Otro" is active */}
            {commitMode === "otro" && (
              <input
                type="number"
                inputMode="decimal"
                value={otroValue}
                onChange={(e) => setOtroValue(e.target.value)}
                onBlur={saveOtro}
                placeholder="Monto a comprometer"
                className="w-full h-9 px-3 rounded-xl text-sm tabular-nums font-semibold"
                style={{
                  backgroundColor: "rgba(34,197,94,0.08)",
                  border: "1px solid var(--accent-green)",
                  color: "var(--accent-green)",
                  outline: "none",
                }}
              />
            )}
          </div>
        )}

        {/* Bottom row */}
        {isPaid ? (
          /* ── PAID STATE ── */
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid var(--accent-green)" }}
            >
              <CheckCircle2 size={14} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
              <div className="min-w-0">
                <p className="text-xs font-semibold" style={{ color: "var(--accent-green)" }}>Pagada</p>
                {paySource && (
                  <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                    {paymentSourceLabel(paySource)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={undoPaid}
              disabled={loading}
              title="Deshacer pago"
              className="w-9 h-9 flex items-center justify-center rounded-xl border"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-elevated)" }}
            >
              <RotateCcw size={13} />
            </button>
            <button
              onClick={() => setEditing(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-elevated)" }}
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border"
              style={{ borderColor: "var(--border)", color: "var(--accent-red)", backgroundColor: "var(--bg-elevated)" }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          /* ── UNPAID STATE — payment buttons ── */
          <div className="space-y-2">
            <div className="flex gap-2">
              {s.usdAmount && (
                <button
                  onClick={() => setShowPayModal(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "rgba(99,102,241,0.08)" }}
                >
                  <DollarSign size={13} /> Pagar USD
                </button>
              )}
              <button
                onClick={() => setShowPayModal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors"
                style={{ borderColor: "var(--accent-green)", color: "var(--accent-green)", backgroundColor: "rgba(34,197,94,0.08)" }}
              >
                <CreditCard size={13} /> Pagar
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-elevated)" }}
              >
                <Edit2 size={12} /> Editar
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs border"
                style={{ borderColor: "var(--border)", color: "var(--accent-red)", backgroundColor: "var(--bg-elevated)" }}
              >
                <Trash2 size={12} /> Eliminar
              </button>
            </div>
          </div>
        )}
      </div>

      {showPayModal && (
        <PaymentModal
          statement={{ id: s.id, cardName: s.cardName, amountToPay: s.amountToPay, usdAmount: s.usdAmount, minimumPayment: s.minimumPayment, month, year, currentRate }}
          onClose={() => setShowPayModal(false)}
          onPaid={(src) => { setIsPaid(true); setPaySource(src); }}
        />
      )}

      {editing && (
        <StatementForm
          month={month}
          year={year}
          cards={cards}
          onClose={() => setEditing(false)}
          initial={{
            id:             s.id,
            cardName:       s.cardName,
            totalAmountArs: s.totalAmountArs,
            usdAmount:      s.usdAmount,
            dueDate:        s.dueDate,
            minimumPayment: s.minimumPayment ?? undefined,
          }}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={(e) => e.target === e.currentTarget && setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              ¿Eliminar resumen de {s.cardName}?
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: "var(--accent-red)", color: "#fff" }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function StatementsList({ statements, month, year, cards, currentRate }: StatementsListProps) {
  const [showForm, setShowForm] = useState(false);

  // Full ARS equivalent using the CURRENT rate (dynamic, not snapshot)
  function fullArs(s: StatementData) {
    return s.amountToPay + (s.usdAmount ? s.usdAmount * currentRate : 0);
  }

  // Committed amount per card based on stored mode
  function committedArs(s: StatementData) {
    if (s.payMinimum && s.minimumPayment != null) return s.minimumPayment;
    if (!s.payMinimum && s.committedOverride != null) return s.committedOverride;
    return fullArs(s);
  }

  const totalToPay   = statements.reduce((s, r) => s + committedArs(r), 0);
  const totalFull    = statements.reduce((s, r) => s + fullArs(r), 0);
  const isSimulating = statements.some((s) => s.payMinimum || s.committedOverride != null);
  const paidTotal    = statements.filter((r) => r.isPaid).reduce((s, r) => s + committedArs(r), 0);
  const pendTotal    = totalToPay - paidTotal;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {statements.length > 0 && (
        <div
          className="rounded-2xl p-4 border grid grid-cols-3 gap-2 text-center"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>
              Total{isSimulating ? " (sim.)" : ""}
            </p>
            <p className="text-sm font-bold tabular-nums" style={{ color: isSimulating ? "var(--accent-amber)" : "var(--text-primary)" }}>
              {fmt(totalToPay)}
            </p>
            {isSimulating && (
              <p className="text-[10px] tabular-nums line-through" style={{ color: "var(--text-secondary)" }}>
                {fmt(totalFull)}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>Pagado</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: "var(--accent-green)" }}>
              {fmt(paidTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>Pendiente</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: pendTotal > 0 ? "var(--accent-amber)" : "var(--accent-green)" }}>
              {fmt(pendTotal)}
            </p>
          </div>
        </div>
      )}

      {/* Statement rows */}
      {statements.length === 0 ? (
        <div
          className="rounded-2xl border py-12 flex flex-col items-center gap-2"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Sin resúmenes para este mes
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Agregá el primero con el botón +
          </p>
        </div>
      ) : (
        statements.map((s) => (
          <StatementRow
            key={s.id} s={s} month={month} year={year} cards={cards}
            currentRate={currentRate}
          />
        ))
      )}

      {/* Add button */}
      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-medium transition-colors"
        style={{
          borderColor: "var(--accent)",
          color: "var(--accent)",
          backgroundColor: "rgba(99,102,241,0.05)",
          borderStyle: "dashed",
        }}
      >
        <Plus size={16} />
        Agregar resumen
      </button>

      {showForm && (
        <StatementForm
          month={month}
          year={year}
          cards={cards}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
