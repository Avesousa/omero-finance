import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { BrandMark, Text, TextField, bankColor, hitSlopFor } from "../../components/atoms";
import { palette } from "../../design-system/tokens/palette";
import { SelectField } from "../../components/molecules";
import { useTheme } from "../../design-system";
import { BANK_BRANDS, CARD_NETWORKS, bankFor, type CardNetworkId } from "../../domain/cardBrands";

function Row({ children }: { children: ReactNode }) {
  const { space } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space[2], paddingVertical: space[1] }}>
      {children}
    </ScrollView>
  );
}

/** Píldora de banco: círculo con la inicial del logo (grande) y el nombre al lado. Elegida, se rellena con el color del banco. */
function BankPill({ label, initials, color, selected, onPress }: { label: string; initials: string; color: string; selected: boolean; onPress: () => void }) {
  const { colors, radius, space, sizes } = useTheme();
  const circle = 38;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ minHeight: sizes.button, flexDirection: "row", alignItems: "center", gap: space[2], paddingLeft: space[1] + 2, paddingRight: space[4], borderRadius: radius.pill, backgroundColor: selected ? color : colors.bg }}
    >
      <View style={{ width: circle, height: circle, borderRadius: circle / 2, alignItems: "center", justifyContent: "center", backgroundColor: selected ? palette.white : color }}>
        <Text variant="sticker" style={{ color: selected ? color : palette.white, fontSize: initials.length > 1 ? 15 : 19, lineHeight: 24 }}>{initials}</Text>
      </View>
      <Text variant="bodyStrong" style={{ color: selected ? palette.white : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

/** Banco o billetera: fila horizontal de píldoras de color con scroll. «Otro» (XX, negro) deja escribir el nombre. */
export function BankPicker({ value, onChange }: { value: string; onChange: (name: string, bank?: (typeof BANK_BRANDS)[number]) => void }) {
  const { space } = useTheme();
  const current = bankFor(value);
  const [custom, setCustom] = useState(!!value && !current);
  return (
    <View style={{ gap: space[2] }}>
      <Row>
        {BANK_BRANDS.map((b) => (
          <BankPill key={b.id} label={b.label} initials={b.initials} color={bankColor(b.label) ?? palette.black} selected={!custom && current?.id === b.id} onPress={() => { setCustom(false); onChange(b.label, b); }} />
        ))}
        <BankPill label="Otro" initials="XX" color={palette.black} selected={custom} onPress={() => { setCustom(true); onChange("", undefined); }} />
      </Row>
      {custom ? <TextField accessibilityLabel="Nombre del banco" placeholder="Nombre del banco" value={value} onChangeText={(t) => onChange(t, bankFor(t) ?? undefined)} /> : null}
    </View>
  );
}

/** Red de la tarjeta: solo los logos, en una fila con scroll horizontal. */
export function NetworkPicker({ value, onChange }: { value: string; onChange: (id: CardNetworkId) => void }) {
  const { colors, radius, space, sizes } = useTheme();
  return (
    <Row>
      {CARD_NETWORKS.map((n) => {
        const selected = value === n.id;
        return (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            accessibilityLabel={n.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(n.id)}
            style={{ minWidth: 84, minHeight: sizes.button, paddingHorizontal: space[4], alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: selected ? colors.surface : colors.bg, borderWidth: sizes.ring, borderColor: selected ? colors.primary : colors.bg }}
          >
            <BrandMark brand={n.id} size={26} />
          </Pressable>
        );
      })}
    </Row>
  );
}

/** Opciones cortas en una sola fila (tipo de cuenta, moneda, cuotas…). `compact`: más chicas y centradas, para acompañar a un campo; `dense`: aún más juntas, para compartir renglón. */
export function ChipRow<T extends string>({ value, options, onChange, compact, dense }: { value: T; options: readonly { id: T; label: string }[]; onChange: (id: T) => void; compact?: boolean; dense?: boolean }) {
  const { colors, radius, sizes, space } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: dense ? space[1] : space[2], paddingVertical: space[1], ...(compact && !dense ? { flexGrow: 1, justifyContent: "center" as const } : null) }}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(o.id)}
            hitSlop={compact ? hitSlopFor(sizes.touch, 36) : undefined}
            style={{ minHeight: compact ? 36 : sizes.touch, minWidth: dense ? 34 : compact ? 48 : undefined, paddingHorizontal: dense ? space[2] + 2 : compact ? space[4] : space[5], alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: selected ? colors.accent : colors.surface, borderWidth: sizes.hairline, borderColor: selected ? colors.accent : colors.border }}
          >
            <Text variant={compact ? "secondaryStrong" : "bodyStrong"} tone={selected ? "onAccent" : "ink"}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Moneda del monto: desplegable chico (ARS / USD) para ir en el mismo renglón que la cifra. */
export function CurrencySelect({ value, onChange }: { value: "ARS" | "USD"; onChange: (c: "ARS" | "USD") => void }) {
  return (
    <SelectField
      compact
      label="Moneda"
      value={value}
      onChange={(v) => onChange(v === "USD" ? "USD" : "ARS")}
      options={[{ value: "ARS", label: "ARS", hint: "Pesos argentinos" }, { value: "USD", label: "USD", hint: "Dólares" }]}
    />
  );
}

const PRESET_INSTALLMENTS = ["1", "3", "6", "12"] as const;

/** Cuotas: 1 · 3 · 6 · 12 y «Otra», que se vuelve un campo numérico en el mismo botón y muestra lo que escribís. */
export function InstallmentsRow({ value, custom, onSelect, onCustom }: { value: string; custom: boolean; onSelect: (n: string) => void; onCustom: (n: string) => void }) {
  const { colors, radius, space, sizes, type } = useTheme();
  const base = { minHeight: 36, minWidth: 34, paddingHorizontal: space[2] + 2, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: radius.pill, borderWidth: sizes.hairline };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
      {PRESET_INSTALLMENTS.map((n) => {
        const selected = !custom && value === n;
        return (
          <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} ${n === "1" ? "cuota" : "cuotas"}`} accessibilityState={{ selected }} onPress={() => onSelect(n)} hitSlop={{ top: 4, bottom: 4 }} style={[base, { backgroundColor: selected ? colors.accent : colors.surface, borderColor: selected ? colors.accent : colors.border }]}>
            <Text variant="secondaryStrong" tone={selected ? "onAccent" : "ink"}>{n}</Text>
          </Pressable>
        );
      })}
      {custom ? (
        <View style={[base, { backgroundColor: colors.accent, borderColor: colors.accent, minWidth: 56 }]}>
          {!value ? <View pointerEvents="none" style={{ position: "absolute" }}><Text variant="secondaryStrong" tone="onAccent" style={{ opacity: 0.4 }}>Otra</Text></View> : null}
          <TextInput
            accessibilityLabel="Cantidad de cuotas"
            autoFocus
            value={value}
            onChangeText={(v) => onCustom(v.replace(/\D/g, "").slice(0, 3))}
            onBlur={() => { if (!value) onSelect("1"); }}
            keyboardType="number-pad"
            maxLength={3}
            style={[type.bodyStrong, { color: colors.onAccent, textAlign: "center", paddingVertical: 0, width: Math.max(34, value.length * 14 + 10) }]}
          />
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Otra cantidad de cuotas" onPress={() => onCustom("")} hitSlop={{ top: 4, bottom: 4 }} style={[base, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="secondaryStrong">Otra</Text>
        </Pressable>
      )}
    </View>
  );
}
