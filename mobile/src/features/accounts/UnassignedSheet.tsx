import { View } from "react-native";
import { router } from "expo-router";
import { Button, IconButton, Text } from "../../components/atoms";
import { BottomSheet } from "../../components/organisms";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";

const signed = (n: number) => `${n < 0 ? "−" : ""}${formatMoney(Math.abs(n))}`;

/** Explica «Sin definir»: de dónde sale la diferencia y cómo se achica. */
export function UnassignedSheet({ balance, accountsTotal, onClose }: { balance: number; accountsTotal: number; onClose: () => void }) {
  const { colors, space } = useTheme();
  const diff = balance - accountsTotal;
  const row = (label: string, value: string, strong = false) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3] }}>
      <Text variant={strong ? "bodyStrong" : "body"} tone={strong ? "ink" : "inkMuted"}>{label}</Text>
      <Text variant={strong ? "bodyStrong" : "body"} style={{ fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
  return (
    <BottomSheet onClose={onClose} height="auto">
      {(close) => (
        <View style={{ gap: space[4] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
            <Text variant="screenTitle" numberOfLines={1} style={{ flex: 1 }}>Sin definir</Text>
            <IconButton icon="close" accessibilityLabel="Cerrar" onPress={close} />
          </View>
          <Text variant="body" tone="inkMuted">
            {diff >= 0
              ? "Tu balance dice que tenés más plata de la que suman tus cuentas. Esa diferencia queda acá hasta que la ubiques."
              : "Tus cuentas suman más de lo que dice tu balance. Revisá si falta cargar un ingreso o si algún saldo inicial está de más."}
          </Text>
          <View style={{ gap: space[2], padding: space[4], borderRadius: 16, backgroundColor: colors.bg }}>
            {row("Balance", signed(balance))}
            {row("Suma de tus cuentas", signed(accountsTotal))}
            <View style={{ height: 1, backgroundColor: colors.border }} />
            {row("Sin definir", signed(diff), true)}
          </View>
          <Text variant="secondary" tone="inkMuted">Es una cuenta calculada: no se edita. Desaparece sola cuando las cuentas coinciden con el balance.</Text>
          <Button label="Ajustar mis cuentas" onPress={() => { close(); router.push("/cuentas/todas"); }} />
        </View>
      )}
    </BottomSheet>
  );
}
