import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../design-system";
import type { TextTone } from "./Text";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export interface IconProps {
  /** Nombre Ionicons (usar variantes de trazo: "home-outline"). */
  name: IconName;
  /** `md` = 24px (default), `sm` = 20px (controles chicos), `lg` = 34px (botones protagonistas). */
  size?: "sm" | "md" | "lg";
  tone?: TextTone;
  /** Color explícito de un rol del tema (para casos como la pestaña activa). */
  color?: string;
}

/** Ícono de trazo del DS. Decorativo: el control que lo contiene lleva la etiqueta accesible. */
export function Icon({ name, size = "md", tone = "ink", color }: IconProps) {
  const { sizes, colors } = useTheme();
  const px = size === "sm" ? sizes.iconSmall : size === "lg" ? sizes.iconLarge : sizes.icon;
  return (
    <Ionicons
      name={name}
      size={px}
      color={color ?? (colors[tone as keyof typeof colors] as string)}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
