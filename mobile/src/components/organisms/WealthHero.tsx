import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { Text } from "../atoms";
import { DeltaBadge } from "../molecules";
import { MoneyHero } from "./MoneyHero";

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
    <MoneyHero
      testID="wealth-hero"
      label={t("hero.label")}
      amount={net}
      currency={currency}
      amountTestID="wealth-net"
      caption={
        delta ? (
          <View style={{ gap: space[1] }}>
            <DeltaBadge amount={delta.amount} ratio={delta.ratio} currency={currency} framed />
            <Text variant="secondary" tone="onPrimary">
              {t("hero.vsPrevious")}
            </Text>
          </View>
        ) : undefined
      }
      footer={{
        left: t("hero.assets", { amount: formatMoney(assets, currency) }),
        right: t("hero.debts", { amount: formatMoney(debts, currency) }),
      }}
    >
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("hero.split", { assets: formatMoney(assets, currency), debts: formatMoney(debts, currency) })}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(assetsShare * 100) }}
        style={{ height: 10, borderRadius: radius.pill, backgroundColor: colors.heroTrack, overflow: "hidden" }}
      >
        <View style={{ width: `${assetsShare * 100}%`, height: 10, borderRadius: radius.pill, backgroundColor: colors.onPrimary }} />
      </View>
    </MoneyHero>
  );
}
