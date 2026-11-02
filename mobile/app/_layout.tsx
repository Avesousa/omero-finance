import { Pressable, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useSession } from "../lib/session";
import { REQUIRES_LOGIN } from "../src/data";
import { useAppFonts, useTheme } from "../src/design-system";
import { AppProviders } from "../src/providers/AppProviders";
import { useActiveFinance } from "../src/providers/ActiveFinanceProvider";
import { Text } from "../src/components/atoms";
import { financeDisplayName } from "../src/features/finances/financeDisplay";

function Shell() {
  const fontsReady = useAppFonts();
  const { ready, signedIn } = useSession();
  const theme = useTheme();
  const { t: tf } = useTranslation("finances");
  const { active, lostAccessTo, clearLostAccess } = useActiveFinance();

  if (!fontsReady || !ready) return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />;

  // Con todo en mock no se exige sesión; si los datos o la voz van a la api, se mantiene el login.
  const allowed = !REQUIRES_LOGIN || signedIn;
  // Borde de 3 px con el color de la finanza (en Personal, el de Omero): se ve siempre dónde se está cargando.
  return (
    <View style={{ flex: 1, borderWidth: 3, borderColor: allowed ? theme.colors.primary : "transparent", backgroundColor: theme.colors.bg }}>
      <StatusBar style={theme.statusBar} />
      {allowed && lostAccessTo ? (
        <Pressable accessibilityRole="button" onPress={clearLostAccess} style={{ backgroundColor: theme.colors.dangerTint, padding: theme.space[3] }}>
          <Text variant="secondaryStrong" tone="dangerInk" accessibilityLiveRegion="polite">{tf("denied", { name: lostAccessTo })}</Text>
        </Pressable>
      ) : null}
      {allowed && active?.role === "VIEWER" ? (
        <View style={{ backgroundColor: theme.colors.surface, padding: theme.space[3] }}>
          <Text variant="secondary" tone="inkMuted">{tf("viewerOnly", { name: financeDisplayName(active, tf("personal")) })}</Text>
        </View>
      ) : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
        <Stack.Protected guard={allowed}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="cargar" options={{ presentation: "modal" }} />
          <Stack.Screen name="deudas/nueva" options={{ presentation: "modal" }} />
          <Stack.Screen name="ingresos/nuevo" options={{ presentation: "modal" }} />
          <Stack.Screen name="gastos/nuevo" options={{ presentation: "modal" }} />
          <Stack.Screen name="tarjetas" />
          <Stack.Screen name="deudas/index" />
          <Stack.Screen name="movimientos/index" />
          <Stack.Screen name="movimientos/editar" options={{ presentation: "modal" }} />
          <Stack.Screen name="presupuesto/editar" options={{ presentation: "modal" }} />
          <Stack.Screen name="presupuesto/armar" options={{ presentation: "modal" }} />
          <Stack.Screen name="gastos-fijos/index" />
          <Stack.Screen name="gastos-fijos/nuevo" options={{ presentation: "modal" }} />
          <Stack.Screen name="gastos-fijos/editar" options={{ presentation: "modal" }} />
          <Stack.Screen name="notificaciones" />
          <Stack.Screen name="finanzas/nueva" options={{ presentation: "modal" }} />
          <Stack.Screen name="finanzas/[id]" options={{ presentation: "modal" }} />
        </Stack.Protected>
        <Stack.Protected guard={!allowed}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <Shell />
    </AppProviders>
  );
}
