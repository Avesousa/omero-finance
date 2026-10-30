import { formatMoney } from "../../i18n/format";
import { useTheme } from "../../design-system";
import { Text, type TextProps } from "./Text";

export interface AmountProps extends Omit<TextProps, "children"> {
  value: number;
  currency?: string;
  /**
   * Achica la letra para que el monto entre en una línea. Valor = cantidad de caracteres que
   * entran al tamaño completo (ej. 10 para heroAmount en un ancho de teléfono).
   * En nativo además usa adjustsFontSizeToFit; en web escala por largo.
   */
  fitChars?: number;
}

/** Monto formateado con el locale activo (es-AR: `$ 40.866`). Por defecto estilo `number`. */
export function Amount({ value, currency = "ARS", variant = "number", fitChars, style, ...rest }: AmountProps) {
  const { type } = useTheme();
  const text = formatMoney(value, currency);
  const base = type[variant];
  const scale = fitChars && text.length > fitChars ? fitChars / text.length : 1;
  const fit =
    scale < 1
      ? { fontSize: Math.round(base.fontSize * scale), lineHeight: Math.round(base.lineHeight * scale) }
      : null;
  return (
    <Text
      variant={variant}
      numberOfLines={fitChars ? 1 : rest.numberOfLines}
      adjustsFontSizeToFit={fitChars ? true : rest.adjustsFontSizeToFit}
      style={[fit, style]}
      {...rest}
    >
      {text}
    </Text>
  );
}
