import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Button, IconButton, Text, VStack } from "../../components/atoms";
import { BigAmountField, DateField, FinanceChip, KeyboardDoneBar } from "../../components/molecules";
import { BottomSheet } from "../../components/organisms";
import { useTheme } from "../../design-system";
import { parseMoney, todayIso } from "../../domain";
import { useActiveFinance } from "../../providers/ActiveFinanceProvider";
import { formatMoney } from "../../i18n/format";
import { AccountPicker } from "./AccountPicker";

export type PayMode = "TOTAL" | "MINIMUM" | "CUSTOM";
export interface CardPayment { accountId: string; usdAccountId?: string; paidAt: string; mode: PayMode; amount?: number }

/** Lo que tiene cargado el resumen del mes (null = no hay). */
export interface PayableStatement { total: number | null; minimum: number | null; usdAmount: number | null }

/**
 * Pago de una tarjeta: fecha (hoy por defecto), forma de pago en pestañas (Total / Mínimo / Otro monto) y cuenta de origen.
 * «Total» y «Mínimo» quedan deshabilitados si el resumen no los tiene cargados; entonces solo se puede pagar «otro monto».
 */
export function CardPaymentSheet({ cardName, monthLabel, statement, busy, error, onConfirm, onClose }: {
  cardName: string; monthLabel: string; statement: PayableStatement; busy?: boolean; error?: string | null;
  onConfirm: (p: CardPayment) => void; onClose: () => void;
}) {
  const { colors, radius, space, sizes } = useTheme();
  const { active } = useActiveFinance();
  const hasTotal = statement.total != null && statement.total > 0;
  const hasMin = statement.minimum != null && statement.minimum > 0;
  const [mode, setMode] = useState<PayMode>(hasTotal ? "TOTAL" : hasMin ? "MINIMUM" : "CUSTOM");
  const [date, setDate] = useState(todayIso());
  const [custom, setCustom] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [usdId, setUsdId] = useState<string | null>(null);
  const amount = parseMoney(custom);
  const tabs: { id: PayMode; label: string; sub: string; enabled: boolean }[] = [
    { id: "TOTAL", label: "Total", sub: hasTotal ? formatMoney(statement.total!) : "Sin cargar", enabled: hasTotal },
    { id: "MINIMUM", label: "Mínimo", sub: hasMin ? formatMoney(statement.minimum!) : "Sin cargar", enabled: hasMin },
    { id: "CUSTOM", label: "Otro monto", sub: amount > 0 ? formatMoney(amount) : "A elección", enabled: true },
  ];
  const showUsd = mode === "TOTAL" && !!statement.usdAmount && statement.usdAmount > 0;
  const valid = !!date && (mode === "CUSTOM" ? amount > 0 && !!accountId : mode === "TOTAL" ? !!accountId || (showUsd && !!usdId) : !!accountId);

  return (
    <BottomSheet onClose={onClose}>
      {(close) => (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], paddingBottom: space[3] }}>
            <View style={{ flex: 1 }}>
              <Text variant="screenTitle" numberOfLines={1}>Pagar tarjeta</Text>
              <Text variant="secondary" tone="inkMuted" numberOfLines={1}>{cardName} · {monthLabel}</Text>
            </View>
            <IconButton icon="close" accessibilityLabel="Cerrar" onPress={close} />
          </View>
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space[5], paddingBottom: space[4] }}>
            {active ? <FinanceChip name={active.name} /> : null}
            <VStack gap={2}>
              <Text variant="bodyStrong">Fecha del pago</Text>
              <DateField label="Fecha del pago" value={date} onChange={setDate} />
            </VStack>
            <VStack gap={2}>
              <Text variant="bodyStrong">Monto a pagar</Text>
              <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: space[2], padding: 4, borderRadius: radius.card, backgroundColor: colors.bg }}>
                {tabs.map((t) => {
                  const selected = mode === t.id;
                  return (
                    <Pressable key={t.id} accessibilityRole="tab" accessibilityLabel={`${t.label}, ${t.sub}`} accessibilityState={{ selected, disabled: !t.enabled }} disabled={!t.enabled} onPress={() => setMode(t.id)}
                      style={{ flex: 1, minHeight: sizes.touch + 8, alignItems: "center", justifyContent: "center", paddingHorizontal: space[1], borderRadius: radius.card - 4, backgroundColor: selected ? colors.surface : "transparent", borderWidth: sizes.hairline, borderColor: selected ? colors.border : "transparent", opacity: t.enabled ? 1 : 0.4 }}>
                      <Text variant="secondaryStrong" tone={selected ? "ink" : "inkMuted"}>{t.label}</Text>
                      <Text variant="secondary" tone="inkMuted" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ["tabular-nums"] }}>{t.sub}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {mode === "CUSTOM" ? <BigAmountField autoFocus accessibilityLabel="Monto a pagar" value={custom} onChange={setCustom} /> : null}
              {!hasTotal || !hasMin ? <Text variant="secondary" tone="inkMuted">{!hasTotal && !hasMin ? "Este resumen no tiene total ni mínimo cargados: ingresá el monto que pagaste." : !hasMin ? "Este resumen no tiene pago mínimo cargado." : "Este resumen no tiene total cargado."}</Text> : null}
            </VStack>
            <AccountPicker currency="ARS" label="Cuenta de la que sale" value={accountId} onChange={setAccountId} />
            {showUsd ? <VStack gap={2}>
              <Text variant="secondary" tone="inkMuted">Podés pagar los dólares desde una cuenta USD o convertirlos a pesos con el tipo de cambio del mes.</Text>
              <AccountPicker autoSelect={false} currency="USD" label="Cuenta USD (opcional)" value={usdId} onChange={setUsdId} />
              {usdId ? <Button variant="text" label="Pagar dólares en pesos" onPress={() => setUsdId(null)} /> : null}
            </VStack> : null}
            {error ? <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">{error}</Text> : null}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <View style={{ flex: 1 }}><Button variant="secondary" label="Cancelar" disabled={busy} onPress={close} /></View>
            <View style={{ flex: 1 }}><Button label="Confirmar pago" busy={busy} disabled={!valid} onPress={() => onConfirm({ accountId: accountId ?? "", usdAccountId: showUsd ? usdId ?? undefined : undefined, paidAt: date, mode, amount: mode === "CUSTOM" ? amount : undefined })} /></View>
          </View>
          <KeyboardDoneBar />
        </>
      )}
    </BottomSheet>
  );
}
