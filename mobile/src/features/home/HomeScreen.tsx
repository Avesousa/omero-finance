import { router } from "expo-router";
import { AppHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { Text } from "../../components/atoms";
import { useHome, useNotificationBadge } from "../../data";
import { capitalize, formatDate } from "../../i18n/format";
import { useSession } from "../../../lib/session";

/** PLACEHOLDER de Inicio: solo encabezado + título. Se reemplaza por la pantalla completa. */
export function HomeScreen() {
  const { data } = useHome();
  const badge = useNotificationBadge();
  const { user } = useSession();
  const monthLabel = capitalize(formatDate(data?.period ?? new Date(), "monthYear"));
  return (
    <ScreenTemplate
      header={
        <AppHeader
          name={data?.greetingName ?? user?.name}
          monthLabel={monthLabel}
          badgeCount={badge}
          onBellPress={() => router.push("/notificaciones")}
        />
      }
    >
      <Text variant="screenTitle">Inicio</Text>
    </ScreenTemplate>
  );
}
