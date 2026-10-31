import type { IconName } from "../atoms";

const norm = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palabras del nombre de una categoría → ícono (Ionicons de trazo). Gana la primera coincidencia. */
const RULES: readonly (readonly [RegExp, IconName])[] = [
  [/ahorro|inversion/, "trending-up-outline"],
  [/alquiler|hipoteca|vivienda/, "home-outline"],
  [/expensas|consorcio/, "business-outline"],
  [/servicio|\b(luz|gas|internet|agua)\b/, "flash-outline"],
  [/salud|medic|farmacia/, "medkit-outline"],
  [/suscrip|streaming/, "repeat-outline"],
  [/deuda|prestamo|credito personal/, "cash-outline"],
  [/tarjeta/, "card-outline"],
  [/super|mercado|comida|almacen/, "cart-outline"],
  [/transporte|\bauto\b|nafta|combustible|colectivo/, "bus-outline"],
  [/salida|ocio|restaurant|\bbar\b/, "restaurant-outline"],
  [/compra|ropa|shopping/, "bag-outline"],
  [/educacion|estudio|curso|colegio/, "school-outline"],
  [/familia|hijo|mascota/, "people-outline"],
  [/otro/, "ellipsis-horizontal-circle-outline"],
];

/** Ícono de una categoría por su nombre (sin tildes ni mayúsculas); `pricetag-outline` si no hay coincidencia. */
export function categoryIcon(name: string): IconName {
  const n = norm(name);
  return RULES.find(([re]) => re.test(n))?.[1] ?? "pricetag-outline";
}
