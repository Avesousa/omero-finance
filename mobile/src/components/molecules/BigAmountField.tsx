import { Platform, TextInput, View, useWindowDimensions } from "react-native";
import { useTheme } from "../../design-system";
import { formatMoneyInput, parseMoney } from "../../domain";
import { Text } from "../atoms";
import { KEYBOARD_DONE_ID } from "./AmountCapsule";

export interface BigAmountFieldProps {
  /** Texto del monto tal como se escribe (formato es-AR). */
  value: string;
  onChange: (text: string) => void;
  accessibilityLabel: string;
  /** Símbolo de moneda a la izquierda ("$", "US$"). */
  symbol?: string;
  autoFocus?: boolean;
  testID?: string;
}

/** Tope de la cifra: 999.999.999.999. Lo que lo pase no se acepta, así no se rompe el diseño. */
export const MAX_AMOUNT = 999_999_999_999;

/** Monto protagonista de un formulario: cifra grande y abierta (sin caja), símbolo y teclado numérico (con «Listo» en iOS si la pantalla monta `KeyboardDoneBar`). */
export function BigAmountField({ value, onChange, accessibilityLabel, symbol = "$", autoFocus, testID }: BigAmountFieldProps) {
  const { colors, space, type } = useTheme();
  // La cifra se ajusta al contenido (no ocupa todo el ancho) y baja de tamaño hasta que entra completa, sin cortarse.
  const { width: screen } = useWindowDimensions();
  const len = Math.max(value.length, 1);
  const seps = (value.match(/[.,]/g) ?? []).length;
  const units = (len - seps) * 0.98 + seps * 0.5; // ancho de la cifra en "em" (la tipografía display es ancha)
  const symbolUnits = symbol.length > 1 ? 1.5 : 0.7;
  const available = screen - space[5] * 2 - space[2] * 2;
  const size = Math.max(20, Math.min(52, Math.floor(available / (units + symbolUnits + 0.4))));
  const width = Math.ceil(units * size) + 16;
  return (
    <View style={{ alignSelf: "center", maxWidth: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], paddingVertical: space[3] }}>
      <Text variant="heroBalance" tone="inkMuted" accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: size * 0.62, lineHeight: size * 1.2 }}>{symbol}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        value={value}
        placeholder="0"
        placeholderTextColor={colors.inkMuted}
        keyboardType="decimal-pad"
        inputAccessoryViewID={Platform.OS === "ios" ? KEYBOARD_DONE_ID : undefined}
        autoFocus={autoFocus}
        maxLength={16}
        selectTextOnFocus
        onChangeText={(v) => { const next = formatMoneyInput(v); if (parseMoney(next) <= MAX_AMOUNT) onChange(next); }}
        style={[type.heroBalance, { fontSize: size, lineHeight: size * 1.2, width, minWidth: size * 1.1, color: colors.ink, textAlign: "center", paddingVertical: 0 }]}
      />
    </View>
  );
}
