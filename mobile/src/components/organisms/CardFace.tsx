import { Pressable, View } from "react-native";
import { palette } from "../../design-system/tokens/palette";
import { useTheme } from "../../design-system";
import { BrandMark, Text } from "../atoms";

export type CardStatePill = "empty" | "estimated" | "loaded" | "paid" | "overdue";
const PILL_LABEL: Record<CardStatePill, string> = { empty: "Sin compras", estimated: "Estimado", loaded: "Resumen cargado", paid: "Pagado", overdue: "Vencido" };

/** Estado del resumen en una píldora (siempre con palabra, nunca solo color). */
export function StatementStatePill({ state }: { state: CardStatePill }) {
  const { colors, radius, space } = useTheme();
  const look = {
    empty: { bg: colors.surface, fg: colors.inkMuted, border: colors.border },
    estimated: { bg: colors.warning, fg: palette.onWarning, border: colors.warning },
    loaded: { bg: palette.backdrop.omero, fg: palette.onWarning, border: palette.backdrop.omero },
    paid: { bg: colors.surface, fg: colors.positiveInk, border: colors.positive },
    overdue: { bg: colors.danger, fg: palette.onWarning, border: colors.danger },
  }[state];
  return (
    <View style={{ alignSelf: "flex-start", paddingHorizontal: space[3] - 2, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: look.bg, borderWidth: 1, borderColor: look.border }}>
      <Text variant="secondaryStrong" style={{ color: look.fg }}>{PILL_LABEL[state]}</Text>
    </View>
  );
}

export interface CardFaceProps {
  color: string;
  /** «Visa · Santander». */
  title: string;
  /** Finanza o titular. */
  subtitle?: string;
  network?: string | null;
  /** «A PAGAR · VENCE 10 DIC». */
  eyebrow: string;
  amount: string;
  state: CardStatePill;
  /** Dato extra en vidrio («8 cuotas este mes»). */
  extra?: string;
  width?: number;
  height?: number;
  onPress?: () => void;
  testID?: string;
}

/** Tarjeta de crédito del diseño: color del banco, red, monto a pagar y estado. */
export function CardFace({ color, title, subtitle, network, eyebrow, amount, state, extra, width, height = 204, onPress, testID }: CardFaceProps) {
  const { radius, space, colors } = useTheme();
  return (
    <Pressable testID={testID} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${title}. ${eyebrow}: ${amount}. ${PILL_LABEL[state]}`} onPress={onPress} style={{ width, height, borderRadius: radius.card, backgroundColor: color, padding: space[5], justifyContent: "space-between", overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", right: -90, bottom: -110, width: 240, height: 240, borderRadius: 120, backgroundColor: palette.glass }} />
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space[3] }}>
        <View style={{ flexShrink: 1 }}>
          <Text variant="cardTitle" numberOfLines={1} style={{ color: palette.white }}>{title}</Text>
          {subtitle ? <Text variant="secondarySemi" numberOfLines={1} style={{ color: palette.white }}>{subtitle}</Text> : null}
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }}><BrandMark brand={network} size={16} /></View>
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="label" style={{ color: palette.white }}>{eyebrow}</Text>
        <Text variant="moneyCard" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: palette.white }}>{amount}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
        <StatementStatePill state={state} />
        {extra ? <View style={{ paddingHorizontal: space[3] - 2, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: palette.glass }}><Text variant="secondaryStrong" style={{ color: palette.white }}>{extra}</Text></View> : null}
      </View>
    </Pressable>
  );
}

/** Tira de la tarjeta de atrás (solo nombre y monto): tocarla la trae adelante. */
export function CardStrip({ color, title, amount, onPress }: { color: string; title: string; amount: string; onPress: () => void }) {
  const { radius, space } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${title}, ${amount}`} onPress={onPress} style={{ height: 64, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, backgroundColor: color, paddingHorizontal: space[5], paddingTop: space[3], flexDirection: "row", justifyContent: "space-between", marginBottom: -16 }}>
      <Text variant="bodyStrong" numberOfLines={1} style={{ color: palette.white, flexShrink: 1 }}>{title}</Text>
      <Text variant="bodyStrong" style={{ color: palette.white }}>{amount}</Text>
    </Pressable>
  );
}
