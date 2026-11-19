import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Icon, InitialsTile, Skeleton, Text } from "../../components/atoms";
import { FilterChips } from "../../components/molecules";
import { ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { useTheme } from "../../design-system";
import { useActiveFinance, useCanWrite } from "../../providers/ActiveFinanceProvider";
import { formatMoney } from "../../i18n/format";
import { financeDisplayName, financeDotColor } from "../finances/financeDisplay";
import { accountLook } from "./accountVisual";
import { useAccounts, type AccountDTO } from "./data";
import { UnassignedSheet } from "./UnassignedSheet";
import { useUnassigned } from "./unassigned";

const TYPE_LABEL: Record<AccountDTO["type"], string> = { BANK: "Banco", WALLET: "Billetera", CASH: "Efectivo", OTHER: "Otra" };
const GROUPS = [
  { key: "bank", title: "BANCOS Y BILLETERAS", match: (a: AccountDTO) => a.type !== "CASH" && a.currency === "ARS" },
  { key: "usd", title: "DÓLARES", match: (a: AccountDTO) => a.type !== "CASH" && a.currency === "USD" },
  { key: "cash", title: "EFECTIVO", match: (a: AccountDTO) => a.type === "CASH" },
] as const;

/** Todas las cuentas agrupadas por tipo, con total por grupo y filtro por finanza. */
export function AllAccountsScreen() {
  const { colors, mode, radius, space, sizes } = useTheme();
  const canWrite = useCanWrite();
  const { finances } = useActiveFinance();
  const q = useAccounts();
  const [fin, setFin] = useState("all");
  const [explain, setExplain] = useState(false);
  const live = (q.data?.accounts ?? []).filter((a) => !a.isArchived);
  const unassigned = useUnassigned(live);
  const showUnassigned = unassigned.amount !== 0 && unassigned.balance != null;
  const visible = live.filter((a) => fin === "all" || a.householdId === fin);
  const chips = useMemo(() => [{ id: "all", label: "Todas", dot: colors.inkMuted }, ...finances.map((f) => ({ id: f.id, label: financeDisplayName(f, "Personal"), dot: financeDotColor(f, mode) }))], [finances, colors.inkMuted, mode]);

  const header = (
    <View>
      <View style={{ height: 4, backgroundColor: colors.primary }} />
      <ScreenHeader title="Cuentas" onBack={() => router.back()} backLabel="Volver" right={canWrite ? (
        <Pressable testID="accounts-add" accessibilityRole="button" accessibilityLabel="Agregar cuenta" onPress={() => router.push("/cuentas/nueva")} style={{ width: sizes.touch, height: sizes.touch, borderRadius: sizes.touch / 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }}>
          <Icon name="add" tone="onPrimary" />
        </Pressable>
      ) : undefined} />
    </View>
  );

  return (
    <ScreenTemplate header={header} testID="accounts-all" edges={["top", "bottom"]} contentStyle={{ gap: space[5] }}>
      {finances.length > 1 ? <FilterChips accessibilityLabel="Ver cuentas de" options={chips} value={fin} onChange={setFin} /> : null}
      {q.isPending ? <Skeleton height={200} /> : null}
      {GROUPS.map((g) => {
        const items = visible.filter(g.match);
        if (!items.length) return null;
        const cur = items.every((a) => a.currency === "USD") ? "USD" : "ARS";
        const total = items.reduce((n, a) => n + a.balance, 0);
        return (
          <View key={g.key} style={{ gap: space[2] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text variant="label" tone="inkMuted" accessibilityRole="header">{g.title}</Text>
              <Text variant="bodyStrong" style={{ fontVariant: ["tabular-nums"] }}>{formatMoney(total, cur)}</Text>
            </View>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: sizes.hairline, borderColor: colors.border, paddingHorizontal: space[4], paddingVertical: 4 }}>
              {items.map((a, i) => {
                const l = accountLook(a, { primary: colors.primary, muted: colors.inkMuted, positive: colors.positiveInk });
                return (
                  <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`${a.name}, ${formatMoney(a.balance, a.currency)}`} onPress={() => router.push({ pathname: "/cuentas/[id]", params: { id: a.id } })} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3], borderBottomWidth: i === items.length - 1 ? 0 : sizes.hairline, borderBottomColor: colors.border }}>
                    <InitialsTile color={l.color} initials={l.initials} size={40} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyStrong" numberOfLines={1}>{a.name}</Text>
                      <Text variant="secondary" tone="inkMuted" numberOfLines={1}>{TYPE_LABEL[a.type]} · {a.financeName}{a.balance === 0 ? " · sin movimientos" : ""}</Text>
                    </View>
                    <Text variant="bodyStrong" tone={a.balance < 0 ? "dangerInk" : "ink"} style={{ fontSize: 16, fontVariant: ["tabular-nums"] }}>{formatMoney(a.balance, a.currency)}</Text>
                    <Icon name="chevron-forward" size="sm" tone="inkMuted" />
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
      {showUnassigned ? (
        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="inkMuted" accessibilityRole="header">SIN DEFINIR</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Sin definir, ${formatMoney(unassigned.amount)}. Tocá para ver de dónde sale`} onPress={() => setExplain(true)} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: sizes.hairline, borderColor: colors.border }}>
            <InitialsTile color={colors.inkMuted} initials="?" size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyStrong" numberOfLines={1}>Sin definir</Text>
              <Text variant="secondary" tone="inkMuted" numberOfLines={1}>Diferencia entre tu balance y tus cuentas</Text>
            </View>
            <Text variant="bodyStrong" tone={unassigned.amount < 0 ? "dangerInk" : "ink"} style={{ fontSize: 16, fontVariant: ["tabular-nums"] }}>{unassigned.amount < 0 ? "−" : ""}{formatMoney(Math.abs(unassigned.amount))}</Text>
            <Icon name="chevron-forward" size="sm" tone="inkMuted" />
          </Pressable>
        </View>
      ) : null}
      {explain && unassigned.balance != null ? <UnassignedSheet balance={unassigned.balance} accountsTotal={unassigned.accountsTotal} onClose={() => setExplain(false)} /> : null}
      {q.isSuccess && !visible.length ? <Text variant="secondary" tone="inkMuted">No hay cuentas para mostrar con este filtro.</Text> : null}
      <View accessibilityLabel="Inversiones, próximamente" style={{ flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4], borderRadius: radius.card, borderWidth: 2, borderStyle: "dashed", borderColor: colors.border, opacity: 0.7 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}><Icon name="trending-up-outline" /></View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Agregar inversión</Text>
          <Text variant="secondary" tone="inkMuted">Plazo fijo, FCI, cripto o acciones · pronto</Text>
        </View>
      </View>
    </ScreenTemplate>
  );
}
