"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TDC_KEY, type CategoryDTO, type Kind } from "@/lib/plan/core";
import {
  ErrorText, Field, ListCard, Pill, PlanHeader, PrimaryButton, SecondaryButton, SectionTitle, Sheet,
  TextInput, api, useAction,
} from "./plan-ui";

export function CategoriesClient({ categories }: { categories: CategoryDTO[] }) {
  const [editing, setEditing] = useState<CategoryDTO | null>(null);

  return (
    <>
      <PlanHeader title="Categorías" backHref="/plan/mas" />
      <Group kind="EXPENSE" title="De gastos" categories={categories} onEdit={setEditing} />
      <Group kind="INCOME" title="De ingresos" categories={categories} onEdit={setEditing} />
      {editing && <CategorySheet category={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Group({ kind, title, categories, onEdit }: {
  kind: Kind;
  title: string;
  categories: CategoryDTO[];
  onEdit: (c: CategoryDTO) => void;
}) {
  const action = useAction();
  const [name, setName] = useState("");

  const list = categories.filter((c) => c.kind === kind);
  const active = list.filter((c) => !c.isArchived);
  const hidden = list.filter((c) => c.isArchived);

  function add() {
    if (!name.trim()) return;
    return action.run(() => api("POST", "/api/plan/categories", { kind, name: name.trim() }), () => setName(""));
  }

  return (
    <section className="space-y-2">
      <SectionTitle>{title}</SectionTitle>
      <ListCard>
        {active.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onEdit(c)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>{c.name}</span>
            {c.systemKey === TDC_KEY && <Pill tone="accent">se llena con los resúmenes</Pill>}
          </button>
        ))}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <TextInput
            aria-label={`Nueva categoría ${title.toLowerCase()}`}
            placeholder="Nueva categoría…"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button
            type="button"
            onClick={add}
            disabled={action.busy || !name.trim()}
            aria-label="Agregar categoría"
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            <Plus size={18} />
          </button>
        </div>
      </ListCard>
      <ErrorText error={action.error} />
      {hidden.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Ocultas:</span>
          {hidden.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onEdit(c)}
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CategorySheet({ category, onClose }: { category: CategoryDTO; onClose: () => void }) {
  const action = useAction();
  const [name, setName] = useState(category.name);
  const isSystem = !!category.systemKey;

  return (
    <Sheet title="Editar categoría" onClose={onClose}>
      <Field label="Nombre">
        <TextInput aria-label="Nombre" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <ErrorText error={action.error} />
      <PrimaryButton
        busy={action.busy}
        onClick={() => {
          if (!name.trim()) return action.setError("Ponele un nombre");
          return action.run(() => api("PATCH", `/api/plan/categories/${category.id}`, { name: name.trim() }), onClose);
        }}
      >
        Guardar
      </PrimaryButton>
      {!isSystem && (
        <div className="flex gap-2">
          {category.isArchived ? (
            <SecondaryButton
              disabled={action.busy}
              onClick={() => action.run(() => api("PATCH", `/api/plan/categories/${category.id}`, { isArchived: false }), onClose)}
            >
              Volver a mostrar
            </SecondaryButton>
          ) : (
            <SecondaryButton
              tone="danger"
              disabled={action.busy}
              onClick={() => action.run(() => api("DELETE", `/api/plan/categories/${category.id}`), onClose)}
            >
              Quitar categoría
            </SecondaryButton>
          )}
        </div>
      )}
      {!isSystem && !category.isArchived && (
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Si ya la usaste, se oculta en vez de borrarse para no perder el historial.
        </p>
      )}
    </Sheet>
  );
}
