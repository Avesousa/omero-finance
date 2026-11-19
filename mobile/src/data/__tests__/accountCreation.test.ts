import test from "node:test";
import assert from "node:assert/strict";
import { accountCreationCurrency, accountErrorMessage } from "../../features/accounts/account-errors.ts";

test("Cuentas no publicada: explica el 404 sin afirmar que la lista está vacía", () => {
  const error = Object.assign(new Error("Algo salió mal. Intentá de nuevo."), { status: 404 });
  assert.equal(accountErrorMessage(error), "La función Cuentas todavía no está disponible. No se puede crear una cuenta por ahora.");
});

test("errores de permisos o conexión conservan su explicación", () => {
  assert.equal(accountErrorMessage(new Error("Solo podés ver.")), "Solo podés ver.");
  assert.equal(accountErrorMessage(Object.assign(new Error("No encontrado"), { status: 404 })), "No encontrado");
  assert.equal(accountErrorMessage(null), "No pudimos cargar tus cuentas. Revisá tu conexión y volvé a intentar.");
});

test("la creación desde el selector conserva la moneda elegida", () => {
  assert.equal(accountCreationCurrency("USD"), "USD");
  assert.equal(accountCreationCurrency("ARS"), "ARS");
  assert.equal(accountCreationCurrency(undefined), "ARS");
  assert.equal(accountCreationCurrency("EUR"), "ARS");
});
