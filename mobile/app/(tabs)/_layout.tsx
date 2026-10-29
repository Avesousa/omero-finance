import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useInbox } from "../../lib/queries";
import { colors } from "../../lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon = (name: IconName, active: IconName) =>
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) =>
    <Ionicons name={focused ? active : name} size={size} color={color as string} />;

export default function TabsLayout() {
  const inbox = useInbox();
  const pending = inbox.data?.length ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarBadgeStyle: { backgroundColor: colors.amber, color: colors.accentFg, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Mes", tabBarIcon: icon("wallet-outline", "wallet") }} />
      <Tabs.Screen name="cargar" options={{ title: "Cargar", tabBarIcon: icon("add-circle-outline", "add-circle") }} />
      <Tabs.Screen name="fijos" options={{ title: "Fijos", tabBarIcon: icon("repeat-outline", "repeat") }} />
      <Tabs.Screen
        name="por-confirmar"
        options={{
          title: "Por confirmar",
          tabBarIcon: icon("checkmark-done-outline", "checkmark-done"),
          tabBarBadge: pending > 0 ? pending : undefined,
        }}
      />
      <Tabs.Screen name="mas" options={{ title: "Más", tabBarIcon: icon("ellipsis-horizontal-outline", "ellipsis-horizontal") }} />
    </Tabs>
  );
}
