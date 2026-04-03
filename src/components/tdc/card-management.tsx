"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Loader2, Plus, Trash2, X } from "lucide-react";
import { CardBrandIcon, cleanCardName } from "./card-brand";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface CardItem {
  id: string;
  name: string;
}

interface CardManagementProps {
  cards: CardItem[];
  onClose: () => void;
}

export function CardManagement({ cards: initial, onClose }: CardManagementProps) {
  const router = useRouter();
  const [cards, setCards] = useState<CardItem[]>(initial);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!newName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al guardar");
      }
      const card: CardItem = await res.json();
      setCards((prev) => [...prev, card].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al guardar");
      }
      const updated: CardItem = await res.json();
      setCards((prev) =>
        prev.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
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
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {cards.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: "var(--text-secondary)" }}>
              Sin tarjetas registradas
            </p>
          )}
          {cards.map((c) =>
            editId === c.id ? (
              <div key={c.id} className="flex gap-2 items-center">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEdit(c.id)}
                  autoFocus
                  className="flex-1 h-9 text-sm"
                  style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <button
                  onClick={() => handleEdit(c.id)}
                  disabled={loading}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                >
                  OK
                </button>
                <button onClick={() => setEditId(null)} style={{ color: "var(--text-secondary)" }}>
                  <X size={16} />
                </button>
              </div>
            ) : deleteId === c.id ? (
              <div
                key={c.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ backgroundColor: "var(--bg-elevated)" }}
              >
                <p className="flex-1 text-xs" style={{ color: "var(--text-primary)" }}>
                  ¿Eliminar <strong>{c.name}</strong>?
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
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ backgroundColor: "var(--bg-elevated)" }}
              >
                <CardBrandIcon name={c.name} size={24} showBank />
                {cleanCardName(c.name) && (
                  <p className="flex-1 text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {cleanCardName(c.name)}
                  </p>
                )}
                <button
                  onClick={() => { setEditId(c.id); setEditName(c.name); setError(null); }}
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
        <div className="flex gap-2 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
          <Input
            placeholder="Nueva tarjeta…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 h-9 text-sm"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <Button
            onClick={handleAdd}
            disabled={loading || !newName.trim()}
            className="h-9 px-3 rounded-xl font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
