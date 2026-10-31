import type { EntryDraft } from "../../../domain/index.ts";
import { todayIso } from "../../../domain/index.ts";
import type { NewEntryInput } from "../../../data/types.ts";

/** Un borrador se puede confirmar directo si tiene monto mayor a cero y (nombre o categoría). */
export function isDraftComplete(draft: EntryDraft): boolean {
  const hasAmount = draft.amount != null && Number.isFinite(draft.amount) && draft.amount > 0;
  const hasLabel = !!draft.name?.trim() || !!draft.categoryId;
  return hasAmount && hasLabel;
}

/**
 * Lo que se guarda al confirmar un borrador completo. Si falta el nombre se usa el de la categoría
 * (`categoryName`); devuelve null si el borrador no está completo o no hay de dónde sacar un nombre.
 */
export function draftToEntryInput(draft: EntryDraft, categoryName?: string | null, today: string = todayIso()): NewEntryInput | null {
  if (!isDraftComplete(draft) || draft.amount == null) return null;
  const name = draft.name?.trim() || categoryName?.trim();
  if (!name) return null;
  const date = draft.date ?? null;
  return {
    kind: draft.kind,
    period: (date ?? today).slice(0, 7),
    name,
    amount: draft.amount,
    currency: draft.currency,
    categoryId: draft.categoryId,
    date,
    note: draft.note?.trim() || null,
    fixed: draft.fixed ? { frequency: draft.fixed.frequency ?? "MONTHLY" } : null,
  };
}
