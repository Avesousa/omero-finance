import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type SectionKey = "home" | "cards" | "debts" | "wealth" | "more";

export interface Section {
  key: SectionKey;
  /** Nombre de la ruta dentro de `app/(tabs)`. */
  route: "index" | "tarjetas" | "deudas" | "patrimonio" | "mas";
  icon: IconName;
  iconActive: IconName;
}

/** Fuente única de las secciones principales, en el orden de la barra de navegación. */
export const sections: readonly Section[] = [
  { key: "home", route: "index", icon: "home-outline", iconActive: "home" },
  { key: "cards", route: "tarjetas", icon: "card-outline", iconActive: "card" },
  { key: "debts", route: "deudas", icon: "swap-vertical-outline", iconActive: "swap-vertical" },
  { key: "wealth", route: "patrimonio", icon: "trending-up-outline", iconActive: "trending-up" },
  { key: "more", route: "mas", icon: "ellipsis-horizontal", iconActive: "ellipsis-horizontal" },
];

export function sectionByRoute(route: string): Section | undefined {
  return sections.find((s) => s.route === route);
}
