import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { palette } from "../../design-system/tokens/palette";
import { useTheme } from "../../design-system";
import { Icon, Text, hitSlopFor, type IconName } from "../atoms";

export interface ResourceGroupCardProps {
  /** Color propio de la entidad (de `palette.entity`). */
  color: string;
  /** Título chico dentro de la tarjeta («Cuentas y efectivo»). */
  title: string;
  /** Línea sobre el monto («Saldo total»). */
  caption: string;
  /** Monto ya formateado. */
  amount: string;
  /** Línea bajo el monto («3 cuentas · US$ 200»). */
  subtitle: string;
  /** Botones circulares arriba a la derecha («+», flecha…). */
  actions?: { icon: IconName; label: string; onPress: () => void; testID?: string }[];
  /** Texto del desplegable: «Ver cuentas» / «Ver tarjetas». */
  toggleLabel: string;
  count: number;
  /** Filas que se muestran al desplegar (`GroupRow`). */
  children?: ReactNode;
  defaultOpen?: boolean;
  testID?: string;
}

/** Entidad con color propio: monto total arriba y, en el mismo bloque, un desplegable con sus cuentas o tarjetas. */
export function ResourceGroupCard({ color, title, caption, amount, subtitle, actions, toggleLabel, count, children, defaultOpen = false, testID }: ResourceGroupCardProps) {
  const { radius, space } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View testID={testID} style={{ borderRadius: radius.hero, overflow: "hidden", backgroundColor: color }}>
      <LinearGradient colors={[palette.clear, palette.shade]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View pointerEvents="none" style={{ position: "absolute", right: -60, top: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: palette.glass }} />
      <View pointerEvents="none" style={{ position: "absolute", left: -40, bottom: -90, width: 220, height: 220, borderRadius: 110, backgroundColor: palette.glass }} />
      <View style={{ padding: space[5], gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
          <Text variant="cardTitle" numberOfLines={1} style={{ color: palette.white, flex: 1 }}>{title}</Text>
          <View style={{ flexDirection: "row", gap: space[2] }}>
            {actions?.map((a) => (
              <Pressable key={a.label} testID={a.testID} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} hitSlop={hitSlopFor(36)} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.glass, opacity: pressed ? 0.7 : 1 })}>
                <Icon name={a.icon} size="sm" color={palette.white} />
              </Pressable>
            ))}
          </View>
        </View>
        <View>
          <Text variant="secondaryStrong" style={{ color: palette.white, opacity: 0.85 }}>{caption}</Text>
          <Text variant="heroBalance" numberOfLines={1} adjustsFontSizeToFit style={{ color: palette.white }}>{amount}</Text>
          <Text variant="secondaryStrong" numberOfLines={2} style={{ color: palette.white, opacity: 0.85 }}>{subtitle}</Text>
        </View>
        <Pressable
          testID={testID ? `${testID}-toggle` : undefined}
          accessibilityRole="button"
          accessibilityLabel={`${open ? "Ocultar" : "Ver"} ${toggleLabel}`}
          accessibilityState={{ expanded: open, disabled: count === 0 }}
          disabled={count === 0}
          onPress={() => setOpen((v) => !v)}
          style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space[4], borderRadius: radius.pill, backgroundColor: palette.glass, opacity: count === 0 ? 0.5 : 1 }}
        >
          <Text variant="bodyStrong" style={{ color: palette.white }}>{open ? "Ocultar" : "Ver"} {toggleLabel} ({count})</Text>
          <Icon name={open ? "chevron-up" : "chevron-down"} size="sm" color={palette.white} />
        </Pressable>
        {open && count > 0 ? <View style={{ gap: space[2] }}>{children}</View> : null}
      </View>
    </View>
  );
}

/** Fila dentro de una `ResourceGroupCard`: vidrio translúcido, logo, nombre, detalle y monto en blanco. */
export function GroupRow({ leading, title, subtitle, trailing, trailingCaption, onPress, dimmed, testID }: { leading: ReactNode; title: string; subtitle: string; trailing: string; trailingCaption?: string; onPress: () => void; dimmed?: boolean; testID?: string }) {
  const { radius, space } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}, ${trailing}`} onPress={onPress} style={({ pressed }) => ({ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2], paddingHorizontal: space[3], borderRadius: radius.input, backgroundColor: palette.glass, opacity: dimmed ? 0.55 : pressed ? 0.8 : 1 })}>
      {leading}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1} style={{ color: palette.white }}>{title}</Text>
        <Text variant="secondary" numberOfLines={1} style={{ color: palette.white, opacity: 0.8 }}>{subtitle}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text variant="numberSmall" style={{ color: palette.white }}>{trailing}</Text>
        {trailingCaption ? <Text variant="secondary" style={{ color: palette.white, opacity: 0.8 }}>{trailingCaption}</Text> : null}
      </View>
      <Icon name="chevron-forward" size="sm" color={palette.white} />
    </Pressable>
  );
}
