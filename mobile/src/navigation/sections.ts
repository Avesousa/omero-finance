import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type SectionKey = "home" | "budget" | "wealth" | "menu";

export interface Section {
  key: SectionKey;
  /** Nombre de la ruta dentro de `app/(tabs)`. */
  route: "index" | "presupuesto" | "patrimonio" | "menu";
  icon: IconName;
  iconActive: IconName;
}

/** Fuente única de las secciones principales, en el orden de la barra de navegación. */
export const sections: readonly Section[] = [
  { key: "home", route: "index", icon: "home-outline", iconActive: "home" },
  { key: "budget", route: "presupuesto", icon: "pie-chart-outline", iconActive: "pie-chart" },
  { key: "wealth", route: "patrimonio", icon: "trending-up-outline", iconActive: "trending-up" },
  { key: "menu", route: "menu", icon: "grid-outline", iconActive: "grid" },
];

export function sectionByRoute(route: string): Section | undefined {
  return sections.find((s) => s.route === route);
}
