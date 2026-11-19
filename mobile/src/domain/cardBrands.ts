/**
 * Registro de marcas: redes de tarjeta (Visa, Mastercard…) y bancos. Datos puros, sin UI ni colores.
 *
 * Para sumar una red o un banco: una entrada acá (y su color en `palette.brand` si tiene).
 * Para usar el logo oficial: guardá la imagen en `assets/brands/` y referenciala en `logo` desde `components/atoms/BankLogo.tsx`
 * (`BANK_LOGOS`); sin imagen se muestra un distintivo con las iniciales y el color del banco.
 */
export const CARD_NETWORKS = [
  { id: "VISA", label: "Visa" },
  { id: "MC", label: "Mastercard" },
  { id: "AMEX", label: "American Express" },
  { id: "CABAL", label: "Cabal" },
  { id: "DINERS", label: "Diners Club" },
  { id: "OTHER", label: "Otra" },
] as const;

export type CardNetworkId = (typeof CARD_NETWORKS)[number]["id"];

export function isCardNetwork(value: string | null | undefined): value is CardNetworkId {
  return !!value && CARD_NETWORKS.some((n) => n.id === value);
}

export interface BankBrand {
  id: string;
  /** Nombre que se guarda como banco de la tarjeta o nombre de la cuenta. */
  label: string;
  /** Iniciales del distintivo cuando no hay logo. */
  initials: string;
  /** Otras formas de escribirlo (sin tildes, en minúsculas). */
  aliases: string[];
  /** Billetera virtual (cuenta tipo WALLET). */
  wallet?: boolean;
}

export const BANK_BRANDS: readonly BankBrand[] = [
  { id: "galicia", label: "Galicia", initials: "G", aliases: ["banco galicia"] },
  { id: "santander", label: "Santander", initials: "S", aliases: ["banco santander", "santander rio"] },
  { id: "bbva", label: "BBVA", initials: "BB", aliases: ["banco bbva", "frances"] },
  { id: "macro", label: "Macro", initials: "M", aliases: ["banco macro"] },
  { id: "nacion", label: "Nación", initials: "BN", aliases: ["banco nacion", "bn", "nacion"] },
  { id: "provincia", label: "Provincia", initials: "BP", aliases: ["banco provincia", "bapro"] },
  { id: "icbc", label: "ICBC", initials: "IC", aliases: [] },
  { id: "brubank", label: "Brubank", initials: "Br", aliases: ["bk"] },
  { id: "mercadopago", label: "Mercado Pago", initials: "MP", aliases: ["mercadopago", "mp"], wallet: true },
  { id: "uala", label: "Ualá", initials: "U", aliases: ["uala"], wallet: true },
  { id: "naranjax", label: "Naranja X", initials: "NX", aliases: ["naranja", "naranjax"], wallet: true },
];

const clean = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Banco conocido a partir de un texto libre ("Banco Nación", "mp", "BBVA"…). null si no se reconoce. */
export function bankFor(text: string | null | undefined): BankBrand | null {
  if (!text) return null;
  const t = clean(text);
  return BANK_BRANDS.find((b) => clean(b.label) === t || b.id === t || b.aliases.includes(t)) ?? null;
}
