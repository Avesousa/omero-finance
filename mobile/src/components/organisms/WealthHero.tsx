import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { Amount, Surface, Text } from "../atoms";
import { DeltaBadge } from "../molecules";

export interface WealthHeroProps {
  /** Patrimonio neto, ya en `currency`. */
  net: number;
  assets: number;
  debts: number;
  currency?: string;
  /** Cambio vs el mes anterior; null si no hay con qué comparar. */
  delta: { amount: number; ratio: number | null } | null;
}

/** Héroe de Patrimonio: "TU PATRIMONIO", neto grande, cambio del mes y barra activos vs deudas. */
export function WealthHero({ net, assets, debts, currency = "ARS", delta }: WealthHeroProps) {
  const { t } = useTranslation("wealth");
  const { colors, space, radius } = useTheme();
  const gross = assets + debts;
  const assetsShare = gross > 0 ? Math.min(1, Math.max(0, assets / gross)) : 0;
  return (
    <Surface variant="hero" testID="wealth-hero" style={{ gap: space[1] }}>
      <Text variant="label" tone="onPrimary">
        {t("hero.label")}
      </Text>
      <Amount
        testID="wealth-net"
        variant="heroAmount"
        tone="onPrimary"
        value={net}
        currency={currency}
        fitChars={9}
      />
      {delta ? (
        <View style={{ marginTop: space[2], gap: space[1] }}>
          <DeltaBadge amount={delta.amount} ratio={delta.ratio} currency={currency} framed />
          <Text variant="secondary" tone="onPrimary">
            {t("hero.vsPrevious")}
          </Text>
        </View>
      ) : null}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("hero.split", { assets: formatMoney(assets, currency), debts: formatMoney(debts, currency) })}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(assetsShare * 100) }}
        style={{
          marginTop: space[3],
          height: 10,
          borderRadius: radius.pill,
          backgroundColor: colors.heroTrack,
          overflow: "hidden",
        }}
      >
        <View style={{ width: `${assetsShare * 100}%`, height: 10, borderRadius: radius.pill, backgroundColor: colors.onPrimary }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2], marginTop: space[1] + 2 }}>
        <Text variant="secondaryStrong" tone="onPrimary" style={{ flexShrink: 1 }}>
          {t("hero.assets", { amount: formatMoney(assets, currency) })}
        </Text>
        <Text variant="secondaryStrong" tone="onPrimary" style={{ flexShrink: 1, textAlign: "right" }}>
          {t("hero.debts", { amount: formatMoney(debts, currency) })}
        </Text>
      </View>
    </Surface>
  );
}
