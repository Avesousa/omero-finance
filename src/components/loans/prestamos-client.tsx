"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronUp, Check, Loader2, X, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ──────────────────────────────────────────────────────────────────

type Currency = "ARS" | "USD";

interface LoanInstallment {
  id:                string;
  loanId:            string;
  installmentNumber: number;
  dueDate:           string;
  amount:            number;
  currency:          Currency;
  isPaid:            boolean;
  paidDate:          string | null;
}

interface Loan {
  id:                 string;
  direction:          "DADO" | "TOMADO";
  counterpart:        string;
  paymentMethod:      string | null;
  currency:           Currency;
  principal:          number;
  principalArs:       number | null;
  dollarRateSnapshot: number | null;
  installments:       number;
  installmentUnit:    "WEEKLY" | "MONTHLY";
  interestRate:       number;
  totalAmount:        number;
  notes:              string | null;
  createdAt:          string;
  installmentRecords: LoanInstallment[];
}

interface Debt {
  id:                 string;
  date:               string;
  concept:            string;
  debtor:             string;
  currency:           Currency;
  totalAmount:        number;
  totalArs:           number | null;
  dollarRateSnapshot: number | null;
  amountPaid:         number;
  status:             "ACTIVE" | "SETTLED";
  createdAt:          string;
}

