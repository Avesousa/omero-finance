import { formatMoney } from "../../i18n/format";
import { Text, type TextProps } from "./Text";

export interface AmountProps extends Omit<TextProps, "children"> {
  value: number;
  currency?: string;
}

/** Monto formateado con el locale activo (es-AR: `$ 40.866`). Por defecto estilo `number`. */
export function Amount({ value, currency = "ARS", variant = "number", ...rest }: AmountProps) {
  return (
    <Text variant={variant} {...rest}>
      {formatMoney(value, currency)}
    </Text>
  );
}
