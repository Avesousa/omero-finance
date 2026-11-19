import { useState } from "react";
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { BankLogo, BrandMark, Button, Icon, IconButton, Surface, Text, type IconName } from "../../components/atoms";
import { GroupRow, ResourceGroupCard } from "../../components/organisms";
import { palette } from "../../design-system/tokens/palette";
import { useTheme } from "../../design-system";
import { bankFor } from "../../domain/cardBrands";
import { formatMoney } from "../../i18n/format";
import { accountErrorMessage } from "./account-errors";
import { useAccountDetail, type AccountDTO, type ResourceCardDTO } from "./data";

export const ACCOUNT_TYPE_LABEL: Record<AccountDTO["type"], string> = { BANK: "Banco", WALLET: "Billetera", CASH: "Efectivo", OTHER: "Otra" };
const TYPE_ICON: Record<AccountDTO["type"], IconName> = { BANK: "business-outline", WALLET: "phone-portrait-outline", CASH: "cash-outline", OTHER: "wallet-outline" };
const ORDER: AccountDTO["type"][] = ["BANK", "WALLET", "CASH", "OTHER"];

type Open = { kind: "account"; account: AccountDTO };

/** Cuentas y efectivo: un bloque de color con el saldo total y, desplegable en el mismo bloque, cada cuenta. Tocar una abre sus movimientos; «+» agrega una. */
export function AccountsList({ accounts, showFinance, onAdd }: { accounts: AccountDTO[]; showFinance: boolean; onAdd?: () => void }) {
  const { space } = useTheme();
  const [open, setOpen] = useState<Open | null>(null);
  const live = accounts.filter((a) => !a.isArchived);
  const sum = (c: "ARS" | "USD") => live.filter((a) => a.currency === c).reduce((n, a) => n + a.balance, 0);
  const hasArs = live.some((a) => a.currency === "ARS");
  const hasUsd = live.some((a) => a.currency === "USD");
  const main: "ARS" | "USD" = hasArs || !hasUsd ? "ARS" : "USD";
  const other = main === "ARS" && hasUsd ? formatMoney(sum("USD"), "USD") : null;
  const sorted = [...accounts].sort((a, b) => Number(a.isArchived) - Number(b.isArchived) || ORDER.indexOf(a.type) - ORDER.indexOf(b.type));

  return (
    <View style={{ gap: space[3] }}>
      <ResourceGroupCard
        testID="accounts-group"
        color={palette.entity.accounts}
        title="Cuentas y efectivo"
        caption={`Saldo total${main === "USD" ? " en dólares" : ""}`}
        amount={formatMoney(sum(main), main)}
        subtitle={`${live.length} ${live.length === 1 ? "cuenta" : "cuentas"}${other ? ` · ${other}` : ""}`}
        actions={onAdd ? [{ icon: "add", label: "Nueva cuenta", onPress: onAdd, testID: "account-add" }] : undefined}
        toggleLabel="cuentas"
        count={sorted.length}
      >
        {sorted.map((a) => (
          <GroupRow
            key={a.id}
            dimmed={a.isArchived}
            leading={bankFor(a.name) ? <BankLogo name={a.name} size={36} /> : (
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: palette.glass, alignItems: "center", justifyContent: "center" }}>
                <Icon name={TYPE_ICON[a.type]} size="sm" color={palette.white} />
              </View>
            )}
            title={a.name}
            subtitle={`${ACCOUNT_TYPE_LABEL[a.type]} · ${a.currency}${a.isArchived ? " · archivada" : ""}${showFinance ? ` · ${a.financeName}` : ""}`}
            trailing={formatMoney(a.balance, a.currency)}
            onPress={() => setOpen({ kind: "account", account: a })}
          />
        ))}
      </ResourceGroupCard>

      {open ? <ResourceModal open={open} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

function Line({ name, sub, amount, currency }: { name: string; sub: string; amount: number; currency: "ARS" | "USD" }) {
  const { space } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={1}>{name}</Text>
        <Text variant="secondary" tone="inkMuted" numberOfLines={1}>{sub}</Text>
      </View>
      <Text variant="bodyStrong">{formatMoney(amount, currency)}</Text>
    </View>
  );
}

