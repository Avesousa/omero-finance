import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FINANCE_PALETTE, financeAccent, isFinancePaletteKey, withAlpha } from "../../design-system/tokens/financeColors.ts";

// La paleta del servidor vive en src/lib/plan/finances.ts (mobile no la importa: arrastra Prisma). Se lee como texto.
const serverSource = readFileSync(new URL("../../../../src/lib/plan/finances.ts", import.meta.url), "utf8");

function serverPalette(): Record<string, { light: string; dark: string }> {
  const block = /FINANCE_PALETTE = \{([\s\S]*?)\} as const/.exec(serverSource)?.[1] ?? "";
  const out: Record<string, { light: string; dark: string }> = {};
  for (const m of block.matchAll(/(\w+):\s*\{\s*light:\s*"(#[0-9A-Fa-f]{6})",\s*dark:\s*"(#[0-9A-Fa-f]{6})"\s*\}/g)) {
    out[m[1]] = { light: m[2], dark: m[3] };
  }
  return out;
}

test("la paleta de mobile es idéntica a la del servidor", () => {
  assert.deepEqual(FINANCE_PALETTE, serverPalette());
  assert.equal(Object.keys(serverPalette()).length, 6);
});

test("financeAccent elige el hex según el fondo; null = color de Omero", () => {
  assert.equal(financeAccent("violeta", "dark"), "#6A43B8"); // statusBar dark = fondo claro
  assert.equal(financeAccent("violeta", "light"), "#B79CF0"); // fondo oscuro
  assert.equal(financeAccent(null, "dark"), null);
  assert.equal(financeAccent("fucsia", "dark"), null);
  assert.equal(isFinancePaletteKey("toString"), false);
});

test("withAlpha", () => {
  assert.equal(withAlpha("#6A43B8", 1), "#6A43B8ff");
  assert.equal(withAlpha("#6A43B8", 0), "#6A43B800");
});
