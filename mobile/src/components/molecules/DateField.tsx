import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { activeLocale, capitalize, formatDate, formatPeriod } from "../../i18n/format";
import { Button, Icon, IconButton, Text } from "../atoms";

export interface DateFieldProps {
  /** 'YYYY-MM-DD' (vacío = sin fecha). */
  value: string;
  onChange: (iso: string) => void;
  label: string;
  placeholder?: string;
  /** Permite borrar la fecha (campos opcionales). */
  clearable?: boolean;
  testID?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const todayIso = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };

/** Iniciales de los días de la semana (lunes primero) en el idioma activo. */
function weekdays(): string[] {
  try {
    const f = new Intl.DateTimeFormat(activeLocale(), { weekday: "narrow" });
    return [5, 6, 7, 8, 9, 10, 11].map((d) => f.format(new Date(2026, 10, d)));
  } catch {
    return ["L", "M", "M", "J", "V", "S", "D"];
  }
}

/** Fecha: un renglón con la fecha elegida que abre un calendario en una hoja. Sin teclado ni formatos que recordar. */
export function DateField({ value, onChange, label, placeholder = "Elegir fecha", clearable, testID }: DateFieldProps) {
  const { colors, radius, space, sizes } = useTheme();
  const [open, setOpen] = useState(false);
  const base = value || todayIso();
  const [view, setView] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) });
  const today = todayIso();

  const openSheet = () => { const b = value || todayIso(); setView({ y: Number(b.slice(0, 4)), m: Number(b.slice(5, 7)) }); setOpen(true); };
  const shift = (n: number) => setView((v) => { const i = v.y * 12 + (v.m - 1) + n; return { y: Math.floor(i / 12), m: (i % 12) + 1 }; });
  const pick = (d: number) => { onChange(iso(view.y, view.m, d)); setOpen(false); };

  const first = (new Date(view.y, view.m - 1, 1).getDay() + 6) % 7; // lunes = 0
  const days = new Date(view.y, view.m, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value, "full") : placeholder}`}
        onPress={openSheet}
        style={{ minHeight: sizes.button, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], borderRadius: radius.input, borderWidth: sizes.hairline, borderColor: colors.border, backgroundColor: colors.surface }}
      >
        <Icon name="calendar-outline" tone="inkMuted" />
        <Text variant="body" tone={value ? "ink" : "inkMuted"} style={{ flex: 1 }}>{value ? capitalize(formatDate(value, "full")) : placeholder}</Text>
        <Icon name="chevron-down" size="sm" tone="inkMuted" />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: colors.overlay }} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingHorizontal: space[5], paddingTop: space[5], paddingBottom: space[8], gap: space[3] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="screenTitle">{label}</Text>
            <IconButton icon="close" accessibilityLabel="Cerrar" onPress={() => setOpen(false)} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <IconButton icon="chevron-back" accessibilityLabel="Mes anterior" onPress={() => shift(-1)} />
            <Text variant="cardTitle" accessibilityLiveRegion="polite">{capitalize(formatPeriod(`${view.y}-${pad(view.m)}`))}</Text>
            <IconButton icon="chevron-forward" accessibilityLabel="Mes siguiente" onPress={() => shift(1)} />
          </View>
          <View style={{ flexDirection: "row" }}>
            {weekdays().map((w, i) => <Text key={i} variant="secondaryStrong" tone="inkMuted" align="center" style={{ flex: 1 }}>{w.toUpperCase()}</Text>)}
          </View>
          <View style={{ gap: space[1] }}>
            {rows.map((r, ri) => (
              <View key={ri} style={{ flexDirection: "row" }}>
                {r.map((d, ci) => {
                  if (d === null) return <View key={ci} style={{ flex: 1, height: sizes.touch }} />;
                  const id = iso(view.y, view.m, d);
                  const selected = id === value;
                  const isToday = id === today;
                  return (
                    <Pressable key={ci} accessibilityRole="button" accessibilityLabel={formatDate(id, "long")} accessibilityState={{ selected }} onPress={() => pick(d)} style={{ flex: 1, height: sizes.touch, alignItems: "center", justifyContent: "center" }}>
                      <View style={{ width: sizes.touch - 4, height: sizes.touch - 4, borderRadius: (sizes.touch - 4) / 2, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.primary : "transparent", borderWidth: isToday && !selected ? sizes.ring : 0, borderColor: colors.primary }}>
                        <Text variant="bodyStrong" tone={selected ? "onPrimary" : "ink"}>{d}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <View style={{ flex: 1 }}><Button variant="secondary" label="Hoy" onPress={() => { onChange(today); setOpen(false); }} /></View>
            {clearable && value ? <View style={{ flex: 1 }}><Button variant="secondary" label="Quitar" onPress={() => { onChange(""); setOpen(false); }} /></View> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}
