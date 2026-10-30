import { Tabs } from "expo-router";
import { TabBar } from "../../src/components/organisms";
import { useTheme } from "../../src/design-system";

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tarjetas" />
      <Tabs.Screen name="agregar" />
      <Tabs.Screen name="patrimonio" />
      <Tabs.Screen name="mas" />
    </Tabs>
  );
}
