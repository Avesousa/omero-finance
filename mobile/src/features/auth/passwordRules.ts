/** Largo mínimo de la clave nueva (el mismo que valida el servidor). */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordIssue = "missing" | "tooShort" | "mismatch";

/** Valida la clave nueva y su repetición antes de llamar al servidor. `null` = todo bien. */
export function validateNewPassword(next: string, confirm: string): PasswordIssue | null {
  if (!next || !confirm) return "missing";
  if (next.length < MIN_PASSWORD_LENGTH) return "tooShort";
  if (next !== confirm) return "mismatch";
  return null;
}
