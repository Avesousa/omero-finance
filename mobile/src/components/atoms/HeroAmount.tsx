import { formatMoney, formatMoneyParts } from "../../i18n/format";
import { Text, type TextProps, type TextTone } from "./Text";

export interface HeroAmountProps extends Omit<TextProps, "children" | "variant"> {
  value: number;
  currency?: string;
  tone?: TextTone;
}

/**
 * Monto grande de héroe: tamaño fijo (`heroAmount`) con los decimales más chicos
 * (`heroAmountDecimals`) sobre la misma línea base. Siempre 2 decimales.
 */
export function HeroAmount({ value, currency = "ARS", tone = "onPrimary", style, ...rest }: HeroAmountProps) {
  const { sign, symbol, integer, decimals, decimalSeparator } = formatMoneyParts(value, currency);
  return (
    <Text
      variant="heroAmount"
      tone={tone}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      accessibilityLabel={formatMoney(value, currency)}
      style={style}
      {...rest}
    >
      {`${sign}${symbol} ${integer}`}
      <Text variant="heroAmountDecimals" tone={tone} importantForAccessibility="no">
        {`${decimalSeparator}${decimals}`}
      </Text>
    </Text>
  );
}
