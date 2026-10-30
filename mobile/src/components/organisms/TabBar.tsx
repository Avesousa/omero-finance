import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { router, type Tabs } from "expo-router";
import { glow, useTheme } from "../../design-system";
import { sectionByRoute, useSectionLabel, type Section } from "../../navigation";
import { Icon, Text } from "../atoms";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** Ruta del modal que abre el botón Cargar. */
export const ADD_ROUTE = "/cargar";

interface TabItemProps {
  section: Section;
  focused: boolean;
  onPress: () => void;
}

function TabItem({ section, focused, onPress }: TabItemProps) {
  const { colors, space, sizes, radius } = useTheme();
  const label = useSectionLabel(section.key);
  const tint = focused ? colors.tabActive : colors.inkMuted;
  return (
    <Pressable
      testID={`tab-${section.route}`}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={{ flex: 1, height: sizes.tabItemHeight, justifyContent: "center" }}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          borderRadius: radius.pill,
          paddingHorizontal: 0,
          backgroundColor: focused ? colors.tabActiveBg : "transparent",
        }}
      >
        <Icon name={focused ? section.iconActive : section.icon} color={tint} />
        <Text variant={focused ? "tabActive" : "tab"} numberOfLines={1} style={{ color: tint }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Barra de navegación flotante para expo-router: píldora `surface` con las secciones de
 * `navigation/sections.ts` y, aparte a la derecha, el botón circular Cargar (abre el modal `/cargar`).
 * Va en posición absoluta sobre el contenido; `ScreenTemplate` reserva el espacio.
 */
export function TabBar({ state, emitter, navigateToTab, insets }: TabBarProps) {
  const { t } = useTranslation("tabs");
  const { colors, space, sizes, radius, effects } = useTheme();

  return (
    <View
      testID="tabbar"
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
        paddingHorizontal: space[3],
        paddingBottom: Math.max(insets.bottom, space[3]),
      }}
    >
      <View
        accessibilityRole="tablist"
        accessibilityLabel={t("navigation")}
        style={[
          {
            flex: 1,
            height: sizes.tabBarHeight,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: space[1],
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
          },
          glow(effects.floating),
        ]}
      >
        {state.routes.map((route, index) => {
          const section = sectionByRoute(route.name);
          if (!section) return null;
          const focused = state.index === index;
          const onPress = () => {
            const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return <TabItem key={route.key} section={section} focused={focused} onPress={onPress} />;
        })}
      </View>
      <Pressable
        testID="fab-cargar"
        accessibilityRole="button"
        accessibilityLabel={t("add")}
        onPress={() => router.push(ADD_ROUTE)}
        style={[
          {
            width: sizes.fab,
            height: sizes.fab,
            borderRadius: sizes.fab / 2,
            backgroundColor: colors.fab,
            alignItems: "center",
            justifyContent: "center",
          },
          glow(effects.fab ?? effects.floating),
        ]}
      >
        <Icon name="add" color={colors.onFab} />
      </Pressable>
    </View>
  );
}
