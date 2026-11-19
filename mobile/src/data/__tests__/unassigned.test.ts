import test from "node:test";
import assert from "node:assert/strict";
import { unassignedBalance } from "../unassigned.ts";

test("Sin definir es el balance menos la suma de las cuentas", () => {
  assert.equal(unassignedBalance(100000, [20000, 30000]), 50000);
});

test("Sin definir puede ser negativo si las cuentas suman más que el balance", () => {
  assert.equal(unassignedBalance(10000, [20000, 5000]), -15000);
});

test("Sin definir se ignora si la diferencia es menor a un peso", () => {
  assert.equal(unassignedBalance(50000.4, [20000, 30000]), 0);
  assert.equal(unassignedBalance(0, []), 0);
});
