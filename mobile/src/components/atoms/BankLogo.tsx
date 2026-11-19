import { Image, View, type ImageSourcePropType } from "react-native";
import { palette } from "../../design-system/tokens/palette";
import { useTheme } from "../../design-system";
import { bankFor } from "../../domain/cardBrands";
import { Icon } from "./Icon";
import { Text } from "./Text";

/**
 * Logos oficiales (opcional): agregá la imagen en `assets/brands/` y registrala acá por id de banco.
 *   galicia: require("../../../assets/brands/galicia.png"),
 * Sin imagen se usa el distintivo con las iniciales y el color del banco.
 */
const BANK_LOGOS: Partial<Record<string, ImageSourcePropType>> = {};

const BANK_COLOR: Record<string, string> = {
  galicia: palette.brand.galicia, santander: palette.brand.santander, bbva: palette.brand.bbva, macro: palette.brand.macro,
  nacion: palette.brand.nacion, provincia: palette.brand.provincia, icbc: palette.brand.icbc, brubank: palette.brand.brubank,
  mercadopago: palette.brand.mercadopago, uala: palette.brand.uala, naranjax: palette.brand.naranjax,
};

/** Color de identidad de un banco conocido (para fondos de tarjeta); `null` si no se reconoce. */
export function bankColor(name: string | null | undefined): string | null {
  const bank = bankFor(name);
  return bank ? BANK_COLOR[bank.id] ?? null : null;
}

/** Marca de «Otro» banco: «XX» blanco sobre negro. */
export function OtherBankMark({ size = 40 }: { size?: number }) {
  const { radius } = useTheme();
  return (
    <View accessible accessibilityLabel="Otro banco" style={{ width: size, height: size, borderRadius: radius.input * (size / 56), alignItems: "center", justifyContent: "center", backgroundColor: palette.black }}>
      <Text variant="sticker" style={{ color: palette.white, fontSize: size * 0.36, lineHeight: size * 0.5 }}>XX</Text>
    </View>
  );
}

export interface BankLogoProps {
  /** Nombre del banco tal como se guardó («Galicia», «Banco Nación»…). */
  name: string | null | undefined;
  size?: number;
}

/** Logo del banco, o el distintivo con sus iniciales. Un banco desconocido muestra un ícono genérico. */
export function BankLogo({ name, size = 40 }: BankLogoProps) {
  const { colors, radius } = useTheme();
  const bank = bankFor(name);
  const logo = bank ? BANK_LOGOS[bank.id] : undefined;
  const box = { width: size, height: size, borderRadius: radius.input * (size / 56), alignItems: "center" as const, justifyContent: "center" as const, overflow: "hidden" as const };
  if (logo) return <View accessible accessibilityLabel={bank?.label} style={[box, { backgroundColor: palette.white }]}><Image source={logo} style={{ width: size * 0.8, height: size * 0.8 }} resizeMode="contain" /></View>;
  if (bank) {
    return (
      <View accessible accessibilityLabel={bank.label} style={[box, { backgroundColor: BANK_COLOR[bank.id] }]}>
        <Text variant="sticker" style={{ color: palette.white, fontSize: size * (bank.initials.length > 1 ? 0.34 : 0.45), lineHeight: size * 0.5 }}>{bank.initials}</Text>
      </View>
    );
  }
  return <View accessible accessibilityLabel={name ?? "Banco"} style={[box, { backgroundColor: colors.bg }]}><Icon name="business-outline" size="sm" tone="inkMuted" /></View>;
}
