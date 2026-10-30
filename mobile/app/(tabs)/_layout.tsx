import { Tabs } from "expo-router";
import { TabBar } from "../../src/components/organisms";
import { useTheme } from "../../src/design-system";
import { sections } from "../../src/navigation";

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      {sections.map((s) => (
        <Tabs.Screen key={s.key} name={s.route} />
      ))}
    </Tabs>
  );
}
