import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { IconButton, Text } from "../atoms";
import { MascotAvatar } from "../molecules";
import type { Mood } from "../../mascots";

export interface AppHeaderProps {
  /** Nombre para el saludo ("Hola, {{name}}"). Sin nombre solo muestra el mes. */
  name?: string;
  /** Mes ya formateado ("Noviembre 2026"). */
  monthLabel: string;
  /** Número del globo de la campana (pendientes + avisos sin leer). */
  badgeCount?: number;
  onBellPress?: () => void;
  /** Mood de la mascota del encabezado (default 'feliz'; 'atento' si hay algo por hacer). */
  mood?: Mood;
}

/** Encabezado de 56px: mascota (44px) + saludo + mes a la izquierda, campana con globo a la derecha. */
export function AppHeader({ name, monthLabel, badgeCount = 0, onBellPress, mood = "feliz" }: AppHeaderProps) {
  const { t } = useTranslation("common");
  const { space, sizes } = useTheme();
  return (
    <View
      style={{
        height: sizes.header,
        paddingHorizontal: space[5],
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], flexShrink: 1 }}>
        <MascotAvatar size={sizes.headerAvatar} mood={mood} />
        <View style={{ gap: 2, flexShrink: 1 }}>
          {name ? (
            <Text variant="bodyStrong" numberOfLines={1} style={{ lineHeight: 18 }}>
              {t("header.greeting", { name })}
            </Text>
          ) : null}
          <Text variant="secondary" tone="inkMuted" numberOfLines={1}>
            {monthLabel}
          </Text>
        </View>
      </View>
      <IconButton
        testID="bell"
        icon="notifications-outline"
        badge={badgeCount}
        onPress={onBellPress}
        accessibilityLabel={badgeCount > 0 ? t("header.notificationsBadge", { count: badgeCount }) : t("header.notificationsLabel")}
      />
    </View>
  );
}
