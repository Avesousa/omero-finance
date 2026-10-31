import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * Accesos rápidos: UNA config central que usan Inicio (ShortcutRow) y Menú.
 *
 * Etiquetas: namespace i18n `tabs`, bajo `shortcuts.*`. `labelKey` ya viene completo:
 *   const { t } = useTranslation("tabs");  t(shortcut.labelKey)   // p. ej. "shortcuts.movements"
 * (el tipo de `labelKey` es una clave válida de `tabs`, no hace falta castear).
 *
 * `route` es una ruta de expo-router lista para `router.push(route)`.
 * `inHome`: aparece en la fila de Inicio. `available`: false = todavía no se puede abrir (se oculta o se marca "pronto").
 * Helper: `homeShortcuts()` = los de Inicio y disponibles.
 */
export type ShortcutKey = "movements" | "cards" | "debts" | "fixed" | "accounts" | "notifications";

export interface Shortcut {
  key: ShortcutKey;
  icon: IconName;
  labelKey: `shortcuts.${ShortcutKey}`;
  route: string;
  inHome: boolean;
  available: boolean;
}

export const shortcuts: readonly Shortcut[] = [
  { key: "movements", icon: "swap-vertical-outline", labelKey: "shortcuts.movements", route: "/movimientos", inHome: true, available: true },
  { key: "cards", icon: "card-outline", labelKey: "shortcuts.cards", route: "/tarjetas", inHome: true, available: true },
  { key: "debts", icon: "cash-outline", labelKey: "shortcuts.debts", route: "/deudas", inHome: true, available: true },
  { key: "fixed", icon: "repeat-outline", labelKey: "shortcuts.fixed", route: "/gastos-fijos", inHome: true, available: true },
  { key: "accounts", icon: "wallet-outline", labelKey: "shortcuts.accounts", route: "/patrimonio?focus=assets", inHome: true, available: true },
  { key: "notifications", icon: "notifications-outline", labelKey: "shortcuts.notifications", route: "/notificaciones", inHome: false, available: true },
];

export function homeShortcuts(): Shortcut[] {
  return shortcuts.filter((s) => s.inHome && s.available);
}
