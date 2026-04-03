"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const USERS = [
  { id: "cm_user_avelino", name: "Avelino", color: "#6366F1" },
  { id: "cm_user_maria",   name: "Maria",   color: "#EC4899" },
] as const;
type UserId = (typeof USERS)[number]["id"];

const INCOME_TYPES = [
  { value: "SUELDO",      label: "Sueldo" },
  { value: "FREELANCE",   label: "Freelance" },
  { value: "AHORROS",     label: "Ahorros" },
  { value: "PAGO_DEUDA",  label: "Pago deuda" },
  { value: "REMANENTES",  label: "Remanentes" },
  { value: "PRESTAMO",    label: "Préstamo" },
  { value: "INVERSION",   label: "Inversión" },
] as const;

interface IncomeFormProps {
  currentRate: number;
  onSubmit: (data: {
    userId: UserId;
    type: string;
    currency: "ARS" | "USD";
    amount: string;
    description: string;
  }) => Promise<void>;
}

export function IncomeForm({ currentRate, onSubmit }: IncomeFormProps) {
  const [userId, setUserId]       = useState<UserId>("cm_user_avelino");
  const [type, setType]           = useState("SUELDO");
  const [currency, setCurrency]   = useState<"ARS" | "USD">("ARS");
  const [amount, setAmount]       = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  const parsedAmount = parseFloat(amount);
  const arsEquivalent = currency === "USD" && !isNaN(parsedAmount)
    ? parsedAmount * currentRate
    : null;

  async function handleSubmit() {
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Ingresá un monto válido");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ userId, type, currency, amount, description });
      setAmount("");
      setDescription("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-4 border"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      {/* User selector */}
      <div className="flex gap-2">
        {USERS.map((u) => (
          <button
            key={u.id}
            onClick={() => setUserId(u.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium border transition-colors"
            style={{
              borderColor:     userId === u.id ? u.color : "var(--border)",
              backgroundColor: userId === u.id ? `${u.color}1A` : "var(--bg-elevated)",
              color:           userId === u.id ? u.color : "var(--text-secondary)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: u.color }}
            />
            {u.name}
          </button>
        ))}
      </div>

      {/* Type selector */}
      <div>
        <Label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
          Tipo de ingreso
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {INCOME_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={{
                borderColor:     type === t.value ? "var(--accent)" : "var(--border)",
                backgroundColor: type === t.value ? "rgba(99,102,241,0.12)" : "var(--bg-elevated)",
                color:           type === t.value ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Currency + Amount */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {(["ARS", "USD"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              style={{
                borderColor:     currency === c ? "var(--accent)" : "var(--border)",
                backgroundColor: currency === c ? "rgba(99,102,241,0.12)" : "var(--bg-elevated)",
                color:           currency === c ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            {currency === "ARS" ? "$" : "US$"}
          </span>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-8 text-lg font-semibold tabular-nums h-12"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {arsEquivalent !== null && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            ≈ {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(arsEquivalent)} al tipo de cambio actual
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <Input
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-sm"
          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
      </div>

      {error && <p className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={saving || success}
        className="w-full h-11 font-semibold rounded-xl"
        style={{
          backgroundColor: success ? "var(--accent-green)" : "var(--accent)",
          color: "var(--accent-foreground)",
        }}
      >
        {saving  && <Loader2 size={16} className="animate-spin mr-2" />}
        {success ? "✓ Ingreso registrado" : saving ? "Guardando…" : "Registrar ingreso"}
      </Button>
    </div>
  );
}
