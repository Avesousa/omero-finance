import { useRef, useState, type ComponentRef } from "react";
import { Platform, TextInput, View } from "react-native";
import { useTheme } from "../../design-system";
import { formatMoneyInput, numberToInput, parseMoney } from "../../domain";
import { Text } from "../atoms";

/** `nativeID` de la barra "Listo" que se muestra sobre el teclado numérico de iOS (que no trae tecla de confirmar). Ver `KeyboardDoneBar`. */
export const KEYBOARD_DONE_ID = "amount-capsule-done";

const MIN_WIDTH = 104;
const MAX_WIDTH = 160;

/** Ancho del campo: ≈ 11,5 px por carácter (Unbounded es ancha) del valor formateado a 15 px (+ holgura), sin pasar de lo que deja la cápsula de 160 px. */
const inputWidth = (text: string): number => Math.min(MAX_WIDTH - 44, Math.ceil(Math.max(text.length, 1) * 11.5) + 10);

export interface AmountCapsuleProps {
  /** Monto actual (entero en pesos). 0 = vacío (sin tope). */
  value: number;
  /** Se llama con el monto nuevo (entero > 0) al confirmar (tecla Listo) o al salir del campo, solo si cambió. */
  onCommit?: (amount: number) => void;
  /** Texto fijo en vez del campo (monto que no se edita acá, p. ej. lo que sale solo). */
  staticText?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * Cápsula con un monto editable en línea: "$ 100.000". Teclado numérico, formato es-AR mientras escribís y se
 * guarda al confirmar o al salir del campo. Lo tipeado vive en el propio componente (no se pierde si la lista se
 * vuelve a dibujar ni cuando llega un valor nuevo desde el servidor); un valor vacío o inválido vuelve al anterior.
 */
export function AmountCapsule({ value, onCommit, staticText, accessibilityLabel, accessibilityHint, testID }: AmountCapsuleProps) {
  const { colors, radius, space, sizes, type } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const [focused, setFocused] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  const shell = {
    minHeight: sizes.touch - 8,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[1],
    paddingHorizontal: space[3],
    flexShrink: 0,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: focused ? sizes.ring : sizes.hairline,
    borderColor: focused ? colors.tabActive : colors.border,
  };

  if (staticText !== undefined) {
    return (
      <View testID={testID} accessible accessibilityLabel={accessibilityLabel} style={{ ...shell, flexShrink: 0, borderWidth: sizes.hairline, borderColor: colors.border, justifyContent: "flex-end" }}>
        <Text variant="numberSmall" numberOfLines={1} style={{ flexShrink: 0 }}>
          {staticText}
        </Text>
      </View>
    );
  }

  const shown = draft ?? numberToInput(value > 0 ? value : null);

  const update = (next: string | null) => {
    draftRef.current = next;
    setDraft(next);
  };
  const commit = () => {
    const text = draftRef.current;
    update(null);
    if (text === null || text === "") return;
    const n = Math.round(parseMoney(text));
    if (Number.isFinite(n) && n > 0 && n !== Math.round(value)) onCommit?.(n);
  };

  return (
    <View style={{ ...shell, justifyContent: "flex-end" }}>
      <Text variant="numberSmall" tone="inkMuted" accessibilityElementsHidden importantForAccessibility="no">
        $
      </Text>
      <TextInput
        ref={input}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        value={shown}
        placeholder="0"
        placeholderTextColor={colors.inkMuted}
        keyboardType="number-pad"
        returnKeyType="done"
        inputAccessoryViewID={Platform.OS === "ios" ? KEYBOARD_DONE_ID : undefined}
        selectTextOnFocus
        maxLength={14}
        onFocus={() => {
          setFocused(true);
          update(numberToInput(value > 0 ? value : null));
        }}
        onChangeText={(v) => update(formatMoneyInput(v))}
        onSubmitEditing={() => input.current?.blur()}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        style={[type.numberSmall, { width: inputWidth(shown), flexShrink: 0, color: colors.ink, textAlign: "right", paddingVertical: 0, minHeight: sizes.touch - 10 }]}
      />
    </View>
  );
}
