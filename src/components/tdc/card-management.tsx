"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Loader2, Plus, Trash2, X } from "lucide-react";
import { CardBrandIcon } from "./card-brand";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface CardItem {
  id: string;
  name: string;
  entity: string | null;
  cardType: string | null;
  ownerName: string | null;
}

export function cardDisplayLabel(card: { entity?: string | null; cardType?: string | null; ownerName?: string | null; name: string }): string {
  if (card.entity && card.cardType && card.ownerName) {
    return `${card.entity} · ${card.cardType} · ${card.ownerName}`;
  }
  return card.name;
}

const PRESET_ENTITIES = [
  "Banco Nación",
  "MercadoPago",
  "Galicia",
  "BBVA",
  "Cencopay",
  "Brubank",
  "Naranja X",
  "HSBC",
  "Otro",
];

const CARD_TYPES = ["VISA", "MC", "AMEX"] as const;
type CardTypeLiteral = typeof CARD_TYPES[number];

interface CardManagementProps {
  cards: CardItem[];
  onClose: () => void;
}

interface NewCardState {
  entity: string;
  customEntity: string;
  cardType: CardTypeLiteral | "";
  ownerName: string;
}

const EMPTY_FORM: NewCardState = { entity: "", customEntity: "", cardType: "", ownerName: "" };

export function CardManagement({ cards: initial, onClose }: CardManagementProps) {
  const router = useRouter();
  const [cards, setCards] = useState<CardItem[]>(initial);
  const [form, setForm] = useState<NewCardState>(EMPTY_FORM);
  const [editId, setEditId]   = useState<string | null>(null);
  const [editForm, setEditForm] = useState<NewCardState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  function resolveEntity(f: NewCardState) {
    return f.entity === "Otro" ? f.customEntity.trim() : f.entity;
  }

  function isValid(f: NewCardState) {
    return !!resolveEntity(f) && !!f.cardType && !!f.ownerName.trim();
  }

  async function handleAdd() {
    if (!isValid(form)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity:    resolveEntity(form),
          cardType:  form.cardType,
          ownerName: form.ownerName.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al guardar");
      }
      const card: CardItem = await res.json();
      setCards((prev) => [...prev, card].sort((a, b) => cardDisplayLabel(a).localeCompare(cardDisplayLabel(b))));
      setForm(EMPTY_FORM);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(id: string) {
    if (!isValid(editForm)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity:    resolveEntity(editForm),
          cardType:  editForm.cardType,
          ownerName: editForm.ownerName.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al guardar");
      }
      const updated: CardItem = await res.json();
      setCards((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
            .sort((a, b) => cardDisplayLabel(a).localeCompare(cardDisplayLabel(b)))
      );
      setEditId(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      await fetch(`/api/cards/${id}`, { method: "DELETE" });
      setCards((prev) => prev.filter((c) => c.id !== id));
      setDeleteId(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function startEdit(c: CardItem) {
    const entityIsPreset = c.entity && PRESET_ENTITIES.includes(c.entity) && c.entity !== "Otro";
    setEditForm({
      entity:       entityIsPreset ? (c.entity ?? "") : (c.entity ? "Otro" : ""),
      customEntity: entityIsPreset ? "" : (c.entity ?? ""),
      cardType:     (c.cardType as CardTypeLiteral | "") ?? "",
      ownerName:    c.ownerName ?? "",
    });
    setEditId(c.id);
    setError(null);
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
            Mis tarjetas
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Card list */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {cards.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: "var(--text-secondary)" }}>
              Sin tarjetas registradas
            </p>
          )}
          {cards.map((c) =>
            editId === c.id ? (
              <div key={c.id} className="space-y-2 p-3 rounded-xl" style={{ backgroundColor: "var(--bg-elevated)" }}>
                <CardFormFields form={editForm} onChange={setEditForm} />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(c.id)}
                    disabled={loading || !isValid(editForm)}
                    className="flex-1 text-xs font-semibold py-1.5 rounded-lg"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                  >
                    {loading ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Guardar"}
                  </button>
                  <button onClick={() => setEditId(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "var(--text-secondary)" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : deleteId === c.id ? (
              <div
                key={c.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ backgroundColor: "var(--bg-elevated)" }}
              >
                <p className="flex-1 text-xs" style={{ color: "var(--text-primary)" }}>
                  ¿Eliminar <strong>{cardDisplayLabel(c)}</strong>?
                </p>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={loading}
                  className="text-xs font-semibold px-2 py-1 rounded-lg"
                  style={{ backgroundColor: "var(--accent-red)", color: "#fff" }}
                >
                  Sí
                </button>
                <button
                  onClick={() => setDeleteId(null)}
                  className="text-xs px-2 py-1 rounded-lg border"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  No
                </button>
              </div>
            ) : (
              <div
                key={c.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: "var(--bg-elevated)" }}
              >
                <CardBrandIcon cardType={c.cardType} entity={null} size={22} showBank={false} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {c.entity ?? c.name}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {[c.cardType, c.ownerName].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  onClick={() => startEdit(c)}
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => { setDeleteId(c.id); setError(null); }}
                  style={{ color: "var(--accent-red)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          )}
        </div>

        {error && <p className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>}

        {/* Add new card */}
        <div className="space-y-3 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: "var(--text-secondary)" }}>
            Nueva tarjeta
          </p>
          <CardFormFields form={form} onChange={setForm} />
          <Button
            onClick={handleAdd}
            disabled={loading || !isValid(form)}
            className="w-full h-9 rounded-xl font-semibold text-sm"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
            Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-form component (reused for add + edit) ─────────────────────

function CardFormFields({ form, onChange }: {
  form: NewCardState;
  onChange: (f: NewCardState) => void;
}) {
  return (
    <div className="space-y-2">
      {/* Entity */}
      <Select
        value={form.entity}
        onValueChange={(v) => onChange({ ...form, entity: v ?? "", customEntity: "" })}
      >
        <SelectTrigger
          className="w-full h-9 text-sm"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <SelectValue placeholder="Entidad (banco / billetera)" />
        </SelectTrigger>
        <SelectContent>
          {PRESET_ENTITIES.map((e) => (
            <SelectItem key={e} value={e}>{e}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {form.entity === "Otro" && (
        <Input
          placeholder="Nombre de la entidad"
          value={form.customEntity}
          onChange={(e) => onChange({ ...form, customEntity: e.target.value })}
          className="h-9 text-sm"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
      )}

      {/* Card type */}
      <div className="flex gap-2">
        {CARD_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ ...form, cardType: t })}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
            style={{
              borderColor:     form.cardType === t ? "var(--accent)" : "var(--border)",
              backgroundColor: form.cardType === t ? "rgba(99,102,241,0.1)" : "var(--bg-elevated)",
              color:           form.cardType === t ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            <CardBrandIcon cardType={t} size={12} showBank={false} />
            {t}
          </button>
        ))}
      </div>

      {/* Owner */}
      <Input
        placeholder="Dueño (ej: María, Avelino…)"
        value={form.ownerName}
        onChange={(e) => onChange({ ...form, ownerName: e.target.value })}
        className="h-9 text-sm"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }}
      />
    </div>
  );
}