interface Props {
  initialLoans: Loan[];
  initialDebts: Debt[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number, currency: Currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Loan Form ───────────────────────────────────────────────────────────────

interface LoanFormProps {
  onClose: () => void;
  initial?: Partial<Loan>;
}

function LoanForm({ onClose, initial }: LoanFormProps) {
  const router     = useRouter();
  const isEditing  = !!initial?.id;

  const [direction,       setDirection]       = useState(initial?.direction       ?? "DADO");
  const [counterpart,     setCounterpart]     = useState(initial?.counterpart     ?? "");
  const [paymentMethod,   setPaymentMethod]   = useState(initial?.paymentMethod   ?? "");
  const [currency,        setCurrency]        = useState<Currency>(initial?.currency ?? "ARS");
  const [principal,       setPrincipal]       = useState(initial?.principal       ? String(initial.principal)   : "");
  const [installments,    setInstallments]    = useState(initial?.installments    ? String(initial.installments) : "");
  const [installmentUnit, setInstallmentUnit] = useState(initial?.installmentUnit ?? "MONTHLY");
  const [interestRate,    setInterestRate]    = useState(initial?.interestRate    ? String(initial.interestRate * 100) : "0");
  const [totalAmount,     setTotalAmount]     = useState(initial?.totalAmount     ? String(initial.totalAmount)  : "");
  const [notes,           setNotes]           = useState(initial?.notes           ?? "");
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  async function handleSave() {
    if (!counterpart || !principal || !installments || !totalAmount) {
      setError("Completá todos los campos obligatorios");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url    = isEditing ? `/api/loans/${initial!.id}` : "/api/loans";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          counterpart,
          paymentMethod: paymentMethod || undefined,
          currency,
          principal,
          installments,
          installmentUnit,
          interestRate: String(parseFloat(interestRate) / 100),
          totalAmount,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al guardar");
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {isEditing ? "Editar préstamo" : "Nuevo préstamo"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Direction */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Dirección</Label>
          <Select value={direction} onValueChange={(v) => setDirection(v as "DADO" | "TOMADO")}>
            <SelectTrigger style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DADO">DADO (lo presté yo)</SelectItem>
              <SelectItem value="TOMADO">TOMADO (me lo prestaron)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Counterpart */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
            {direction === "DADO" ? "Deudor (quién me debe)" : "Acreedor (a quién le debo)"}
          </Label>
          <Input
            placeholder="Nombre"
            value={counterpart}
            onChange={(e) => setCounterpart(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Payment method */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Medio de pago (opcional)</Label>
          <Input
            placeholder="Transferencia, efectivo…"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Currency + Principal */}
        <div className="flex gap-3">
          <div className="w-28">
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Moneda</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <SelectTrigger style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Capital prestado</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* Installments + Unit */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Cuotas</Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="1"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="w-36">
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Frecuencia</Label>
            <Select value={installmentUnit} onValueChange={(v) => setInstallmentUnit(v as "WEEKLY" | "MONTHLY")}>
              <SelectTrigger style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Mensual</SelectItem>
                <SelectItem value="WEEKLY">Semanal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Interest + Total */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Interés (%)</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Total a devolver</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Notas (opcional)</Label>
          <Input
            placeholder="Motivo, condiciones…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {error && (
          <p className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-11 font-semibold rounded-xl"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Agregar préstamo"}
        </Button>
      </div>
    </div>
  );
}

// ─── Debt Form ───────────────────────────────────────────────────────────────

interface DebtFormProps {
  onClose: () => void;
  initial?: Partial<Debt>;
}

function DebtForm({ onClose, initial }: DebtFormProps) {
  const router    = useRouter();
  const isEditing = !!initial?.id;

  const [date,        setDate]        = useState(initial?.date ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [concept,     setConcept]     = useState(initial?.concept     ?? "");
  const [debtor,      setDebtor]      = useState(initial?.debtor      ?? "");
  const [currency,    setCurrency]    = useState<Currency>(initial?.currency ?? "ARS");
  const [totalAmount, setTotalAmount] = useState(initial?.totalAmount ? String(initial.totalAmount) : "");
  const [amountPaid,  setAmountPaid]  = useState(initial?.amountPaid  ? String(initial.amountPaid)  : "0");
  const [status,      setStatus]      = useState<"ACTIVE" | "SETTLED">(initial?.status ?? "ACTIVE");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSave() {
    if (!concept || !debtor || !totalAmount || !date) {
      setError("Completá todos los campos obligatorios");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url    = isEditing ? `/api/debts/${initial!.id}` : "/api/debts";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, concept, debtor, currency, totalAmount, amountPaid, status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al guardar");
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {isEditing ? "Editar deuda" : "Nueva deuda a cobrar"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Date */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Fecha</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Concept */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Concepto</Label>
          <Input
            placeholder="Qué se debe…"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Debtor */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Deudor (quién nos debe)</Label>
          <Input
            placeholder="Nombre"
            value={debtor}
            onChange={(e) => setDebtor(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Currency + Total */}
        <div className="flex gap-3">
          <div className="w-28">
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Moneda</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <SelectTrigger style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Total adeudado</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* Amount paid */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Monto cobrado hasta ahora</Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Status (only when editing) */}
        {isEditing && (
          <div>
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "ACTIVE" | "SETTLED")}>
              <SelectTrigger style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Activa</SelectItem>
                <SelectItem value="SETTLED">Saldada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {error && (
          <p className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-11 font-semibold rounded-xl"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Agregar deuda"}
        </Button>
      </div>
    </div>
  );
}

// ─── Loan Card ────────────────────────────────────────────────────────────────

function LoanCard({ loan }: { loan: Loan }) {
  const router         = useRouter();
  const [expanded,   setExpanded]   = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const paidCount = loan.installmentRecords.filter((i) => i.isPaid).length;
  const total     = loan.installmentRecords.length;
  const progress  = total > 0 ? (paidCount / total) * 100 : 0;

  const directionLabel = loan.direction === "DADO" ? "Prestado" : "Recibido";
  const directionColor = loan.direction === "DADO" ? "var(--accent)" : "var(--accent-red)";

  async function handleToggleInstallment(installmentNumber: number) {
    const key = `${loan.id}-${installmentNumber}`;
    setTogglingId(key);
    try {
      await fetch(`/api/loans/${loan.id}/installments/${installmentNumber}`, { method: "PATCH" });
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar préstamo con ${loan.counterpart}?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/loans/${loan.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {editing && (
        <LoanForm
          initial={loan}
          onClose={() => setEditing(false)}
        />
      )}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${directionColor}20`, color: directionColor }}
              >
                {directionLabel}
              </span>
              <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {loan.counterpart}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {fmt(loan.principal, loan.currency)} capital · {fmt(loan.totalAmount, loan.currency)} total
            </p>
            {loan.notes && (
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
                {loan.notes}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg"
              style={{ color: "var(--text-secondary)" }}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-7 h-7 flex items-center justify-center rounded-lg"
              style={{ color: "var(--accent-red)" }}
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-4 pb-1">
          <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
            <span>{paidCount}/{total} cuotas pagadas</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-elevated)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: "var(--accent)" }}
            />
          </div>
        </div>

        {/* Expand toggle */}
        <button
          className="w-full flex items-center justify-center gap-1 py-2 text-xs"
          style={{ color: "var(--text-secondary)" }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Ocultar cuotas" : "Ver cuotas"}
        </button>

        {/* Installments */}
        {expanded && (
          <div className="border-t divide-y" style={{ borderColor: "var(--border)" }}>
            {loan.installmentRecords.map((inst) => {
              const key       = `${loan.id}-${inst.installmentNumber}`;
              const toggling  = togglingId === key;
              return (
                <div
                  key={inst.id}
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ opacity: inst.isPaid ? 0.6 : 1 }}
                >
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{
                        color:           "var(--text-primary)",
                        textDecoration:  inst.isPaid ? "line-through" : "none",
                      }}
                    >
                      Cuota {inst.installmentNumber} — {fmt(inst.amount, inst.currency)}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Vence: {fmtDate(inst.dueDate)}
                      {inst.paidDate ? ` · Pagada: ${fmtDate(inst.paidDate)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleInstallment(inst.installmentNumber)}
                    disabled={toggling}
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border transition-colors"
                    style={{
                      borderColor:     inst.isPaid ? "var(--accent)" : "var(--border)",
                      backgroundColor: inst.isPaid ? "var(--accent)" : "transparent",
                    }}
                  >
                    {toggling
                      ? <Loader2 size={13} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
                      : inst.isPaid
                        ? <Check size={13} style={{ color: "var(--accent-foreground)" }} />
                        : null}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Debt Card ────────────────────────────────────────────────────────────────

function DebtCard({ debt }: { debt: Debt }) {
  const router              = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remaining   = debt.totalAmount - debt.amountPaid;
  const isSettled   = debt.status === "SETTLED";
  const paidPct     = debt.totalAmount > 0 ? (debt.amountPaid / debt.totalAmount) * 100 : 0;

  async function handleSettle() {
    const res = await fetch(`/api/debts/${debt.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: "SETTLED", amountPaid: debt.totalAmount }),
    });
    if (res.ok) router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar deuda de ${debt.debtor}?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/debts/${debt.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {editing && <DebtForm initial={debt} onClose={() => setEditing(false)} />}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="px-4 py-3 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: isSettled ? "color-mix(in srgb, var(--text-secondary) 20%, transparent)" : "color-mix(in srgb, var(--accent) 20%, transparent)",
                  color:           isSettled ? "var(--text-secondary)"                                       : "var(--accent)",
                }}
              >
                {isSettled ? "SALDADA" : "ACTIVA"}
              </span>
              <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {debt.debtor}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {debt.concept}
            </p>
            <p className="text-sm font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
              {fmt(debt.totalAmount, debt.currency)}
            </p>
            <div className="flex gap-3 mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span>Cobrado: {fmt(debt.amountPaid, debt.currency)}</span>
              {!isSettled && <span>Restante: {fmt(remaining, debt.currency)}</span>}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {fmtDate(debt.date)}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg"
              style={{ color: "var(--text-secondary)" }}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-7 h-7 flex items-center justify-center rounded-lg"
              style={{ color: "var(--accent-red)" }}
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {!isSettled && debt.totalAmount > 0 && (
          <div className="px-4 pb-2">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-elevated)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${paidPct}%`, backgroundColor: "var(--accent)" }}
              />
            </div>
          </div>
        )}

        {/* Settle button */}
        {!isSettled && (
          <div className="px-4 pb-3">
            <button
              onClick={handleSettle}
              className="text-xs font-medium px-3 py-1 rounded-lg"
              style={{ backgroundColor: "var(--bg-elevated)", color: "var(--accent)" }}
            >
              Marcar como saldada
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PrestamosClient({ initialLoans, initialDebts }: Props) {
  const [activeTab,    setActiveTab]    = useState<"loans" | "debts">("loans");
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(false);

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Tabs */}
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        {(["loans", "debts"] as const).map((tab) => {
          const label  = tab === "loans" ? "Préstamos" : "Deudas a cobrar";
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: active ? "var(--bg-card)"      : "transparent",
                color:           active ? "var(--text-primary)"  : "var(--text-secondary)",
                boxShadow:       active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === "loans" ? (
        <div className="flex flex-col gap-3">
          {initialLoans.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-secondary)" }}>
              No hay préstamos registrados
            </p>
          ) : (
            initialLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {initialDebts.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-secondary)" }}>
              No hay deudas registradas
            </p>
          ) : (
            initialDebts.map((debt) => <DebtCard key={debt.id} debt={debt} />)
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => activeTab === "loans" ? setShowLoanForm(true) : setShowDebtForm(true)}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
      >
        <Plus size={24} />
      </button>

      {/* Modals */}
      {showLoanForm && <LoanForm onClose={() => setShowLoanForm(false)} />}
      {showDebtForm && <DebtForm onClose={() => setShowDebtForm(false)} />}
    </div>
  );
}
