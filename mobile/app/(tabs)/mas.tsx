import { Linking, Text, View } from "react-native";
import { Card, Divider, ListCard, PrimaryButton, Screen, SecondaryButton, Title, useAction } from "../../components/ui";
import { API_URL } from "../../lib/api";
import { usePeriod } from "../../lib/period";
import { useSession } from "../../lib/session";
import { colors } from "../../lib/theme";

export default function Mas() {
  const { user, signOut } = useSession();
  const { period } = usePeriod();
  const out = useAction();

  return (
    <Screen header={<View style={{ paddingHorizontal: 16, paddingTop: 12 }}><Title>Más</Title></View>}>
      <Card style={{ padding: 16, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>{user?.name ?? "Tu cuenta"}</Text>
        {user?.email ? <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{user.email}</Text> : null}
      </Card>

      <ListCard>
        <View style={{ padding: 12 }}>
          <SecondaryButton
            disabled={!API_URL}
            onPress={() => Linking.openURL(`${API_URL}/plan?period=${period}`)}
          >
            Abrir la versión web
          </SecondaryButton>
        </View>
        <Divider />
        <View style={{ padding: 12 }}>
          <PrimaryButton testID="logout" busy={out.busy} onPress={() => out.run(signOut)}>Cerrar sesión</PrimaryButton>
        </View>
      </ListCard>
    </Screen>
  );
}
