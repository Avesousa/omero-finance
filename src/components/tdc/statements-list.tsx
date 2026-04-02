"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Edit2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { StatementForm } from "./statement-form";

export interface StatementData {
  id: string;
  cardName: string;
  totalAmountArs: number;
  amountToPay: number;
  dueDate: string;
  minimumPayment: number | null;
  isPaid: boolean;
  daysUntilDue: number;
}

interface StatementsListProps {
  statements: StatementData[];
  month: string;
  year: number;
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

function StatementRow({ s, month, year }: { s: StatementData; month: string; year: number }) {
  const router            = useRouter();
  const [isPaid, setIsPaid] = useState(s.isPaid);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const due = dueDateLabel(s.dueDate, s.daysUntilDue);

  async function togglePaid() {
    setLoading(true);
    const next = !isPaid;
    setIsPaid(next); // optimistic
    try {
      await fetch(`/api/tdc/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: next }),
      });
      router.refresh();
    } catch {
      setIsPaid(!next); // revert
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
          borderColor: isPaid ? "var(--border)" : s.daysUntilDue <= 3 ? "var(--accent-amber)" : "var(--border)",
          opacity: isPaid ? 0.7 : 1,
        }}
      >
        {/* Top row: card name + amount */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {s.cardName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: due.color }}>{due.text}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-bold tabular-nums" style={{ color: isPaid ? "var(--accent-green)" : "var(--text-primary)" }}>
              {fmt(s.amountToPay)}
            </p>
            {s.minimumPayment && s.minimumPayment < s.amountToPay && (
              <p className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                mín. {fmt(s.minimumPayment)}
              </p>
            )}
          </div>
        </div>

        {/* Bottom row: paid toggle + actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePaid}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium border transition-colors"
            style={{
              backgroundColor: isPaid ? "rgba(34,197,94,0.1)" : "var(--bg-elevated)",
              borderColor:     isPaid ? "var(--accent-green)" : "var(--border)",
              color:           isPaid ? "var(--accent-green)" : "var(--text-secondary)",
            }}
          >
            {isPaid ? <CheckCircle2 size={15} /> : <Clock size={15} />}
            {isPaid ? "Pagada" : "Pendiente"}
          </button>

          <button
            onClick={() => setEditing(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-elevated)" }}
          >
            <Edit2 size={14} />
          </button>

          <button
            onClick={() => setConfirmDelete(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl border"
            style={{ borderColor: "var(--border)", color: "var(--accent-red)", backgroundColor: "var(--bg-elevated)" }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing && (
        <StatementForm
          month={month}
          year={year}
          onClose={() => setEditing(false)}
          initial={{
            id:             s.id,
            cardName:       s.cardName,
            totalAmountArs: s.totalAmountArs,
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

export function StatementsList({ statements, month, year }: StatementsListProps) {
  const [showForm, setShowForm] = useState(false);

  const totalToPay = statements.reduce((s, r) => s + r.amountToPay, 0);
  const paidTotal  = statements.filter((r) => r.isPaid).reduce((s, r) => s + r.amountToPay, 0);
  const pendTotal  = totalToPay - paidTotal;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {statements.length > 0 && (
        <div
          className="rounded-2xl p-4 border grid grid-cols-3 gap-2 text-center"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>Total</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {fmt(totalToPay)}
            </p>
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
          <StatementRow key={s.id} s={s} month={month} year={year} />
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
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
