import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORICAL_SIZE, categoryColorIndex } from "../allocationColors.ts";

test("categoryColorIndex: usa la posición en el orden dado", () => {
  const ids = ["a", "b", "c"];
  assert.deepEqual(ids.map((id) => categoryColorIndex(id, ids)), [0, 1, 2]);
});

test("categoryColorIndex: da la vuelta a la paleta con más categorías que colores", () => {
  const ids = Array.from({ length: CATEGORICAL_SIZE + 2 }, (_, i) => `c${i}`);
  assert.equal(categoryColorIndex(ids[CATEGORICAL_SIZE], ids), 0);
  assert.equal(categoryColorIndex(ids[CATEGORICAL_SIZE + 1], ids), 1);
});

test("categoryColorIndex: un id fuera de la lista es estable y está en rango", () => {
  const a = categoryColorIndex("desconocida", ["x"]);
  assert.equal(a, categoryColorIndex("desconocida", ["y", "z"]));
  assert.ok(a >= 0 && a < CATEGORICAL_SIZE);
});

test("readableOn: elige el candidato con más contraste sobre el fondo", async () => {
  const { readableOn, contrastRatio } = await import("../allocationColors.ts");
  assert.equal(readableOn("#FFE14D", ["#FFFFFF", "#14233B"]), "#14233B");
  assert.equal(readableOn("#7E5BB5", ["#14233B", "#FFFFFF"]), "#FFFFFF");
  assert.equal(readableOn("rgba(0,0,0,0.5)", ["#111111", "#FFFFFF"]), "#111111");
  assert.ok((contrastRatio("#000000", "#FFFFFF") ?? 0) > 20.9);
});
