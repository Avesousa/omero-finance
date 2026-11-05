import { ApiError } from "./api-error";

/** Estado del cobro del movimiento actual; nunca se copia a la regla recurrente. */
export function incomeCollection(
  body: { isDone?: unknown; collectedAt?: unknown },
  current: { isDone: boolean; collectedAt: Date | null },
  today: string,
): { isDone: boolean; collectedAt: Date | null } {
  if (body.isDone !== undefined && typeof body.isDone !== "boolean") throw new ApiError("Estado de cobro inválido");
  const isDone = body.isDone === undefined ? current.isDone : body.isDone;
  if (!isDone) {
    if (body.collectedAt != null) throw new ApiError("Confirmá el cobro para guardar su fecha");
    return { isDone: false, collectedAt: null };
  }
  const raw = body.collectedAt === undefined ? (current.collectedAt?.toISOString().slice(0, 10) ?? today) : body.collectedAt;
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new ApiError("Elegí la fecha de cobro");
  const date = new Date(`${raw}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw || raw > today) throw new ApiError("Fecha de cobro inválida");
  return { isDone: true, collectedAt: date };
}
