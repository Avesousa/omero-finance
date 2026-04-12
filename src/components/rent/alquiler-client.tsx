"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2, X, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

type RentType = "ALQUILER" | "EXPENSAS" | "TRABAJOS";
type Currency = "ARS" | "USD";

interface RentPayment {
  id:          string;
  type:        RentType;
  apartment:   string;
  currency:    Currency;
  amount:      number;
  amountArs:   number | null;
  description: string | null;
  cbuAlias:    string | null;
  month:       string;
  year:        number;
}

interface AlquilerClientProps {
  initialPayments: RentPayment[];
  initialMonth:    string;
  initialYear:     number;
}

const TYPE_LABELS: Record<RentType, string> = {
  ALQUILER: "Alquiler",
  EXPENSAS: "Expensas",
  TRABAJOS: "Trabajos",
};

const TYPE_COLORS: Record<RentType, string> = {
  ALQUILER: "var(--accent)",
  EXPENSAS: "var(--text-secondary)",
  TRABAJOS: "var(--accent-red)",
};

function formatARS(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function formatUSD(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

// ─── Modal Form ────────────────────────────────────────────────────────────

interface RentFormProps {
  month:    string;
  year:     number;
  initial?: RentPayment;
  onClose:  () => void;
}

function RentForm({ month, year, initial, onClose }: RentFormProps) {
  const router    = useRouter();
  const isEditing = !!initial;

  const [type,        setType]        = useState<RentType>(initial?.type ?? "ALQUILER");
  const [apartment,   setApartment]   = useState(initial?.apartment ?? "");
  const [currency,    setCurrency]    = useState<Currency>(initial?.currency ?? "ARS");
  const [amount,      setAmount]      = useState(initial ? String(initial.amount) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cbuAlias,    setCbuAlias]    = useState(initial?.cbuAlias ?? "");
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSave() {
    if (!apartment.trim() || !amount) {
      setError("Completá departamento y monto");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url    = isEditing ? `/api/rent/${initial!.id}` : "/api/rent";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          apartment: apartment.trim(),
          currency,
          amount,
          description: description.trim() || undefined,
          cbuAlias:   cbuAlias.trim() || undefined,
          month,
          year,
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

  async function handleDelete() {
    if (!initial) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rent/${initial.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      router.refresh();
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
            {isEditing ? "Editar pago" : "Nuevo pago"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Type */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as RentType)}>
            <SelectTrigger style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALQUILER">Alquiler</SelectItem>
              <SelectItem value="EXPENSAS">Expensas</SelectItem>
              <SelectItem value="TRABAJOS">Trabajos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Apartment */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Departamento / Unidad</Label>
          <Input
            placeholder="Ej: Depto A, Casa"
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Currency + Amount */}
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
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Monto</Label>
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
        </div>

        {/* Description */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Descripción (opcional)</Label>
          <Input
            placeholder="Nota adicional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* CBU/Alias */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>CBU / Alias (opcional)</Label>
          <Input
            placeholder="alias.banco"
            value={cbuAlias}
            onChange={(e) => setCbuAlias(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

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
          {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Agregar pago"}
        </Button>

        {isEditing && (
          confirmDel ? (
            <div className="flex gap-2">
              <Button
                onClick={() => setConfirmDel(false)}
                variant="outline"
                className="flex-1 h-9 text-xs rounded-xl"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-9 text-xs rounded-xl"
                style={{ backgroundColor: "var(--accent-red)", color: "#fff" }}
              >
                {deleting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                {deleting ? "Eliminando…" : "Confirmar"}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              className="w-full flex items-center justify-center gap-1 text-xs py-1"
              style={{ color: "var(--accent-red)" }}
            >
              <Trash2 size={13} />
              Eliminar pago
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ─── Main Client Component ──────────────────────────────────────────────────

export function AlquilerClient({ initialPayments, initialMonth, initialYear }: AlquilerClientProps) {
  const router = useRouter();

  const [month,    setMonth]    = useState(initialMonth);
  const [year,     setYear]     = useState(initialYear);
  const [payments, setPayments] = useState<RentPayment[]>(initialPayments);
  const [loading,  setLoading]  = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<RentPayment | undefined>(undefined);

  const fetchPayments = useCallback(async (m: string, y: number) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/rent?month=${m}&year=${y}`);
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function navigate(dir: -1 | 1) {
    const idx     = MONTH_NAMES.indexOf(month);
    const newIdx  = idx + dir;
    let newMonth: string;
    let newYear   = year;
    if (newIdx < 0) {
      newMonth = MONTH_NAMES[11];
      newYear  = year - 1;
    } else if (newIdx > 11) {
      newMonth = MONTH_NAMES[0];
      newYear  = year + 1;
    } else {
      newMonth = MONTH_NAMES[newIdx];
    }
    setMonth(newMonth);
    setYear(newYear);
    fetchPayments(newMonth, newYear);
  }

  function openAdd() {
    setEditing(undefined);
    setShowForm(true);
  }

  function openEdit(p: RentPayment) {
    setEditing(p);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(undefined);
    // router.refresh() is called inside RentForm on success; also refetch local state
    fetchPayments(month, year);
  }

  const total = payments.reduce((sum, p) => {
    if (p.currency === "ARS") return sum + p.amount;
    if (p.currency === "USD" && p.amountArs) return sum + p.amountArs;
    return sum;
  }, 0);

  const monthLabel = month.charAt(0).toUpperCase() + month.slice(1);

  return (
    <>
      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {monthLabel} {year}
        </span>
        <button
          onClick={() => navigate(1)}
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Payment list */}
      <div
        className="rounded-2xl border overflow-hidden divide-y"
        style={{ borderColor: "var(--border)" }}
      >
        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        ) : payments.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Sin pagos este mes</p>
          </div>
        ) : (
          payments.map((p) => (
            <button
              key={p.id}
              onClick={() => openEdit(p)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left transition-opacity active:opacity-70"
              style={{ backgroundColor: "var(--bg-card)" }}
            >
              {/* Type badge */}
              <div
                className="flex-shrink-0 px-2 py-0.5 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: "var(--bg-elevated)", color: TYPE_COLORS[p.type] }}
              >
                {TYPE_LABELS[p.type]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {p.apartment}
                </p>
                {p.description && (
                  <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {p.description}
                  </p>
                )}
              </div>

              {/* Amount */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {p.currency === "USD" ? formatUSD(p.amount) : formatARS(p.amount)}
                </p>
                {p.currency === "USD" && p.amountArs && (
                  <p className="text-xs tabular-nums mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {formatARS(p.amountArs)}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Total */}
      {payments.length > 0 && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-2xl"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Total ARS</span>
          <span className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatARS(total)}
          </span>
        </div>
      )}

      {/* Floating add button */}
      <button
        onClick={openAdd}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-40"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
        aria-label="Agregar pago"
      >
        <Plus size={24} />
      </button>

      {/* Form modal */}
      {showForm && (
        <RentForm
          month={month}
          year={year}
          initial={editing}
          onClose={closeForm}
        />
      )}
    </>
  );
}
