import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Card, Chips, ErrorText, Field, MoneyInput, PrimaryButton, Screen, Segmented, TextField, Title, useAction,
} from "../../components/ui";
import { api } from "../../lib/api";
import { addDays, fmtMoney, isValidPeriod, parseMoney, todayIso, type Currency, type Kind } from "../../lib/core";
import { usePeriod } from "../../lib/period";
import { useInvalidate, usePlan, useRefetchOnFocus } from "../../lib/queries";
import { colors } from "../../lib/theme";

const KINDS: readonly { value: Kind; label: string }[] = [
  { value: "EXPENSE", label: "Gasto" },
  { value: "INCOME", label: "Ingreso" },
];
const CURRENCIES: readonly { value: Currency; label: string }[] = [
  { value: "ARS", label: "Pesos" },
  { value: "USD", label: "Dólares" },
];

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export default function Cargar() {
  const { period } = usePeriod();
  const plan = usePlan(period);
  useRefetchOnFocus(plan.refetch);
  const invalidate = useInvalidate();
  const action = useAction();

  const [kind, setKind] = useState<Kind>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(() => todayIso());
  const [done, setDone] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const categories = (plan.data?.categories ?? []).filter((c) => c.kind === kind && !c.systemKey && !c.isArchived);

  function changeKind(k: Kind) {
    setKind(k);
    setCategoryId(null);
  }

  function save() {
    const parsed = parseMoney(amount);
    if (!name.trim()) return action.setError("Ponele un nombre");
    if (!(parsed > 0)) return action.setError("Ingresá un monto mayor a cero");
    if (date && !isValidDate(date)) return action.setError("La fecha va así: 2026-10-29");
    const entryPeriod = date ? date.slice(0, 7) : period;
    if (!isValidPeriod(entryPeriod)) return action.setError("Fecha inválida");
    const saved = name.trim();
    return action.run(
      () => api("POST", "/api/plan/entries", {
        period: entryPeriod,
        kind,
        name: saved,
        amount: parsed,
        currency,
        categoryId,
        ...(kind === "INCOME" ? { targetCategoryId: null } : {}),
        date: date || null,
      }),
      async () => {
        await invalidate();
        setAmount("");
        setName("");
        setCategoryId(null);
        setDate(todayIso());
        setDone(`Listo, guardé «${saved}» por ${fmtMoney(parsed, currency)}.`);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(null), 4000);
      },
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Screen header={<View style={{ paddingHorizontal: 16, paddingTop: 12 }}><Title>Cargar</Title></View>}>
        <Segmented options={KINDS} value={kind} onChange={changeKind} />

        <Field label="Monto">
          <View style={{ gap: 8 }}>
            <MoneyInput testID="cargar-amount" label="Monto" value={amount} onChange={setAmount} large />
            <Segmented options={CURRENCIES} value={currency} onChange={setCurrency} />
          </View>
        </Field>

        <Field label="Nombre">
          <TextField
            testID="cargar-name"
            accessibilityLabel="Nombre"
            value={name}
            onChangeText={setName}
            placeholder={kind === "INCOME" ? "Ej: Sueldo" : "Ej: Supermercado"}
            autoCapitalize="sentences"
          />
        </Field>

        <Field label="Categoría">
          {plan.isLoading ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Cargando…</Text>
          ) : (
            <Chips options={categories.map((c) => ({ id: c.id, label: c.name }))} value={categoryId} onChange={setCategoryId} />
          )}
        </Field>

        <Field label="Fecha">
          <View style={{ gap: 8 }}>
            <TextField
              testID="cargar-date"
              accessibilityLabel="Fecha"
              value={date}
              onChangeText={setDate}
              placeholder="AAAA-MM-DD"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setDate(todayIso())} style={chip}><Text style={chipText}>Hoy</Text></Pressable>
              <Pressable onPress={() => setDate(addDays(todayIso(), -1))} style={chip}><Text style={chipText}>Ayer</Text></Pressable>
            </View>
          </View>
        </Field>

        {done && (
          <Card style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 8, borderColor: colors.green }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.green} />
            <Text testID="cargar-ok" style={{ color: colors.green, fontSize: 14, flex: 1 }}>{done}</Text>
          </Card>
        )}
        <ErrorText error={action.error} />
        <PrimaryButton testID="cargar-save" onPress={save} busy={action.busy}>
          {kind === "INCOME" ? "Guardar ingreso" : "Guardar gasto"}
        </PrimaryButton>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const chip = { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 } as const;
const chipText = { color: colors.textSecondary, fontSize: 13, fontWeight: "600" } as const;
