import type { ReactNode } from "react";
import { View } from "react-native";
import { palette } from "../../design-system/tokens/palette";
import { useTheme } from "../../design-system";
import { Text } from "./../atoms";

/** Héroe en el color primary de la finanza: rótulo, un solo número grande (44 → 32 → 24, nunca con «…») y contenido propio debajo. */
export function PlataHero({ label, amount, message, children, testID }: { label: string; amount: string; message?: string; children?: ReactNode; testID?: string }) {
  const { colors, radius, space } = useTheme();
  return (
    <View testID={testID} accessibilityLabel={`${label}: ${amount}`} style={{ backgroundColor: colors.primary, borderRadius: radius.hero, padding: space[5], gap: space[3], overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", right: -70, top: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: palette.glass }} />
      <Text variant="label" tone="onPrimary">{label}</Text>
      <Text variant="moneyHero" tone="onPrimary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{amount}</Text>
      {message ? <Text variant="bodySemi" tone="onPrimary" style={{ lineHeight: 22 }}>{message}</Text> : null}
      {children}
    </View>
  );
}
