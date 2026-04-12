"use client";

import { useState, useMemo } from "react";
import { Plus, Loader2, X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const MONTHS = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

export interface PersonalExpense {
  id: string;
  userId: string;
  concept: string;
  cardName: string | null;
  currency: "ARS" | "USD";
  amount: number;
  amountArs: number | null;
  isPaid: boolean;
  month: string;
  year: number;
  createdAt: string;
}

export interface HouseholdUser {
  id: string;
  name: string;
  avatarColor: string;
}

interface GastosPropiosClientProps {
  initialExpenses: PersonalExpense[];
  users: HouseholdUser[];
  currentUserId: string;
  initialMonth: string;
  initialYear: number;
}

interface ExpenseFormProps {
  month: string;
  year: number;
  initial?: PersonalExpense;
  onClose: () => void;
  onSaved: () => void;
}

function ExpenseForm({ month, year, initial, onClose, onSaved }: ExpenseFormProps) {
  const isEditing = !!initial;
  const [concept, setConcept]   = useState(initial?.concept ?? "");
  const [currency, setCurrency] = useState<"ARS" | "USD">(initial?.currency ?? "ARS");
  const [amount, setAmount]     = useState(initial ? String(initial.amount) : "");
  const [cardName, setCardName] = useState(initial?.cardName ?? "");
  const [isPaid, setIsPaid]     = useState(initial?.isPaid ?? true);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSave() {
    if (!concept.trim() || !amount) {
      setError("Completá concepto y monto");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url    = isEditing ? `/api/personal-expenses/${initial!.id}` : "/api/personal-expenses";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, currency, amount, cardName: cardName || undefined, isPaid, month, year }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al guardar");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/personal-expenses/${initial.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al eliminar");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {isEditing ? "Editar gasto" : "Nuevo gasto personal"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Concept */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Concepto</Label>
          <Input
            placeholder="Ej: Ropa, libro, etc."
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Currency toggle */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Moneda</Label>
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            {(["ARS", "USD"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className="flex-1 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: currency === c ? "var(--accent)" : "var(--bg-elevated)",
                  color: currency === c ? "var(--accent-foreground)" : "var(--text-secondary)",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
            Monto ({currency})
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg font-semibold tabular-nums h-12"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Card name */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Tarjeta (opcional)</Label>
          <Input
            placeholder="Ej: Visa, Naranja…"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* isPaid toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => setIsPaid(!isPaid)}
            className="w-9 h-5 rounded-full relative transition-colors"
            style={{ backgroundColor: isPaid ? "var(--accent)" : "var(--border)" }}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
              style={{
                backgroundColor: "#fff",
                transform: isPaid ? "translateX(18px)" : "translateX(2px)",
              }}
            />
          </div>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {isPaid ? "Pagado" : "Pendiente"}
          </span>
        </label>

        {error && (
          <p className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || deleting}
          className="w-full h-11 font-semibold rounded-xl"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Agregar gasto"}
        </Button>

        {isEditing && (
          <button
            onClick={handleDelete}
            disabled={deleting || saving}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm rounded-xl"
            style={{ color: "var(--accent-red)" }}
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deleting ? "Eliminando…" : "Eliminar gasto"}
          </button>
        )}
      </div>
    </div>
  );
}

function formatAmount(amount: number, currency: "ARS" | "USD") {
  return currency === "USD"
    ? `USD ${amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$ ${amount.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function GastosPropiosClient({
  initialExpenses,
  users,
  currentUserId,
  initialMonth,
  initialYear,
}: GastosPropiosClientProps) {
  const router = useRouter();
  const [month, setMonth]   = useState(initialMonth);
  const [year, setYear]     = useState(initialYear);
  const [expenses, setExpenses] = useState<PersonalExpense[]>(initialExpenses);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<PersonalExpense | undefined>(undefined);

  const monthIndex = MONTHS.indexOf(month);

  function goToPrevMonth() {
    if (monthIndex === 0) {
      setMonth(MONTHS[11]);
      setYear((y) => y - 1);
    } else {
      setMonth(MONTHS[monthIndex - 1]);
    }
  }

  function goToNextMonth() {
    if (monthIndex === 11) {
      setMonth(MONTHS[0]);
      setYear((y) => y + 1);
    } else {
      setMonth(MONTHS[monthIndex + 1]);
    }
  }

  async function loadExpenses(m: string, y: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/personal-expenses?month=${m}&year=${y}`);
      if (!res.ok) throw new Error("Error al cargar");
      const data: PersonalExpense[] = await res.json();
      setExpenses(data);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }

  // Reload when month/year changes (skip initial render)
  const [initialized, setInitialized] = useState(false);
  useMemo(() => {
    if (!initialized) { setInitialized(true); return; }
    loadExpenses(month, year);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  function handleSaved() {
    loadExpenses(month, year);
    router.refresh();
  }

  // Group expenses by userId
  const userMap = useMemo(() => {
    const m: Record<string, HouseholdUser> = {};
    for (const u of users) m[u.id] = u;
    return m;
  }, [users]);

  const groupedByUser = useMemo(() => {
    const groups: Record<string, PersonalExpense[]> = {};
    for (const e of expenses) {
      if (!groups[e.userId]) groups[e.userId] = [];
      groups[e.userId].push(e);
    }
    return groups;
  }, [expenses]);

  // Grand total in ARS
  const grandTotal = useMemo(() => {
    return expenses.reduce((sum, e) => {
      const arsVal = e.currency === "USD" ? (e.amountArs ?? e.amount) : e.amount;
      return sum + arsVal;
    }, 0);
  }, [expenses]);

  const isMultiUser = users.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={goToPrevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold capitalize" style={{ color: "var(--text-primary)" }}>
          {month} {year}
        </span>
        <button onClick={goToNextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Total card */}
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Total del mes</p>
        <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: "var(--text-primary)" }}>
          {loading ? "…" : `$ ${grandTotal.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
        </p>
      </div>

      {/* Expenses list grouped by user */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-8" style={{ color: "var(--text-secondary)" }}>
          <p className="text-sm">Sin gastos en {month} {year}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {(isMultiUser ? users : users.filter((u) => groupedByUser[u.id])).map((user) => {
            const userExpenses = groupedByUser[user.id] ?? [];
            if (!isMultiUser && userExpenses.length === 0) return null;
            if (isMultiUser && userExpenses.length === 0) return null;

            const userTotal = userExpenses.reduce((sum, e) => {
              return sum + (e.currency === "USD" ? (e.amountArs ?? e.amount) : e.amount);
            }, 0);

            return (
              <div key={user.id}>
                {isMultiUser && (
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: user.avatarColor }}
                    >
                      {user.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {user.name}
                    </span>
                    <span className="text-xs ml-auto" style={{ color: "var(--text-secondary)" }}>
                      $ {userTotal.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                <div
                  className="rounded-2xl border divide-y overflow-hidden"
                  style={{ borderColor: "var(--border)" }}
                >
                  {userExpenses.map((expense) => (
                    <button
                      key={expense.id}
                      onClick={() => { setEditing(expense); setShowForm(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-opacity active:opacity-70"
                      style={{ backgroundColor: "var(--bg-card)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {expense.concept}
                        </p>
                        {expense.cardName && (
                          <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                            {expense.cardName}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                          {formatAmount(expense.amount, expense.currency)}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: expense.isPaid ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                            color: expense.isPaid ? "#16a34a" : "var(--accent-red)",
                          }}
                        >
                          {expense.isPaid ? "Pagado" : "Pendiente"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating add button */}
      <button
        onClick={() => { setEditing(undefined); setShowForm(true); }}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
        aria-label="Agregar gasto personal"
      >
        <Plus size={24} />
      </button>

      {showForm && (
        <ExpenseForm
          month={month}
          year={year}
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
