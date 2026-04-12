"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2, X } from "lucide-react";
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

const INCOME_TYPES = [
  { value: "SUELDO",      label: "Sueldo" },
  { value: "FREELANCE",   label: "Freelance" },
  { value: "AHORROS",     label: "Ahorros" },
  { value: "PAGO_DEUDA",  label: "Pago de deuda" },
  { value: "REMANENTES",  label: "Remanentes" },
  { value: "PRESTAMO",    label: "Préstamo" },
  { value: "INVERSION",   label: "Inversión" },
] as const;

type IncomeTypeValue = (typeof INCOME_TYPES)[number]["value"];

export interface IncomeItem {
  id:                 string;
  type:               string;
  currency:           "ARS" | "USD";
  amount:             number;
  amountArs:          number | null;
  dollarRateSnapshot: number | null;
  description:        string | null;
  isPersonal:         boolean;
  month:              string;
  year:               number;
  createdById:        string;
  createdAt:          string;
}

interface IngresosClientProps {
  initialIncomes: IncomeItem[];
  initialMonth:   string;
  initialYear:    number;
}

function typeLabel(type: string) {
  return INCOME_TYPES.find((t) => t.value === type)?.label ?? type;
}

function formatArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style:                 "currency",
    currency:              "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatAmount(item: IncomeItem) {
  if (item.currency === "USD") {
    return `USD ${item.amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return formatArs(item.amount);
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface IncomeFormProps {
  month:   string;
  year:    number;
  initial?: IncomeItem;
  onClose: () => void;
}

function IncomeForm({ month, year, initial, onClose }: IncomeFormProps) {
  const router    = useRouter();
  const isEditing = !!initial;

  const [type,        setType]        = useState<IncomeTypeValue | "">((initial?.type as IncomeTypeValue) ?? "");
  const [currency,    setCurrency]    = useState<"ARS" | "USD">(initial?.currency ?? "ARS");
  const [amount,      setAmount]      = useState(initial ? String(initial.amount) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isPersonal,  setIsPersonal]  = useState(initial?.isPersonal ?? false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSave() {
    if (!type || !amount) {
      setError("Completá tipo y monto");
      return;
    }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Monto inválido");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url    = isEditing ? `/api/income/${initial!.id}` : "/api/income";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          currency,
          amount:      parsed,
          description: description || undefined,
          isPersonal,
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
            {isEditing ? "Editar ingreso" : "Nuevo ingreso"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Type */}
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Tipo</Label>
          <Select value={type || "__none__"} onValueChange={(v) => setType(v === "__none__" ? "" : (v as IncomeTypeValue))}>
            <SelectTrigger
              className="w-full"
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <SelectValue placeholder="Seleccioná un tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" disabled>Seleccioná un tipo</SelectItem>
              {INCOME_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Currency toggle */}
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Moneda</Label>
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {(["ARS", "USD"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className="flex-1 py-2 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: currency === c ? "var(--accent)" : "var(--bg-elevated)",
                  color:           currency === c ? "var(--accent-foreground)" : "var(--text-secondary)",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>
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

        {/* Description */}
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Descripción (opcional)</Label>
          <Input
            type="text"
            placeholder="Ej: sueldo febrero"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* isPersonal */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setIsPersonal(!isPersonal)}
            className="w-9 h-5 rounded-full relative transition-colors"
            style={{ backgroundColor: isPersonal ? "var(--accent)" : "var(--border)" }}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
              style={{
                backgroundColor: "#fff",
                transform: isPersonal ? "translateX(18px)" : "translateX(2px)",
              }}
            />
          </div>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Ingreso personal (no compartido)
          </span>
        </label>

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
          {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Agregar ingreso"}
        </Button>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  income:  IncomeItem;
  onClose: () => void;
}

function DeleteConfirm({ income, onClose }: DeleteConfirmProps) {
  const router  = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/income/${income.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al eliminar");
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
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
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Eliminar ingreso
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          ¿Eliminás{" "}
          <span style={{ color: "var(--text-primary)" }}>{typeLabel(income.type)}</span>{" "}
          de {formatAmount(income)}?
        </p>
        {error && (
          <p className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>
        )}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 h-11 font-semibold rounded-xl"
            style={{ backgroundColor: "var(--accent-red)", color: "#fff" }}
          >
            {deleting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function IngresosClient({ initialIncomes, initialMonth, initialYear }: IngresosClientProps) {
  const router = useRouter();

  const [month,   setMonth]   = useState(initialMonth);
  const [year,    setYear]    = useState(initialYear);
  const [incomes, setIncomes] = useState<IncomeItem[]>(initialIncomes);
  const [loading, setLoading] = useState(false);

  const [showAdd,    setShowAdd]    = useState(false);
  const [editItem,   setEditItem]   = useState<IncomeItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<IncomeItem | null>(null);

  async function fetchIncomes(m: string, y: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/income?month=${m}&year=${y}`);
      if (res.ok) {
        const data = await res.json();
        setIncomes(data);
      }
    } finally {
      setLoading(false);
    }
  }

  function navigate(delta: number) {
    const idx     = MONTH_NAMES.indexOf(month);
    const newIdx  = idx + delta;
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
    fetchIncomes(newMonth, newYear);
  }

  function handleModalClose() {
    setShowAdd(false);
    setEditItem(null);
    setDeleteItem(null);
    // Refresh list after create/edit/delete
    fetchIncomes(month, year);
  }

  const household = incomes.filter((i) => !i.isPersonal);
  const personal  = incomes.filter((i) =>  i.isPersonal);

  const totalArs = incomes.reduce((sum, i) => {
    return sum + (i.amountArs ?? (i.currency === "ARS" ? i.amount : 0));
  }, 0);

  return (
    <>
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold capitalize" style={{ color: "var(--text-primary)" }}>
          {month} {year}
        </span>
        <button
          onClick={() => navigate(1)}
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Total */}
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Total ARS del mes</p>
        <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {loading ? "…" : formatArs(totalArs)}
        </p>
      </div>

      {/* Income list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
        </div>
      ) : incomes.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: "var(--text-secondary)" }}>
          No hay ingresos registrados para {month} {year}.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {household.length > 0 && (
            <section>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Hogar
              </p>
              <div
                className="rounded-2xl border divide-y overflow-hidden"
                style={{ borderColor: "var(--border)" }}
              >
                {household.map((item) => (
                  <IncomeRow key={item.id} item={item} onEdit={setEditItem} onDelete={setDeleteItem} />
                ))}
              </div>
            </section>
          )}
          {personal.length > 0 && (
            <section>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Personal
              </p>
              <div
                className="rounded-2xl border divide-y overflow-hidden"
                style={{ borderColor: "var(--border)" }}
              >
                {personal.map((item) => (
                  <IncomeRow key={item.id} item={item} onEdit={setEditItem} onDelete={setDeleteItem} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Floating add button */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
      >
        <Plus size={24} />
      </button>

      {/* Modals */}
      {showAdd && (
        <IncomeForm month={month} year={year} onClose={handleModalClose} />
      )}
      {editItem && (
        <IncomeForm month={month} year={year} initial={editItem} onClose={handleModalClose} />
      )}
      {deleteItem && (
        <DeleteConfirm income={deleteItem} onClose={handleModalClose} />
      )}
    </>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

interface IncomeRowProps {
  item:     IncomeItem;
  onEdit:   (item: IncomeItem) => void;
  onDelete: (item: IncomeItem) => void;
}

function IncomeRow({ item, onEdit, onDelete }: IncomeRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="px-4 py-3 cursor-pointer"
      style={{ backgroundColor: "var(--bg-card)" }}
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center gap-3">
        {/* Type badge */}
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--accent)" }}
        >
          {typeLabel(item.type)}
        </span>

        {/* Description */}
        <span className="flex-1 text-sm truncate" style={{ color: "var(--text-secondary)" }}>
          {item.description || ""}
        </span>

        {/* Amount */}
        <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--text-primary)" }}>
          {formatAmount(item)}
        </span>
      </div>

      {/* Expanded actions */}
      {open && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(item); }}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg"
            style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
          >
            Editar
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(item); }}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg"
            style={{ backgroundColor: "var(--bg-elevated)", color: "var(--accent-red)" }}
          >
            Eliminar
          </button>
        </div>
      )}

      {/* ARS equivalent for USD items */}
      {item.currency === "USD" && item.amountArs != null && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          ≈ {formatArs(item.amountArs)}
          {item.dollarRateSnapshot ? ` (USD 1 = $${item.dollarRateSnapshot.toLocaleString("es-AR")})` : ""}
        </p>
      )}
    </div>
  );
}
