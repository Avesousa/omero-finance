import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "../../design-system";
import { HeroAmount, Surface, Text } from "../atoms";

export interface MoneyHeroProps {
  label: string;
  amount: number;
  currency?: string;
  amountTestID?: string;
  /** Línea bajo el monto (texto, DeltaBadge, etc.). */
  caption?: ReactNode;
  /** Contenido extra entre el monto y el pie (toggle, barra). */
  children?: ReactNode;
  /** Pie con dos textos, izquierda y derecha. */
  footer?: { left: string; right: string };
  /** Arriba a la derecha (ej. Sticker de Atrevido). */
  accessory?: ReactNode;
  testID?: string;
}

/** Héroe base de las pantallas principales: rótulo, monto de tamaño fijo, subtítulo, extras y pie. */
export function MoneyHero({ label, amount, currency, amountTestID, caption, children, footer, accessory, testID }: MoneyHeroProps) {
  const { space } = useTheme();
  return (
    <Surface variant="hero" testID={testID} style={{ gap: space[1] }}>
      {accessory ? <View style={{ position: "absolute", top: -space[3] + 2, right: space[4] }}>{accessory}</View> : null}
      <Text variant="label" tone="onPrimary">
        {label}
      </Text>
      <HeroAmount testID={amountTestID} value={amount} currency={currency} />
      {caption ? <View style={{ marginTop: space[1] }}>{caption}</View> : null}
      {children ? <View style={{ marginTop: space[3] }}>{children}</View> : null}
      {footer ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2], marginTop: space[3] }}>
          <Text variant="secondaryStrong" tone="onPrimary" style={{ flexShrink: 1 }}>
            {footer.left}
          </Text>
          <Text variant="secondaryStrong" tone="onPrimary" style={{ flexShrink: 1, textAlign: "right" }}>
            {footer.right}
          </Text>
        </View>
      ) : null}
    </Surface>
  );
}
