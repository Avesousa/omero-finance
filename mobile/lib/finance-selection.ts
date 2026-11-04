/**
 * Un hogar anterior al backfill puede ser el default sin ser una membresía explícita.
 * Mandarlo en x-finance-id lo convierte en una selección que el servidor rechaza.
 * En ese caso mantener el acceso por defecto, sin header, hasta normalizar los datos.
 */
export function selectableFinanceId(response: {
  activeId: string;
  finances: readonly { id: string }[];
}): string | null {
  return response.finances.some((finance) => finance.id === response.activeId)
    ? response.activeId
    : null;
}

/** Ignora rechazos de pedidos anteriores a un cambio de finanza. */
export function isCurrentFinanceRequest(requestedId: string | null, activeId: string | null): boolean {
  return requestedId !== null && requestedId === activeId;
}
