import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { useTheme, type ThemeColors, type TypeVariant } from "../../design-system";

export type TextTone = "ink" | "inkMuted" | "primary" | "onPrimary" | "onAccent" | "onWarning" | "positiveInk" | "dangerInk";

export interface TextProps extends RNTextProps {
  /** Estilo tipográfico del DS (default `body`). */
  variant?: TypeVariant;
  /** Rol de color de texto (default `ink`). `primary` solo es legible como texto en Tranqui. */
  tone?: TextTone;
  align?: "left" | "center" | "right";
}

/** Texto base del sistema: familia, tamaño e interlineado salen de `variant`; color de `tone`. */
export function Text({ variant = "body", tone = "ink", align, style, ...rest }: TextProps) {
  const { type, colors } = useTheme();
  const color = colors[tone as keyof ThemeColors] as string;
  return <RNText {...rest} style={[type[variant], { color }, align ? { textAlign: align } : null, style]} />;
}
