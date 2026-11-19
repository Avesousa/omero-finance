import { useActiveFinance } from "../../providers/ActiveFinanceProvider";
import { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { Button, Text, VStack } from "../../components/atoms";
import { ScreenTemplate } from "../../components/templates";
import { useTheme } from "../../design-system";
import { FinanceChip } from "../../components/molecules";
import { AccountPicker } from "./AccountPicker";
export function AccountPaymentSheet({ currency = "ARS", usd = false, title = "Elegí de qué cuenta sale", onConfirm, onClose, busy = false, error }: { currency?: "ARS" | "USD"; usd?: boolean; title?: string; onConfirm: (accountId: string, usdAccountId?: string) => void; onClose: () => void; busy?: boolean; error?: string | null }) {
 const { active } = useActiveFinance(); const { space } = useTheme();
 const [accountId, setAccountId] = useState<string | null>(null);
 const [usdId, setUsdId] = useState<string | null>(null);
 return <Modal visible animationType="slide" onRequestClose={onClose}><ScreenTemplate edges={["top", "bottom"]}><ScrollView><VStack gap={4}>
  <Text variant="screenTitle">{title}</Text>
  {active ? <FinanceChip name={active.name} /> : null}
  <AccountPicker currency={currency} value={accountId} onChange={setAccountId} />
  {usd ? <><Text variant="secondary">Podés pagar los dólares desde una cuenta USD o convertirlos a pesos con el tipo de cambio del mes.</Text><AccountPicker autoSelect={false} currency="USD" label="Cuenta USD (opcional)" value={usdId} onChange={setUsdId} /><Button variant="text" label="Pagar dólares en pesos" onPress={() => setUsdId(null)} /></> : null}
  {error ? <Text variant="secondary" tone="dangerInk">{error}</Text> : null}
  <View style={{ flexDirection: "row", gap: space[3] }}><View style={{ flex: 1 }}><Button variant="secondary" label="Cancelar" disabled={busy} onPress={onClose} /></View><View style={{ flex: 1 }}><Button label="Confirmar" busy={busy} disabled={!accountId && !usdId} onPress={() => onConfirm(accountId ?? "", usdId ?? undefined)} /></View></View>
 </VStack></ScrollView></ScreenTemplate></Modal>;
}
