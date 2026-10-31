import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { hitSlopFor, Icon, ProgressBar, Text, type IconName } from "../atoms";
import { AmountCapsule, CategoryBadge } from "../molecules";

export interface BudgetLineRowProps {
  name: string;
  icon: IconName;
  /** Color del ícono: el mismo índice que el tramo de la barra. */
  colorIndex: number;
  /** Monto de la cápsula: el tope (editable) o, en "Sale solo", lo que sale (`readOnlyAmountText`). */
  amount: number;
  /** Si se pasa, la cápsula no se edita y muestra este texto; la fila se vuelve tocable con `onPress`. */
  readOnlyAmountText?: string;
  onChangeAmount?: (amount: number) => void;
  /** Muestra la ✕ para quitar el tope. */
  onRemove?: () => void;
  /** Línea chica bajo el nombre ("gastado $ x de $ y"). */
  caption?: string;
  captionTone?: "inkMuted" | "dangerInk";
  progress?: { value: number; tone: "positive" | "primary" | "warning" | "danger"; label?: string };
  /** Solo filas de solo lectura: tocar la fila. */
  onPress?: () => void;
  pressHint?: string;
  testID?: string;
  amountTestID?: string;
  removeTestID?: string;
}

const BADGE = 40;

/**
 * Fila de una categoría en Presupuesto (estilo "armar presupuesto"): ícono en cuadrado con el color de su tramo, nombre,
 * cápsula con el monto editable en línea y ✕ para quitarlo; debajo, lo gastado y una barra fina.
 */
export function BudgetLineRow({
  name,
  icon,
  colorIndex,
  amount,
  readOnlyAmountText,
  onChangeAmount,
  onRemove,
  caption,
  captionTone = "inkMuted",
  progress,
  onPress,
  pressHint,
  testID,
  amountTestID,
  removeTestID,
}: BudgetLineRowProps) {
  const { t } = useTranslation("budget");
  const { space, sizes } = useTheme();
  const readOnly = readOnlyAmountText !== undefined;
  const REMOVE = 28;

  const top = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: sizes.touch }}>
      <CategoryBadge icon={icon} colorIndex={colorIndex} size={BADGE} />
      <Text variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
        {name}
      </Text>
      <AmountCapsule
        testID={amountTestID}
        value={amount}
        staticText={readOnly ? readOnlyAmountText : undefined}
        onCommit={onChangeAmount}
        accessibilityLabel={readOnly ? t("row.committedAmount", { name, amount: readOnlyAmountText }) : t("row.amountLabel", { name })}
        accessibilityHint={readOnly ? undefined : t("row.amountHint")}
      />
      {readOnly ? (
        <Icon name="chevron-forward" size="sm" tone="inkMuted" />
      ) : onRemove ? (
        <Pressable
          testID={removeTestID}
          accessibilityRole="button"
          accessibilityLabel={t("row.remove", { name })}
          hitSlop={hitSlopFor(REMOVE)}
          onPress={onRemove}
          style={({ pressed }) => ({ width: REMOVE, height: REMOVE, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
        >
          <Icon name="close" size="sm" tone="inkMuted" />
        </Pressable>
      ) : (
        <View style={{ width: REMOVE }} />
      )}
    </View>
  );

  const detail =
    caption || progress ? (
      <View style={{ paddingLeft: BADGE + space[2], gap: space[1], paddingBottom: space[1] }}>
        {caption ? (
          <Text variant="secondary" tone={captionTone}>
            {caption}
          </Text>
        ) : null}
        {progress ? <ProgressBar value={progress.value} tone={progress.tone} accessibilityLabel={progress.label} /> : null}
      </View>
    ) : null;

  const body = (
    <View style={{ gap: space[1] }}>
      {top}
      {detail}
    </View>
  );

  return readOnly ? (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${readOnlyAmountText}${caption ? `. ${caption}` : ""}`}
      accessibilityHint={pressHint}
      onPress={onPress}
      style={({ pressed }) => ({ paddingVertical: space[2], opacity: pressed ? 0.85 : 1 })}
    >
      {body}
    </Pressable>
  ) : (
    <View testID={testID} style={{ paddingVertical: space[2] }}>
      {body}
    </View>
  );
}
