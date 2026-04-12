"use client";

import { useState } from "react";
import { Plus, Loader2, X, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type SavingType = "AHORRO" | "VIAJE" | "INVERSION";
type Currency   = "ARS" | "USD";

interface Saving {
  id:                 string;
  date:               string;
  description:        string;
  type:               SavingType;
  currency:           Currency;
  amount:             number;
  amountArs:          number | null;
  dollarRateSnapshot: number | null;
  platform:           string | null;
  createdAt:          string;
}

interface AhorrosClientProps {
  initial:     Saving[];
  currentYear: number;
}

const TYPE_LABELS: Record<SavingType, string> = {
  AHORRO:    "Ahorro",
  VIAJE:     "Viaje",
  INVERSION: "Inversión",
};

const TYPE_COLORS: Record<SavingType, string> = {
  AHORRO:    "var(--accent)",
  VIAJE:     "var(--accent-red)",
  INVERSION: "#10b981",
};

function formatCurrency(amount: number, currency: Currency) {
  if (currency === "USD") {
    return `U$D ${amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$ ${amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

interface SavingFormProps {
  initial?: Saving;
  onClose:  () => void;
}

function SavingForm({ initial, onClose }: SavingFormProps) {
  const router    = useRouter();
  const isEditing = !!initial;

  const today = new Date().toISOString().slice(0, 10);

  const [date,        setDate]        = useState(initial ? initial.date.slice(0, 10) : today);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type,        setType]        = useState<SavingType>(initial?.type ?? "AHORRO");
  const [currency,    setCurrency]    = useState<Currency>(initial?.currency ?? "ARS");
  const [amount,      setAmount]      = useState(initial ? String(initial.amount) : "");
  const [platform,    setPlatform]    = useState(initial?.platform ?? "");
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSave() {
    if (!date || !description.trim() || !amount) {
      setError("Completá fecha, descripción y monto");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url    = isEditing ? `/api/savings/${initial!.id}` : "/api/savings";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, description, type, currency, amount, platform: platform || undefined }),
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
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/savings/${initial!.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al eliminar");
      }
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
            {isEditing ? "Editar ahorro" : "Nuevo ahorro"}
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

        {/* Description */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Descripción</Label>
          <Input
            placeholder="Ej: Dólar blue, Fondo emergencia…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Type */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as SavingType)}>
            <SelectTrigger style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AHORRO">Ahorro</SelectItem>
              <SelectItem value="VIAJE">Viaje</SelectItem>
              <SelectItem value="INVERSION">Inversión</SelectItem>
            </SelectContent>
          </Select>
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

        {/* Platform */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Plataforma (opcional)</Label>
          <Input
            placeholder="Ej: Mercado Pago, Brubank…"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
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
          {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Agregar ahorro"}
        </Button>

        {isEditing && (
          <button
            onClick={handleDelete}
            disabled={saving || deleting}
            className="w-full h-10 text-sm font-medium rounded-xl flex items-center justify-center gap-2"
            style={{ color: "var(--accent-red)", border: "1px solid var(--accent-red)" }}
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {confirmDel ? "¿Confirmar eliminación?" : "Eliminar"}
          </button>
        )}
      </div>
    </div>
  );
}

export function AhorrosClient({ initial, currentYear }: AhorrosClientProps) {
  const [year,        setYear]        = useState(currentYear);
  const [savings,     setSavings]     = useState<Saving[]>(initial);
  const [loading,     setLoading]     = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [editTarget,  setEditTarget]  = useState<Saving | null>(null);

  async function loadYear(y: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/savings?year=${y}`);
      if (res.ok) {
        const data = await res.json();
        setSavings(data);
      }
    } finally {
      setLoading(false);
    }
    setYear(y);
  }

  function handleYearChange(y: number) {
    if (y === year) return;
    loadYear(y);
  }

  function openEdit(s: Saving) {
    setEditTarget(s);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditTarget(null);
    // Reload data after mutation
    loadYear(year);
  }

  // Totals by type
  const totals = savings.reduce<Record<SavingType, number>>(
    (acc, s) => {
      // For USD entries, try to use amountArs for total, else amount (approximate)
      const arsValue = s.currency === "ARS" ? s.amount : (s.amountArs ?? s.amount);
      acc[s.type] = (acc[s.type] ?? 0) + arsValue;
      return acc;
    },
    { AHORRO: 0, VIAJE: 0, INVERSION: 0 }
  );

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Year selector */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {AVAILABLE_YEARS.map((y) => (
          <button
            key={y}
            onClick={() => handleYearChange(y)}
            className="px-4 py-1.5 rounded-full text-sm font-medium flex-shrink-0 transition-colors"
            style={{
              backgroundColor: y === year ? "var(--accent)" : "var(--bg-elevated)",
              color:           y === year ? "var(--accent-foreground)" : "var(--text-secondary)",
            }}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Totals summary */}
      <div
        className="rounded-2xl p-4 grid grid-cols-3 gap-3"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {(["AHORRO", "VIAJE", "INVERSION"] as SavingType[]).map((t) => (
          <div key={t} className="flex flex-col gap-1">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full self-start"
              style={{ backgroundColor: TYPE_COLORS[t] + "22", color: TYPE_COLORS[t] }}
            >
              {TYPE_LABELS[t]}
            </span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              $ {totals[t].toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
        <div className="col-span-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Total {year}</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              $ {grandTotal.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
        </div>
      ) : savings.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No hay ahorros registrados en {year}
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl border divide-y overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          {savings.map((s) => (
            <button
              key={s.id}
              onClick={() => openEdit(s)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-opacity active:opacity-70"
              style={{ backgroundColor: "var(--bg-card)" }}
            >
              {/* Date */}
              <div className="w-12 flex-shrink-0 text-center">
                <p className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  {formatDate(s.date)}
                </p>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {s.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[s.type] + "22", color: TYPE_COLORS[s.type] }}
                  >
                    {TYPE_LABELS[s.type]}
                  </span>
                  {s.platform && (
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {s.platform}
                    </span>
                  )}
                </div>
              </div>

              {/* Amount */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatCurrency(s.amount, s.currency)}
                </p>
                {s.currency === "USD" && s.amountArs != null && (
                  <p className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    $ {s.amountArs.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </p>
                )}
              </div>

              <Pencil size={14} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setEditTarget(null); setShowForm(true); }}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
      >
        <Plus size={24} />
      </button>

      {/* Modal */}
      {showForm && (
        <SavingForm
          initial={editTarget ?? undefined}
          onClose={closeForm}
        />
      )}
    </div>
  );
}
