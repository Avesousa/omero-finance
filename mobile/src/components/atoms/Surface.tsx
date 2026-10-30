import { View, type ViewProps } from "react-native";
import { glow, useTheme } from "../../design-system";

export interface SurfaceProps extends ViewProps {
  /**
   * `card` (default): surface + borde + radio card. `hero`: relleno primary, radio hero, brillo en Atrevido.
   * `alert`: danger-tint con radio button (banners). `bare`: solo surface, sin borde.
   */
  variant?: "card" | "hero" | "alert" | "bare";
  /** Padding de tarjeta (space-4). Default true. */
  padded?: boolean;
}

/** Contenedor base: tarjetas, héroe y banners. */
export function Surface({ variant = "card", padded = true, style, ...rest }: SurfaceProps) {
  const { colors, radius, space, sizes, effects } = useTheme();
  const base =
    variant === "hero"
      ? { backgroundColor: colors.primary, borderRadius: radius.hero, ...glow(effects.hero) }
      : variant === "alert"
        ? { backgroundColor: colors.dangerTint, borderRadius: radius.button }
        : variant === "bare"
          ? { backgroundColor: colors.surface, borderRadius: radius.card }
          : { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: sizes.hairline, borderColor: colors.border };
  return <View {...rest} style={[base, padded && variant !== "alert" ? { padding: space[4] } : null, style]} />;
}
