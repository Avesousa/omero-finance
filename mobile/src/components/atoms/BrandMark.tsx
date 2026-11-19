import { View } from "react-native";
import { palette } from "../../design-system/tokens/palette";
import { useTheme } from "../../design-system";
import { CARD_NETWORKS, isCardNetwork, type CardNetworkId } from "../../domain/cardBrands";
import { Text } from "./Text";

/** Se mantiene el nombre por compatibilidad: es la red de la tarjeta. */
export type BrandMarkBrand = CardNetworkId;

export interface BrandMarkProps {
  brand: BrandMarkBrand | string | null | undefined;
  /** Alto en px (default 22). El ancho sale de la proporción de cada marca. */
  size?: number;
}

/** Marca de la red de tarjeta (Visa, Mastercard, Amex, Cabal, Diners). Si no se reconoce, un distintivo «TDC». */
export function BrandMark({ brand, size = 22 }: BrandMarkProps) {
  const { colors, radius } = useTheme();
  const id: CardNetworkId = isCardNetwork(brand) ? brand : "OTHER";
  const label = CARD_NETWORKS.find((n) => n.id === id)?.label ?? "Tarjeta";
  const b = palette.brand;
  const text = (t: string, color: string, bg: string, w: number, style?: object) => (
    <View style={[{ height: size, width: size * w, borderRadius: radius.input / 4, backgroundColor: bg, alignItems: "center", justifyContent: "center" }, style]}>
      <Text variant="sticker" style={{ color, fontSize: size * 0.45, lineHeight: size * 0.6 }}>{t}</Text>
    </View>
  );
  let mark;
  if (id === "MC") {
    const r = size * 0.5;
    mark = (
      <View style={{ width: size * 1.5, height: size, justifyContent: "center" }}>
        <View style={{ position: "absolute", left: 0, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: b.mcRed }} />
        <View style={{ position: "absolute", right: 0, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: b.mcOrange, opacity: 0.9 }} />
      </View>
    );
  } else if (id === "VISA") mark = text("VISA", palette.white, b.visa, 2);
  else if (id === "AMEX") mark = text("AMEX", palette.white, b.amex, 2);
  else if (id === "CABAL") mark = text("CABAL", palette.white, b.cabal, 2.2);
  else if (id === "DINERS") mark = text("DINERS", palette.white, b.diners, 2.4);
  else {
    mark = (
      <View style={{ height: size, minWidth: size * 1.6, paddingHorizontal: size * 0.25, borderRadius: radius.input / 4, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
        <Text variant="sticker" tone="inkMuted" style={{ fontSize: size * 0.45 }}>TDC</Text>
      </View>
    );
  }
  return <View accessible accessibilityLabel={label} style={{ alignSelf: "flex-start" }}>{mark}</View>;
}
