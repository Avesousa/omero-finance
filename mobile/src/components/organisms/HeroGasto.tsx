import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { Amount, Sticker, Surface, Text } from "../atoms";
import { SegmentedToggle } from "../molecules";

export type HeroView = "available" | "free";

export interface HeroGastoProps {
  /** Lo que se puede gastar hoy (libre ÷ días que quedan). */
  perDay: number;
  /** Días que quedan del mes. */
  daysLeft: number;
  /** Lo que queda del mes descontando lo ya pagado. */
  available: number;
  /** Lo realmente libre después de lo reservado. */
  free: number;
  /** Qué número se muestra grande: `free` → `perDay`; `available` → `available`. */
  view: HeroView;
  onViewChange: (view: HeroView) => void;
}

/**
 * Héroe de Inicio: "HOY PODÉS GASTAR", el monto grande, su explicación, el interruptor
 * Disponible | Libre y ambos valores. En Atrevido suma el sticker "A FUEGO" y el brillo del tema.
 */
export function HeroGasto({ perDay, daysLeft, available, free, view, onViewChange }: HeroGastoProps) {
  const { t } = useTranslation("home");
  const { space } = useTheme();
  const big = view === "available" ? available : perDay;
  return (
    <Surface variant="hero" testID="hero" style={{ gap: space[1] }}>
      <View style={{ position: "absolute", top: -space[3] + 2, right: space[4] }}>
        <Sticker label={t("hero.sticker")} />
      </View>
      <Text variant="label" tone="onPrimary">
        {t("hero.label")}
      </Text>
      <Amount testID="hero-amount" variant="heroAmount" tone="onPrimary" value={big} />
      <Text testID="hero-subtitle" variant="secondaryStrong" tone="onPrimary" style={{ lineHeight: 18 }}>
        {view === "available" ? t("hero.availableHint") : t("hero.perDay", { count: daysLeft })}
      </Text>
      <View style={{ marginTop: space[2] + 2 }}>
        <SegmentedToggle<HeroView>
          testID="hero-toggle"
          appearance="hero"
          accessibilityLabel={t("hero.toggleLabel")}
          value={view}
          onChange={onViewChange}
          options={[
            { value: "available", label: t("hero.available") },
            { value: "free", label: t("hero.free") },
          ]}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2], marginTop: space[1] + 2 }}>
        <Text variant="secondaryStrong" tone="onPrimary">
          {t("hero.summaryFree")} {formatMoney(free)}
        </Text>
        <Text variant="secondaryStrong" tone="onPrimary">
          {t("hero.summaryAvailable")} {formatMoney(available)}
        </Text>
      </View>
    </Surface>
  );
}
