import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSession } from "../lib/session";
import { REQUIRES_LOGIN } from "../src/data";
import { useAppFonts, useTheme } from "../src/design-system";
import { AppProviders } from "../src/providers/AppProviders";

function Shell() {
  const fontsReady = useAppFonts();
  const { ready, signedIn } = useSession();
  const theme = useTheme();

  if (!fontsReady || !ready) return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />;

  // Con todo en mock no se exige sesión; si los datos o la voz van a la api, se mantiene el login.
  const allowed = !REQUIRES_LOGIN || signedIn;
  return (
    <>
      <StatusBar style={theme.statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
        <Stack.Protected guard={allowed}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="cargar" options={{ presentation: "modal" }} />
          <Stack.Screen name="deudas/nueva" options={{ presentation: "modal" }} />
          <Stack.Screen name="ingresos/nuevo" options={{ presentation: "modal" }} />
          <Stack.Screen name="gastos/nuevo" options={{ presentation: "modal" }} />
          <Stack.Screen name="presupuesto/index" />
          <Stack.Screen name="presupuesto/editar" options={{ presentation: "modal" }} />
          <Stack.Screen name="presupuesto/armar" options={{ presentation: "modal" }} />
          <Stack.Screen name="notificaciones" />
        </Stack.Protected>
        <Stack.Protected guard={!allowed}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <Shell />
    </AppProviders>
  );
}
