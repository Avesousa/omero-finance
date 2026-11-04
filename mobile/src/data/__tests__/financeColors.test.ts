import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FINANCE_PALETTE, financeAccent, isFinancePaletteKey, mixHex, tintTheme, withAlpha } from "../../design-system/tokens/financeColors.ts";

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

// Tema mínimo (themes.ts importa sin extensión y el runner de Node no lo resuelve).
function fakeTheme(bold: boolean, statusBar: "dark" | "light") {
  const c = (v: string) => v;
  return {
    statusBar,
    bold,
    effects: { hero: bold ? "x" : undefined, fab: bold ? "y" : undefined, floating: "z" },
    gradients: { hero: { colors: ["#111111", "#222222", "#333333"] as const, locations: [0, 0.55, 1] as const } },
    colors: {
      bg: c("#333333"), primary: c("#2F6FB0"), accent: c("#E9C98B"), tabActive: c("#2F6FB0"), tabActiveBg: c("#00000000"),
      fab: c("#2F6FB0"), backdropRing: c("#AAAAAA"), heroTrack: c("#1F4F82"), heroToggle: c("#FFFFFF"),
      chartHighlight: c("#2F6FB0"), chart: ["#2F6FB0", "#1", "#2", "#3", "#4"] as const,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("tintTheme: el color de la finanza manda en Tranqui y en Atrevido", () => {
  for (const [bold, bar] of [[false, "dark"], [true, "light"]] as const) {
    const base = fakeTheme(bold, bar);
    const accent = FINANCE_PALETTE.azul[bar === "dark" ? "light" : "dark"];
    const t = tintTheme(base, accent);
    assert.equal(t.colors.primary, accent);
    assert.equal(t.colors.tabActive, accent);
    assert.equal(t.colors.fab, accent);
    assert.equal(t.colors.chart[0], accent);
    assert.notDeepEqual(t.gradients.hero.colors, base.gradients.hero.colors);
    assert.equal(t.gradients.hero.colors[2], base.colors.bg); // el degradé se funde con el fondo
    assert.equal(base.colors.primary, "#2F6FB0"); // no muta el tema base
    assert.equal(t.colors.accent, bold ? accent : "#E9C98B");
    assert.equal(Boolean(t.effects.hero), bold);
  }
});

test("mixHex", () => {
  assert.equal(mixHex("#000000", "#FFFFFF", 0), "#000000");
  assert.equal(mixHex("#000000", "#FFFFFF", 1), "#ffffff");
  assert.equal(mixHex("#000000", "#FFFFFF", 0.5), "#808080");
});
