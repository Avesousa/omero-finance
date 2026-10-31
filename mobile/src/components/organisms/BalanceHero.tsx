import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { HeroAmount, HStack, Icon, IconButton, Text, useReducedMotion } from "../atoms";
import { MascotAvatar } from "../molecules";
import type { Mood } from "../../mascots";
import { maskedMoney } from "./privacy";

export interface BalanceHeroProps {
  /** Nombre para el saludo ("Hola, {{name}}"). Sin nombre solo muestra el mes. */
  name?: string;
  /** Mes ya formateado ("Noviembre 2026"). */
  monthLabel: string;
  badgeCount?: number;
  onBellPress?: () => void;
  mood?: Mood;
  /** Balance: la plata que tenés hoy. */
  balance: number;
  /** Disponible = gasto diario ("Hoy podés gastar"). */
  perDay: number;
  /** Libre del mes: se ve mientras se mantiene presionada la cápsula. */
  freeMonth: number;
  /** Montos ocultos (ojito). */
  hidden: boolean;
  onToggleHidden: () => void;
  /** Margen lateral de la pantalla: el degradé sale a pantalla completa y el contenido conserva este margen. */
  bleed?: number;
}

/** Tiempo de presión para pasar de "Hoy podés gastar" a "Libre del mes". */
const HOLD_MS = 300;
/** Alto de la extensión del degradé hacia arriba (cubre el rebote al arrastrar). */
const OVERSCROLL = 1200;
/** Un toque simple muestra el libre del mes este rato y vuelve solo. */
const PEEK_MS = 2500;

/**
 * Héroe de Inicio, sin borde ni tarjeta: un degradé que se funde con el fondo y, encima, la mascota con el saludo y la campana,
 * "Tu balance" con el ojito, el balance grande y la cápsula "Hoy podés gastar $ x". Mantener presionada la cápsula muestra
 * el libre del mes mientras se sostiene. Se dibuja detrás de la barra de estado (usa la zona segura de arriba).
 */
export function BalanceHero({
  name,
  monthLabel,
  badgeCount = 0,
  onBellPress,
  mood = "feliz",
  balance,
  perDay,
  freeMonth,
  hidden,
  onToggleHidden,
  bleed = 0,
}: BalanceHeroProps) {
  const { t } = useTranslation("home");
  const { t: tc } = useTranslation("common");
  const { colors, gradients, radius, space, sizes } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [pressing, setPressing] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = pressing || peeking;

  useEffect(() => () => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
  }, []);

  const onTap = useCallback(() => {
    // Sin AccessibilityInfo.announce: el lector ya lee la etiqueta con ambos montos y en algunas plataformas la llamada falla.
    setPeeking(true);
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeeking(false), PEEK_MS);
  }, []);

  const shownAmount = holding ? freeMonth : perDay;
  const amountText = hidden ? maskedMoney() : formatMoney(shownAmount);
  const label = holding ? t("balance.monthFreeLabel") : t("balance.dailyLabel");

  const onHold = useCallback(() => {
    setPressing(true);
    // Háptica liviana; si el dispositivo no la soporta, se sigue sin ella.
    try {
      Promise.resolve(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).catch(() => {});
    } catch {
      /* sin háptica */
    }
  }, []);

  const dailyA11y = hidden
    ? t("balance.dailyA11yHidden")
    : t("balance.dailyA11y", { perDay: formatMoney(perDay), free: formatMoney(freeMonth) });

  return (
    <View
      testID="hero"
      style={{
        marginHorizontal: -bleed,
        paddingHorizontal: bleed,
        paddingTop: insets.top + space[4],
        paddingBottom: space[6],
        gap: space[4],
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={gradients.hero.colors as unknown as [string, string, ...string[]]}
        locations={gradients.hero.locations as unknown as [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
      />
      {/* Al arrastrar para actualizar, el scroll "rebota" y deja un hueco arriba: lo cubrimos con el primer color del degradé para que el fondo se mueva con todo. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: -OVERSCROLL, left: 0, right: 0, height: OVERSCROLL, backgroundColor: gradients.hero.colors[0] }}
      />

      <View style={{ height: sizes.header, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], flexShrink: 1 }}>
          <MascotAvatar size={sizes.headerAvatar} mood={mood} />
          <View style={{ gap: 2, flexShrink: 1 }}>
            {name ? (
              <Text variant="bodyStrong" tone="heroInk" numberOfLines={1} style={{ lineHeight: 18 }}>
                {tc("header.greeting", { name })}
              </Text>
            ) : null}
            <Text variant="secondarySemi" tone="heroInkMuted" numberOfLines={1}>
              {monthLabel}
            </Text>
          </View>
        </View>
        <IconButton
          testID="bell"
          icon="notifications-outline"
          badge={badgeCount}
          onPress={onBellPress}
          accessibilityLabel={badgeCount > 0 ? tc("header.notificationsBadge", { count: badgeCount }) : tc("header.notificationsLabel")}
        />
      </View>

      <View style={{ gap: space[1] }}>
        <HStack gap={1} style={{ alignItems: "center" }}>
          <Text variant="bodySemi" tone="heroInkMuted">
            {t("balance.title")}
          </Text>
          <Pressable
            testID="balance-eye"
            accessibilityRole="button"
            accessibilityLabel={hidden ? t("balance.show") : t("balance.hide")}
            accessibilityState={{ checked: !hidden }}
            onPress={onToggleHidden}
            hitSlop={space[2]}
            style={({ pressed }) => ({
              width: sizes.touch,
              height: sizes.touch,
              marginVertical: -space[2],
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name={hidden ? "eye-off-outline" : "eye-outline"} size="sm" color={colors.heroInk} />
          </Pressable>
        </HStack>
        {hidden ? (
          <Text
            testID="hero-amount"
            variant="heroBalance"
            tone="heroInk"
            numberOfLines={1}
            accessibilityLabel={t("balance.hiddenAmount")}
          >
            {maskedMoney()}
          </Text>
        ) : (
          <HeroAmount testID="hero-amount" value={balance} tone="heroInk" large />
        )}
      </View>

      <View style={{ gap: space[2], alignItems: "flex-start" }}>
        <Pressable
          testID="balance-daily"
          accessible
          accessibilityRole="button"
          accessibilityLabel={dailyA11y}
          accessibilityHint={t("balance.a11yHint")}
          delayLongPress={HOLD_MS}
          onLongPress={onHold}
          onPressOut={() => setPressing(false)}
          onPress={onTap}
          style={({ pressed }) => ({
            minHeight: sizes.touch,
            maxWidth: "100%",
            flexDirection: "row",
            alignItems: "center",
            gap: space[2],
            paddingHorizontal: space[4],
            borderRadius: radius.pill,
            backgroundColor: holding ? colors.accent : colors.heroChip,
            transform: !reduceMotion && pressed ? [{ scale: 0.98 }] : undefined,
          })}
        >
          <Text variant="secondarySemi" tone={holding ? "onAccent" : "heroInk"} numberOfLines={1} style={{ flexShrink: 1 }}>
            {label}
          </Text>
          <Text testID="balance-daily-amount" variant="numberSmall" tone={holding ? "onAccent" : "heroInk"} numberOfLines={1}>
            {amountText}
          </Text>
        </Pressable>
        <Text variant="secondary" tone="heroInkMuted" importantForAccessibility="no" accessibilityElementsHidden>
          {holding ? t("balance.holdingHint") : t("balance.hint")}
        </Text>
      </View>
    </View>
  );
}
