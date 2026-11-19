import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "../passwordRules.ts";

test("pide completar ambos campos", () => {
  assert.equal(validateNewPassword("", ""), "missing");
  assert.equal(validateNewPassword("abcdefgh", ""), "missing");
});

test("rechaza claves cortas antes de comparar", () => {
  assert.equal(validateNewPassword("a".repeat(MIN_PASSWORD_LENGTH - 1), "otra"), "tooShort");
});

test("rechaza si no coinciden", () => {
  assert.equal(validateNewPassword("abcdefgh", "abcdefgX"), "mismatch");
});

test("acepta clave válida y repetida", () => {
  assert.equal(validateNewPassword("abcdefgh", "abcdefgh"), null);
});
