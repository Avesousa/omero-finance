import { palette } from "../design-system";
import { MatiDrawing } from "./mati/Drawing";
import { OmeroDrawing } from "./omero/Drawing";
import { PinchoDrawing } from "./pincho/Drawing";
import type { MascotDefinition, MascotId } from "./types";
import { ZorroDrawing } from "./zorro/Drawing";

const atrevidoBackdrop = palette.atrevido.surface;

/**
 * Registro de mascotas. Para agregar una: carpeta nueva con su Drawing, una entrada acá
 * y sus textos en `i18n/locales/<idioma>/mascots.json`.
 */
export const MASCOTS: Record<MascotId, MascotDefinition> = {
  omero: {
    id: "omero",
    i18nKey: "omero",
    backdrop: { tranqui: palette.backdrop.omero, atrevido: atrevidoBackdrop },
    Drawing: OmeroDrawing,
    story: { chapters: 3 },
  },
  pincho: {
    id: "pincho",
    i18nKey: "pincho",
    backdrop: { tranqui: palette.backdrop.pincho, atrevido: atrevidoBackdrop },
    Drawing: PinchoDrawing,
    story: { chapters: 3 },
  },
  mati: {
    id: "mati",
    i18nKey: "mati",
    backdrop: { tranqui: palette.backdrop.mati, atrevido: atrevidoBackdrop },
    Drawing: MatiDrawing,
    story: { chapters: 3 },
  },
  zorro: {
    id: "zorro",
    i18nKey: "zorro",
    backdrop: { tranqui: palette.backdrop.zorro, atrevido: atrevidoBackdrop },
    Drawing: ZorroDrawing,
    story: { chapters: 3 },
  },
};

export const DEFAULT_MASCOT: MascotId = "omero";

export function getMascot(id: MascotId): MascotDefinition {
  return MASCOTS[id] ?? MASCOTS[DEFAULT_MASCOT];
}

export function listMascots(): MascotDefinition[] {
  return Object.values(MASCOTS);
}

export function isMascotId(value: string): value is MascotId {
  return value in MASCOTS;
}
