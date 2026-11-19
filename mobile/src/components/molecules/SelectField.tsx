import { useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useTheme } from "../../design-system";
import { Icon, IconButton, Text, type IconName } from "../atoms";

export interface SelectOption {
  value: string;
  label: string;
  /** Texto secundario bajo el nombre. */
  hint?: string;
  /** Logo o ícono a la izquierda. */
  leading?: ReactNode;
}

export interface SelectFieldProps {
  /** Título de la hoja y etiqueta accesible. */
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Versión chica (píldora de 36px) para acompañar a otro campo, p. ej. la moneda junto al monto. */
  compact?: boolean;
  /** Ícono delante del valor en la versión compacta (p. ej. la casita de la finanza). */
  icon?: IconName;
  testID?: string;
}

/** Desplegable: un renglón que muestra lo elegido y abre una hoja con las opciones (para listas que no entran en una línea). */
export function SelectField({ label, value, options, onChange, placeholder = "Elegir", compact, icon, testID }: SelectFieldProps) {
  const { colors, radius, space, sizes } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        hitSlop={compact ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
        style={compact
          ? { minHeight: 36, maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: space[1], paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: colors.bg }
          : { minHeight: sizes.button, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], borderRadius: radius.input, borderWidth: sizes.hairline, borderColor: colors.border, backgroundColor: colors.surface }}
      >
        {compact ? (icon ? <Icon name={icon} size="sm" tone="inkMuted" /> : null) : current?.leading}
        <Text variant={compact ? "secondaryStrong" : "body"} tone={current ? "ink" : "inkMuted"} numberOfLines={1} style={compact ? { flexShrink: 1 } : { flex: 1 }}>{current?.label ?? placeholder}</Text>
        <Icon name="chevron-down" size="sm" tone="inkMuted" />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: colors.overlay }} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingHorizontal: space[5], paddingTop: space[5], paddingBottom: space[8], maxHeight: "70%", gap: space[3] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="screenTitle">{label}</Text>
            <IconButton icon="close" accessibilityLabel="Cerrar" onPress={() => setOpen(false)} />
          </View>
          <ScrollView contentContainerStyle={{ gap: space[1] }}>
            {options.map((o) => {
              const selected = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityLabel={o.label}
                  accessibilityState={{ selected }}
                  onPress={() => { onChange(o.value); setOpen(false); }}
                  style={{ minHeight: sizes.touch + space[2], flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[3], borderRadius: radius.input, backgroundColor: selected ? colors.bg : "transparent" }}
                >
                  {o.leading}
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>{o.label}</Text>
                    {o.hint ? <Text variant="secondary" tone="inkMuted" numberOfLines={1}>{o.hint}</Text> : null}
                  </View>
                  {selected ? <Icon name="checkmark" size="sm" tone="primary" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
