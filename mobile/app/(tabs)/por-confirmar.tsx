import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Chips, Divider, EmptyHint, ErrorText, Field, ListCard, MoneyInput, PrimaryButton, Screen, Sheet, TextField,
  Title, useAction,
} from "../../components/ui";
import { api } from "../../lib/api";
import {
  addMonths, cardLabel, fmtMoney, numberToInput, parseMoney, periodLabel, todayIso,
  type Currency,
} from "../../lib/core";
import { usePeriod } from "../../lib/period";
import { useInbox, useInvalidate, usePlan, useRefetchOnFocus } from "../../lib/queries";
import { colors } from "../../lib/theme";
import type { InboxItemDTO, PlanData } from "../../lib/types";

const DEBIT = "DEBIT";

/** Fecha y hora de un pago, en hora de Buenos Aires. */
function whenLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export default function PorConfirmar() {
  const { period } = usePeriod();
  const inbox = useInbox();
  const plan = usePlan(period);
  useRefetchOnFocus(inbox.refetch);
  const [open, setOpen] = useState<InboxItemDTO | null>(null);
  const items = inbox.data ?? [];

  return (
    <Screen
      header={<View style={{ paddingHorizontal: 16, paddingTop: 12 }}><Title>Por confirmar</Title></View>}
      onRefresh={() => { inbox.refetch(); plan.refetch(); }}
      refreshing={inbox.isRefetching && !inbox.isLoading}
    >
      {inbox.isLoading ? (
        <EmptyHint>Cargando…</EmptyHint>
      ) : inbox.error ? (
        <ErrorText error={inbox.error.message} />
      ) : items.length === 0 ? (
        <EmptyHint>No hay pagos por confirmar. Los pagos con Apple Pay van a aparecer acá solos.</EmptyHint>
      ) : (
        <ListCard>
          {items.map((it, i) => (
            <View key={it.id}>
              {i > 0 && <Divider />}
              <Pressable
                testID={`inbox-item-${it.id}`}
                accessibilityRole="button"
                onPress={() => setOpen(it)}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
                  paddingHorizontal: 16, paddingVertical: 14, opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                    {it.merchant ?? "Pago sin comercio"}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {whenLabel(it.occurredAt)}{it.walletCard ? ` · ${it.walletCard}` : ""}
                  </Text>
                </View>
                <Text style={{ color: it.amount == null ? colors.amber : colors.text, fontSize: 15, fontWeight: "600" }}>
                  {it.amount == null ? "Sin monto" : fmtMoney(it.amount, it.currency)}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.borderStrong} />
              </Pressable>
            </View>
          ))}
        </ListCard>
      )}
      {open && plan.data && (
        <ConfirmSheet key={open.id} item={open} data={plan.data} onClose={() => setOpen(null)} />
      )}
    </Screen>
  );
}