function ResourceModal({ open, onClose }: { open: Open; onClose: () => void }) {
  const { colors, space, radius } = useTheme();
  const { account } = open;
  const q = useAccountDetail(account.id);
  const movements = q.data?.movements ?? [];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={{ flex: 1, backgroundColor: colors.overlay }} />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingHorizontal: space[5], paddingTop: space[5], paddingBottom: space[8], maxHeight: "80%", gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
          <Text variant="screenTitle" numberOfLines={1} style={{ flexShrink: 1 }}>{account.name}</Text>
          <Text variant="secondary" tone="inkMuted" style={{ flex: 1 }}>· {ACCOUNT_TYPE_LABEL[account.type]}</Text>
          <IconButton icon="close" accessibilityLabel="Cerrar" onPress={onClose} />
        </View>
        <Text variant="number">{formatMoney(account.balance, account.currency)}</Text>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space[2] }}>
          {q.isPending ? <Text variant="secondary" tone="inkMuted">Cargando…</Text> : null}
          {q.isError ? <Text variant="secondary" tone="dangerInk">{accountErrorMessage(q.error)}</Text> : null}
          {q.isSuccess && !movements.length ? <Text variant="secondary" tone="inkMuted">Sin movimientos.</Text> : null}
          {movements.map((m) => (
            <Line key={`${m.type}-${m.id}`} name={m.name} sub={`${m.date ?? "Sin fecha"}${m.type === "TRANSFER" ? " · Transferencia" : m.type === "CARD_PAYMENT" ? " · Pago de tarjeta" : ""}`} amount={m.amount} currency={m.currency} />
          ))}
        </ScrollView>
        <Button variant="secondary" label="Administrar cuenta" onPress={() => { onClose(); router.push({ pathname: "/cuentas/[id]", params: { id: account.id } }); }} />
      </View>
    </Modal>
  );
}

/** Tarjetas: bloque de color con lo que queda por pagar y, desplegable en el mismo bloque, cada tarjeta. La flecha abre el resumen de todas; tocar una abre esa tarjeta. */
export function CardsGroup({ cards, showFinance, onAdd, onOpen }: { cards: ResourceCardDTO[]; showFinance: boolean; onAdd?: () => void; onOpen: (cardId: string | "all") => void }) {
  const ars = cards.reduce((n, c) => n + (c.unpaidArs ?? 0), 0);
  const usd = cards.reduce((n, c) => n + (c.unpaidUsd ?? 0), 0);
  const main: "ARS" | "USD" = ars > 0 || usd === 0 ? "ARS" : "USD";
  const other = main === "ARS" && usd > 0 ? formatMoney(usd, "USD") : null;
  const pending = cards.reduce((n, c) => n + (c.unpaidStatements ?? 0), 0);
  return (
    <ResourceGroupCard
      testID="cards-group"
      color={palette.entity.cards}
      title="Tarjetas"
      caption={pending ? "Por pagar" : "Al día"}
      amount={formatMoney(main === "ARS" ? ars : usd, main)}
      subtitle={`${cards.length} ${cards.length === 1 ? "tarjeta" : "tarjetas"}${other ? ` · ${other}` : ""}`}
      actions={[
        ...(onAdd ? [{ icon: "add" as const, label: "Agregar tarjeta", onPress: onAdd, testID: "card-add" }] : []),
        { icon: "arrow-forward" as const, label: "Ver resumen de todas las tarjetas", onPress: () => onOpen("all"), testID: "cards-summary-link" },
      ]}
      toggleLabel="tarjetas"
      count={cards.length}
    >
      {cards.map((c) => {
        const usdOnly = (c.unpaidUsd ?? 0) > 0 && !(c.unpaidArs ?? 0);
        const amount = usdOnly ? (c.unpaidUsd ?? 0) : (c.unpaidArs ?? 0);
        return (
          <GroupRow
            key={c.id}
            testID={`card-row-${c.id}`}
            leading={<BankLogo name={c.entity} size={36} />}
            title={c.name}
            subtitle={`${c.entity ?? ""}${showFinance ? ` · ${c.financeName}` : ""}`}
            trailing={formatMoney(amount, usdOnly ? "USD" : "ARS")}
            trailingCaption={c.unpaidStatements ? "por pagar" : "al día"}
            onPress={() => onOpen(c.id)}
          />
        );
      })}
    </ResourceGroupCard>
  );
}
