import { useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { formatMoneyInput } from "../lib/core";
import { colors, gutter, radius } from "../lib/theme";

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export function Screen({ children, onRefresh, refreshing, header }: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  header?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {header}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 8, paddingBottom: 32, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <Text style={styles.title}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ListCard({ children }: { children: ReactNode }) {
  return <View style={[styles.card, { overflow: "hidden" }]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={[styles.titleRow, { paddingHorizontal: 4 }]}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <View style={[styles.card, { padding: 16 }]}>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: "center" }}>{children}</Text>
    </View>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "accent" | "amber" | "red" | "green" }) {
  const map = {
    muted: { bg: colors.surface, fg: colors.textSecondary },
    accent: { bg: colors.accentSubtle, fg: colors.accent },
    amber: { bg: "rgba(251,191,36,0.12)", fg: colors.amber },
    red: { bg: "rgba(248,113,113,0.12)", fg: colors.red },
    green: { bg: "rgba(74,222,128,0.12)", fg: colors.green },
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: map.fg, fontSize: 11, fontWeight: "600" }}>{children}</Text>
    </View>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : value > 0 ? 100 : 0;
  return (
    <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.surface, overflow: "hidden" }}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

// ─── Botones ──────────────────────────────────────────────────────────────────

export function PrimaryButton({ children, onPress, busy, disabled, testID }: {
  children: ReactNode; onPress: () => void; busy?: boolean; disabled?: boolean; testID?: string;
}) {
  const off = busy || disabled;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [styles.primary, { opacity: off ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {busy ? <ActivityIndicator color={colors.accentFg} /> : <Text style={styles.primaryText}>{children}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ children, onPress, disabled, testID, tone }: {
  children: ReactNode; onPress: () => void; disabled?: boolean; testID?: string; tone?: "danger";
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.secondary, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}
    >
      <Text style={{ color: tone === "danger" ? colors.red : colors.textSecondary, fontSize: 14, fontWeight: "600" }}>{children}</Text>
    </Pressable>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Text accessibilityRole="alert" testID="error-text" style={{ color: colors.red, fontSize: 13, lineHeight: 18 }}>
      {error}
    </Text>
  );
}

// ─── Formularios ──────────────────────────────────────────────────────────────

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{hint}</Text> : null}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textSecondary}
      selectionColor={colors.accent}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

/** Monto con formato es-AR mientras se escribe. */
export function MoneyInput({ value, onChange, large, label, autoFocus, testID }: {
  value: string; onChange: (v: string) => void; large?: boolean; label: string; autoFocus?: boolean; testID?: string;
}) {
  return (
    <TextInput
      testID={testID}
      accessibilityLabel={label}
      value={value}
      onChangeText={(t) => {
        // Un punto al final lo tipeó la persona (el formato nunca lo deja): era la coma decimal.
        onChange(formatMoneyInput(t.endsWith(".") ? `${t.slice(0, -1)},` : t));
      }}
      placeholder="0"
      placeholderTextColor={colors.textSecondary}
      selectionColor={colors.accent}
      keyboardType="decimal-pad"
      autoFocus={autoFocus}
      style={[styles.input, large && { fontSize: 32, fontWeight: "700", paddingVertical: 12 }]}
    />
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            testID={`seg-${o.value}`}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && { backgroundColor: colors.accent }]}
          >
            <Text style={{ color: on ? colors.accentFg : colors.textSecondary, fontSize: 14, fontWeight: "600" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips({ options, value, onChange }: {
  options: { id: string; label: string }[]; value: string | null; onChange: (id: string | null) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(on ? null : o.id)}
            style={[
              styles.chip,
              on && { backgroundColor: colors.accentSubtle, borderColor: colors.accent },
            ]}
          >
            <Text style={{ color: on ? colors.accent : colors.text, fontSize: 14, fontWeight: on ? "600" : "400" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Fijos: botón redondo de pagado ───────────────────────────────────────────

export function DoneToggle({ done, label, onToggle }: { done: boolean; label: string; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: done }}
      onPress={onToggle}
      hitSlop={10}
      style={[
        styles.toggle,
        done ? { backgroundColor: colors.green, borderColor: colors.green } : { borderColor: colors.borderStrong },
      ]}
    >
      {done ? <Ionicons name="checkmark" size={16} color={colors.accentFg} /> : null}
    </Pressable>
  );
}

// ─── Hoja inferior ────────────────────────────────────────────────────────────

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar">
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} />
        </Pressable>
        <View testID="sheet" style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.grabber} />
          <View style={[styles.titleRow, { paddingHorizontal: gutter, paddingBottom: 8 }]}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar hoja">
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 8, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Acciones con estado ──────────────────────────────────────────────────────

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>, onDone?: (r: T) => void) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      onDone?.(r);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal. Intentá de nuevo.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.4 },
  sectionTitle: {
    color: colors.textSecondary, fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase",
  },
  card: { backgroundColor: colors.card, borderRadius: radius + 4, borderWidth: 1, borderColor: colors.border },
  primary: {
    backgroundColor: colors.accent, borderRadius: radius, minHeight: 50, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryText: { color: colors.accentFg, fontSize: 16, fontWeight: "700" },
  secondary: {
    borderRadius: radius, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 16,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated,
  },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  input: {
    backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: radius,
    color: colors.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12,
  },
  segmented: {
    flexDirection: "row", backgroundColor: colors.elevated, borderRadius: radius, padding: 3, borderWidth: 1, borderColor: colors.border,
  },
  segItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: radius - 3 },
  chip: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  toggle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%",
    borderWidth: 1, borderColor: colors.border, paddingTop: 8,
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 8 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
});
