/** Distingue una función todavía no disponible de una lista de cuentas vacía. */
export function accountErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : null;
  if (error && typeof error === "object" && "status" in error && error.status === 404 && (!message || message === "Algo salió mal. Intentá de nuevo.")) {
    return "La función Cuentas todavía no está disponible. No se puede crear una cuenta por ahora.";
  }
  if (message) return message;
  return "No pudimos cargar tus cuentas. Revisá tu conexión y volvé a intentar.";
}

export function accountCreationCurrency(value: unknown): "ARS" | "USD" {
  return value === "USD" ? "USD" : "ARS";
}
