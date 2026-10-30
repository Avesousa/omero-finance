import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { router, type Tabs } from "expo-router";
import { glow, useTheme } from "../../design-system";
import { Icon, Text, type IconName } from "../atoms";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

interface TabConfig {
  labelKey: "home" | "cards" | "add" | "wealth" | "more";
  icon: IconName;
  iconActive: IconName;
}

/** Rutas de `app/(tabs)` en orden. `agregar` es el botón central (su ruta no se llama `cargar` para no chocar con el modal `/cargar`). */
const TAB_CONFIG: Record<string, TabConfig> = {
  index: { labelKey: "home", icon: "home-outline", iconActive: "home" },
  tarjetas: { labelKey: "cards", icon: "card-outline", iconActive: "card" },
  agregar: { labelKey: "add", icon: "add", iconActive: "add" },
  patrimonio: { labelKey: "wealth", icon: "trending-up-outline", iconActive: "trending-up" },
  mas: { labelKey: "more", icon: "ellipsis-horizontal", iconActive: "ellipsis-horizontal" },
};

/** Ruta del modal que abre el botón central. */
export const ADD_ROUTE = "/cargar";

/**
 * Barra de pestañas propia para expo-router (`<Tabs tabBar={(p) => <TabBar {...p} />}>`).
 * 84px (más el inset inferior), 5 posiciones fijas; el botón central Cargar (60px, elevado)
 * no cambia de pestaña: abre el modal `/cargar`.
 */
export function TabBar({ state, emitter, navigateToTab, insets }: TabBarProps) {
  const { t } = useTranslation("tabs");
  const { colors, space, sizes, effects } = useTheme();
  const height = Math.max(sizes.tabBar, sizes.tabBar - space[8] + insets.bottom);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t("navigation")}
      style={{
        height,
        flexDirection: "row",
        alignItems: "flex-start",
        paddingTop: space[3],
        paddingHorizontal: space[2],
        backgroundColor: colors.surface,
        borderTopWidth: sizes.hairline,
        borderTopColor: colors.border,
      }}
    >
      {state.routes.map((route, index) => {
        const config = TAB_CONFIG[route.name];
        if (!config) return null;
        const focused = state.index === index;
        const isAdd = route.name === "agregar";
        const label = t(config.labelKey);

        const onPress = () => {
          if (isAdd) {
            router.push(ADD_ROUTE);
            return;
          }
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        const tint = focused ? colors.tabActive : colors.inkMuted;

        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused && !isAdd }}
            onPress={onPress}
            hitSlop={{ top: space[2], bottom: space[2] }}
            style={{
              flex: 1,
              minHeight: sizes.touch,
              alignItems: "center",
              gap: space[1],
              marginTop: isAdd ? -sizes.fabLift : 0,
            }}
          >
            {isAdd ? (
              <View
                style={[
                  {
                    width: sizes.fab,
                    height: sizes.fab,
                    borderRadius: sizes.fab / 2,
                    backgroundColor: colors.primary,
                    borderWidth: sizes.fabBorder,
                    borderColor: colors.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  glow(effects.fab),
                ]}
              >
                <Icon name="add" tone="onPrimary" />
              </View>
            ) : (
              <Icon name={focused ? config.iconActive : config.icon} color={tint} />
            )}
            <Text variant={focused && !isAdd ? "tabActive" : "tab"} style={{ color: isAdd ? colors.inkMuted : tint }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
