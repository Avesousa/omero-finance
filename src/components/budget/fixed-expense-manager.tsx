"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Loader2, Plus, Trash2, X, Check, ToggleLeft, ToggleRight, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface FixedTemplate {
  id:       string;
  concept:  string;
  currency: "ARS" | "USD";
  amount:   number;
  isActive: boolean;
}

function fmt(n: number, currency: "ARS" | "USD" = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(n);
}

interface FixedExpenseManagerProps {
  initial: FixedTemplate[];
  month?: string;
  year?: number;
  hasExistingExpenses?: boolean;
}

export function FixedExpenseManager({ initial, month, year, hasExistingExpenses }: FixedExpenseManagerProps) {
  const router = useRouter();
  const [items, setItems]       = useState<FixedTemplate[]>(initial);
  const [editId, setEditId]     = useState<string | null>(null);
  const [editConcept, setEC]    = useState("");
  const [editAmount, setEA]     = useState("");
  const [editCurrency, setECur] = useState<"ARS" | "USD">("ARS");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newConcept, setNC]     = useState("");
  const [newAmount, setNA]      = useState("");
  const [newCurrency, setNCur]  = useState<"ARS" | "USD">("ARS");
  const [saving, setSaving]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const activeTotal = items
    .filter((t) => t.isActive)
    .reduce((s, t) => s + (t.currency === "ARS" ? t.amount : 0), 0);

  const activeTemplates = items.filter((t) => t.isActive);
  const showGenerateButton = month && year && !hasExistingExpenses && activeTemplates.length > 0;

  async function handleGenerate() {
    if (!month || !year) return;
    setGenerating(true);
    setGenerateMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/fixed-expenses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al generar");
      if (data.generated > 0) {
        setGenerateMsg(`Se generaron ${data.generated} gastos para ${month} ${year}`);
        router.refresh();
      } else {
        setGenerateMsg(data.message ?? "Sin cambios");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleAdd() {
    if (!newConcept.trim() || !newAmount) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/fixed-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept: newConcept, currency: newCurrency, amount: newAmount }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const t: FixedTemplate = await res.json();
      setItems((p) => [...p, t]);
      setNC(""); setNA(""); setNCur("ARS");
      router.refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleEdit(id: string) {
    if (!editConcept.trim() || !editAmount) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fixed-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept: editConcept, amount: editAmount, currency: editCurrency }),
      });
      if (!res.ok) throw new Error();
      const updated: FixedTemplate = await res.json();
      setItems((p) => p.map((t) => t.id === id ? updated : t));
      setEditId(null);
      router.refresh();
    } catch { setError("Error al guardar"); }
    finally { setSaving(false); }
  }

  async function handleToggle(id: string, isActive: boolean) {
    setItems((p) => p.map((t) => t.id === id ? { ...t, isActive } : t));
    await fetch(`/api/fixed-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    router.refresh();
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await fetch(`/api/fixed-templates/${id}`, { method: "DELETE" });
      setItems((p) => p.filter((t) => t.id !== id));
      setDeleteId(null);
      router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      {/* Total */}
      <div
        className="rounded-xl px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Total activos (ARS)
        </p>
        <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {fmt(activeTotal)}
        </p>
      </div>

      {/* List */}
      <div
        className="rounded-2xl border divide-y overflow-hidden"
        style={{ borderColor: "var(--border)" }}
      >
        {items.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: "var(--text-secondary)" }}>
            Sin gastos fijos configurados
          </p>
        )}

        {items.map((t) => (
          <div
            key={t.id}
            className="px-4 py-3"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", opacity: t.isActive ? 1 : 0.5 }}
          >
            {editId === t.id ? (
              /* ── Edit inline ── */
              <div className="space-y-2">
                <Input
                  value={editConcept}
                  onChange={(e) => setEC(e.target.value)}
                  className="h-9 text-sm"
                  style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <div className="flex gap-2">
                  <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                    {(["ARS", "USD"] as const).map((c) => (
                      <button key={c} onClick={() => setECur(c)}
                        className="px-2.5 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: editCurrency === c ? "var(--accent)" : "var(--bg-elevated)",
                          color: editCurrency === c ? "var(--accent-foreground)" : "var(--text-secondary)",
                        }}>{c}</button>
                    ))}
                  </div>
                  <Input
                    type="number" value={editAmount} onChange={(e) => setEA(e.target.value)}
                    className="flex-1 h-9 text-sm"
                    style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                  <button onClick={() => handleEdit(t.id)} disabled={saving}
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ backgroundColor: "var(--accent-green)", color: "#fff" }}>
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  </button>
                  <button onClick={() => setEditId(null)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    <X size={13} />
                  </button>
                </div>
              </div>
            ) : deleteId === t.id ? (
              /* ── Delete confirm ── */
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs" style={{ color: "var(--text-primary)" }}>
                  ¿Eliminar <strong>{t.concept}</strong>?
                </p>
                <button onClick={() => handleDelete(t.id)} disabled={saving}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                  style={{ backgroundColor: "var(--accent-red)", color: "#fff" }}>
                  Sí
                </button>
                <button onClick={() => setDeleteId(null)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  No
                </button>
              </div>
            ) : (
              /* ── Normal row ── */
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(t.id, !t.isActive)}
                  style={{ color: t.isActive ? "var(--accent-green)" : "var(--text-secondary)", flexShrink: 0 }}>
                  {t.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>
                <p className="flex-1 text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {t.concept}
                </p>
                <p className="text-sm tabular-nums font-semibold flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                  {fmt(t.amount, t.currency)}
                </p>
                <button onClick={() => { setEditId(t.id); setEC(t.concept); setEA(String(t.amount)); setECur(t.currency); setError(null); }}
                  style={{ color: "var(--text-secondary)", flexShrink: 0 }}>
                  <Edit2 size={14} />
                </button>
                <button onClick={() => { setDeleteId(t.id); setError(null); }}
                  style={{ color: "var(--accent-red)", flexShrink: 0 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>}

      {/* Generate from templates */}
      {showGenerateButton && (
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Generar gastos de {month} {year}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Crea un registro por cada plantilla activa ({activeTemplates.length})
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="h-9 px-3 rounded-xl flex items-center gap-1.5 flex-shrink-0"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {generating
              ? <Loader2 size={14} className="animate-spin" />
              : <Sparkles size={14} />}
            <span className="text-xs font-semibold">
              {generating ? "Generando…" : "Generar"}
            </span>
          </Button>
        </div>
      )}

      {generateMsg && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{generateMsg}</p>
      )}

      {/* Add new */}
      <div
        className="rounded-2xl border p-4 space-y-3"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          Agregar gasto fijo
        </p>
        <Input
          placeholder="Nombre (ej. Internet)"
          value={newConcept}
          onChange={(e) => setNC(e.target.value)}
          className="h-9 text-sm"
          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <div className="flex gap-2">
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            {(["ARS", "USD"] as const).map((c) => (
              <button key={c} onClick={() => setNCur(c)}
                className="px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: newCurrency === c ? "var(--accent)" : "var(--bg-elevated)",
                  color: newCurrency === c ? "var(--accent-foreground)" : "var(--text-secondary)",
                }}>{c}</button>
            ))}
          </div>
          <Input
            type="number" inputMode="decimal" placeholder="Monto"
            value={newAmount} onChange={(e) => setNA(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 h-9 text-sm"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <Button onClick={handleAdd} disabled={saving || !newConcept.trim() || !newAmount}
            className="h-9 px-3 rounded-xl"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
