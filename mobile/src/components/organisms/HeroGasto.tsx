import { useTranslation } from "react-i18next";
import { formatMoney } from "../../i18n/format";
import { Sticker, Text } from "../atoms";
import { SegmentedToggle } from "../molecules";
import { MoneyHero } from "./MoneyHero";

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
  const big = view === "available" ? available : perDay;
  return (
    <MoneyHero
      testID="hero"
      label={t("hero.label")}
      amount={big}
      amountTestID="hero-amount"
      accessory={<Sticker label={t("hero.sticker")} />}
      caption={
        <Text testID="hero-subtitle" variant="secondaryStrong" tone="onPrimary" style={{ lineHeight: 18 }}>
          {view === "available" ? t("hero.availableHint") : t("hero.perDay", { count: daysLeft })}
        </Text>
      }
      footer={{
        left: `${t("hero.summaryFree")} ${formatMoney(free)}`,
        right: `${t("hero.summaryAvailable")} ${formatMoney(available)}`,
      }}
    >
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
    </MoneyHero>
  );
}
