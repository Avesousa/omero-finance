"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

const KNOWN_CARDS = [
  "VISA MARIA BBVA",
  "VISA MARIA CP",
  "VISA AVELINO BN",
  "MC AVELINO BN",
  "VISA AVELINO BK",
  "MC AVELINO MP",
];

interface StatementFormProps {
  month: string;
  year: number;
  onClose: () => void;
  /** If provided, we're editing an existing statement */
  initial?: {
    id: string;
    cardName: string;
    totalAmountArs: number;
    dueDate: string;
    minimumPayment?: number;
  };
}

export function StatementForm({ month, year, onClose, initial }: StatementFormProps) {
  const router    = useRouter();
  const isEditing = !!initial;

  // Default due date: 10th of next month
  function defaultDue() {
    const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const idx    = MONTHS.indexOf(month);
    const nextM  = (idx + 1) % 12;
    const nextY  = idx === 11 ? year + 1 : year;
    return `${nextY}-${String(nextM + 1).padStart(2, "0")}-10`;
  }

  const [cardName, setCardName]   = useState(initial?.cardName ?? "");
  const [customCard, setCustomCard] = useState(
    initial?.cardName && !KNOWN_CARDS.includes(initial.cardName) ? initial.cardName : ""
  );
  const [amount, setAmount]       = useState(initial ? String(initial.totalAmountArs) : "");
  const [dueDate, setDueDate]     = useState(
    initial ? initial.dueDate.slice(0, 10) : defaultDue()
  );
  const [minPayment, setMinPayment] = useState(initial?.minimumPayment ? String(initial.minimumPayment) : "");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const effectiveCard = cardName === "__custom__" ? customCard : cardName;

  async function handleSave() {
    if (!effectiveCard || !amount || !dueDate) {
      setError("Completá tarjeta, monto y fecha de vencimiento");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url    = isEditing ? `/api/tdc/${initial!.id}` : "/api/tdc";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardName:      effectiveCard,
          totalAmountArs: amount,
          dueDate,
          minimumPayment: minPayment || undefined,
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
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl p-5 space-y-4"
        style={{ backgroundColor: "var(--bg-card)", borderTop: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {isEditing ? "Editar resumen" : "Nuevo resumen"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Card selector */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Tarjeta</Label>
          <Select value={cardName} onValueChange={(v) => setCardName(v ?? "")} disabled={isEditing}>
            <SelectTrigger style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <SelectValue placeholder="Seleccioná una tarjeta" />
            </SelectTrigger>
            <SelectContent>
              {KNOWN_CARDS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              <SelectItem value="__custom__">Otra tarjeta…</SelectItem>
            </SelectContent>
          </Select>
          {cardName === "__custom__" && (
            <Input
              className="mt-2"
              placeholder="Nombre de la tarjeta"
              value={customCard}
              onChange={(e) => setCustomCard(e.target.value)}
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          )}
        </div>

        {/* Amount */}
        <div>
          <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Monto total a pagar (ARS)</Label>
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

        {/* Due date + minimum */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Vencimiento</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="w-36">
            <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Pago mín. (opcional)</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={minPayment}
              onChange={(e) => setMinPayment(e.target.value)}
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
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
          {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Agregar resumen"}
        </Button>
      </div>
    </div>
  );
}