function ConfirmSheet({ item, data, onClose }: { item: InboxItemDTO; data: PlanData; onClose: () => void }) {
  const invalidate = useInvalidate();
  const action = useAction();
  const today = data.today;
  const [amount, setAmount] = useState(numberToInput(item.amount));
  const currency: Currency = item.currency;
  const [categoryId, setCategoryId] = useState<string | null>(item.suggestedCategoryId);
  const [how, setHow] = useState<string | null>(
    item.suggestedMethod === "CARD" ? item.suggestedCardId : item.suggestedMethod === "DEBIT" ? DEBIT : null,
  );
  const [installments, setInstallments] = useState("1");
  // null = sigue la fecha (resumen del mes siguiente); se toca solo si la persona lo cambia.
  const [firstPeriodPick, setFirstPeriodPick] = useState<string | null>(null);
  const [date, setDate] = useState(() => {
    const d = todayIso(new Date(item.occurredAt));
    return d > today ? today : d;
  });

  const categories = data.categories.filter((c) => c.kind === "EXPENSE" && !c.systemKey && !c.isArchived);
  const isCard = how != null && how !== DEBIT;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const firstPeriod = firstPeriodPick ?? (validDate ? addMonths(date.slice(0, 7), 1) : "");

  function confirm() {
    const parsed = parseMoney(amount);
    if (!(parsed > 0)) return action.setError("Ingresá el monto");
    if (!categoryId) return action.setError("Elegí una categoría");
    if (!how) return action.setError("Elegí cómo pagaste");
    if (!validDate) return action.setError("La fecha va así: 2026-10-29");
    const count = Math.max(1, Math.floor(Number(installments)) || 1);
    return action.run(
      () => api("POST", `/api/plan/inbox/${item.id}/confirm`, {
        amount: parsed,
        currency,
        categoryId,
        date,
        method: isCard ? "CARD" : "DEBIT",
        ...(isCard ? { cardId: how, installments: count, firstPeriod } : {}),
      }),
      async () => {
        await invalidate();
        onClose();
      },
    );
  }

  function dismiss() {
    return action.run(
      () => api("POST", `/api/plan/inbox/${item.id}/dismiss`),
      async () => {
        await invalidate();
        onClose();
      },
    );
  }

  return (
    <Sheet title="Confirmar pago" onClose={onClose}>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
        {item.merchant ?? "Pago sin comercio"} · {whenLabel(item.occurredAt)}
        {item.walletCard ? ` · ${item.walletCard}` : ""}
      </Text>

      <Field label="Monto" hint={item.amount == null ? "No llegó el monto: completalo para confirmar." : undefined}>
        <MoneyInput testID="confirm-amount" label="Monto" value={amount} onChange={setAmount} large autoFocus={item.amount == null} />
      </Field>

      <Field label="Categoría">
        <Chips options={categories.map((c) => ({ id: c.id, label: c.name }))} value={categoryId} onChange={setCategoryId} />
      </Field>

      <Field label="¿Cómo pagaste?">
        <Chips
          options={[{ id: DEBIT, label: "Débito o efectivo" }, ...data.cards.map((c) => ({ id: c.id, label: cardLabel(c) }))]}
          value={how}
          onChange={setHow}
        />
      </Field>

      {isCard && (
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="Cuotas">
              <TextField
                testID="confirm-installments"
                accessibilityLabel="Cantidad de cuotas"
                value={installments}
                onChangeText={(t) => setInstallments(t.replace(/\D/g, "").slice(0, 3))}
                keyboardType="number-pad"
              />
            </Field>
          </View>
          <View style={{ flex: 1.4 }}>
            <Field label="Primera cuota en">
              <View
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.elevated,
                  borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 6,
                }}
              >
                <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" hitSlop={8} onPress={() => firstPeriod && setFirstPeriodPick(addMonths(firstPeriod, -1))} style={{ padding: 6 }}>
                  <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
                </Pressable>
                <Text testID="confirm-first-period" style={{ color: colors.text, fontSize: 14, textTransform: "capitalize" }}>
                  {firstPeriod ? periodLabel(firstPeriod) : "—"}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" hitSlop={8} onPress={() => firstPeriod && setFirstPeriodPick(addMonths(firstPeriod, 1))} style={{ padding: 6 }}>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            </Field>
          </View>
        </View>
      )}

      <Field label="Fecha">
        <TextField
          testID="confirm-date"
          accessibilityLabel="Fecha"
          value={date}
          onChangeText={setDate}
          placeholder="AAAA-MM-DD"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      </Field>

      <ErrorText error={action.error} />
      <PrimaryButton testID="confirm-submit" onPress={confirm} busy={action.busy}>Confirmar</PrimaryButton>
      <Pressable testID="confirm-dismiss" accessibilityRole="button" onPress={dismiss} disabled={action.busy} style={{ paddingVertical: 8, alignItems: "center" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>Descartar</Text>
      </Pressable>
    </Sheet>
  );
}
