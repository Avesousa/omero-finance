import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Button, Icon, IconButton, Skeleton, Text, TextField, VStack } from "../../components/atoms";
import { ActionCircle, BigAmountField, DateField, FinanceChip, KeyboardDoneBar, MovementRow, PeriodSwitcher, SectionHeader } from "../../components/molecules";
import { BottomSheet, CardStatementCard } from "../../components/organisms";
import { useTheme } from "../../design-system";
import { palette } from "../../design-system/tokens/palette";
import { useActiveFinance, useCanWrite } from "../../providers/ActiveFinanceProvider";
import { cardMonth, cardsTotals, daysUntil, statementStatus, useCards, useMarkStatementPaid, usePlan } from "../../data";
import { currentPeriod, parseMoney } from "../../domain";
import { formatDate, formatMoney, formatPeriod, capitalize } from "../../i18n/format";
import { CardsBody } from "../cards/CardsOverviewBody";
import { CardsCarousel, type CarouselSlide } from "../cards/CardsCarousel";
import { CardPaymentSheet } from "./CardPaymentSheet";
import { useCardDetail, useResourceCards, useResourceMutation, type CardMovementDTO } from "./data";
import { ResourceMoveOptions } from "./AccountsScreen";
import { BankPicker, ChipRow, CurrencySelect, InstallmentsRow, NetworkPicker } from "./pickers";

type Form = "card" | "purchase" | "statement" | null;
export type CardSheetAction = "statement" | "purchase";
const MIN = "2020-01";
const MAX = "2035-12";
const PAY_MODES = [{ id: "TOTAL", label: "Total" }, { id: "MINIMUM", label: "Mínimo" }, { id: "CUSTOM", label: "Otro monto" }] as const;
const FORM_TITLE = { card: "Datos de la tarjeta", purchase: "Cargar compra", statement: "Cargar resumen" } as const;

function Movement({ m }: { m: CardMovementDTO }) {
  const statement = m.type === "STATEMENT";
  const sub = `${m.date ? capitalize(formatDate(m.date, "full")) : "Sin fecha"}${statement ? ` · ${m.isPaid ? "Pagado" : "Por pagar"}` : ""}${m.detail ? ` · ${m.detail}` : ""}`;
  return <MovementRow icon={statement ? "document-text-outline" : "bag-handle-outline"} title={m.name} subtitle={sub} amount={formatMoney(m.amount, m.currency)} />;
}

/** Título que se edita en el lugar: tocás el nombre (con lápiz) y escribís. Vacío, el servidor arma uno con el banco y la red. */
function EditableTitle({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { colors, space, type } = useTheme();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return <TextInput accessibilityLabel="Nombre de la tarjeta" autoFocus value={value} onChangeText={onChange} onBlur={() => setEditing(false)} onSubmitEditing={() => setEditing(false)} returnKeyType="done" maxLength={60} placeholder={placeholder} placeholderTextColor={colors.inkMuted} style={[type.screenTitle, { flex: 1, color: colors.ink, paddingVertical: 0, borderBottomWidth: 2, borderBottomColor: colors.primary }]} />;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Nombre de la tarjeta: ${value || placeholder}. Tocá para cambiarlo`} onPress={() => setEditing(true)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 44 }}>
      <Text variant="screenTitle" tone={value ? "ink" : "inkMuted"} numberOfLines={1} style={{ flexShrink: 1 }}>{value || placeholder}</Text>
      <Icon name="create-outline" size="sm" tone="inkMuted" />
    </Pressable>
  );
}


const MIN_PERIOD = "2026-06";
const MAX_PERIOD = "2027-04";

/**
 * Modal de tarjetas: un carrusel con «Todas» (resumen del mes) y cada tarjeta. `cardId` = "all" abre en el resumen,
 * un id abre esa tarjeta y null es una tarjeta nueva. Desde acá se cargan resúmenes y compras, se paga y se edita.
 */
export function CardManagerSheet({ cardId, initialForm, onClose }: { cardId: string | "all" | null; initialForm?: CardSheetAction; onClose: () => void }) {
  return <BottomSheet onClose={onClose}>{(close) => <CardManagerBody cardId={cardId} initialForm={initialForm} onClose={close} />}</BottomSheet>;
}

function CardManagerBody({ cardId, initialForm, onClose }: { cardId: string | "all" | null; initialForm?: CardSheetAction; onClose: () => void }) {
  const { colors, space, radius } = useTheme();
  const q = useResourceCards(); const mutation = useResourceMutation(); const { active, setActive, finances } = useActiveFinance(); const canWrite = useCanWrite();
  const [focus, setFocus] = useState<string>(cardId ?? "new");
  const [scrolling, setScrolling] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const ov = useCards(selected ?? undefined);
  const plan = usePlan(selected ?? undefined);
  const markPaid = useMarkStatementPaid();
  const [payId, setPayId] = useState<string | null>(null);
  const cards = q.data?.cards ?? [];
  const card = cards.find((c) => c.id === focus) ?? null;
  const detail = useCardDetail(card?.id ?? "");
  const [form, setForm] = useState<Form>(cardId === null ? "card" : null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [entity, setEntity] = useState(""); const [cardName, setCardName] = useState(""); const [cardType, setCardType] = useState("VISA");
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [currency, setCurrency] = useState<"ARS" | "USD">("ARS"); const [period, setPeriod] = useState(currentPeriod());
  const [dueDate, setDueDate] = useState(""); const [installments, setInstallments] = useState("1"); const [usd, setUsd] = useState(""); const [payMode, setPayMode] = useState<"TOTAL" | "MINIMUM" | "CUSTOM">("TOTAL");
  const [otherInst, setOtherInst] = useState(false); const [minimum, setMinimum] = useState(""); const [custom, setCustom] = useState("");
  const operable = !!card && card.householdId === active?.id && canWrite;
  const editable = !!card && card.isOwner && canWrite;
  const month = selected ?? ov.data?.period ?? currentPeriod();

  const open = (f: Form, target = card) => {
    setForm(f); setAmount(""); setName(""); setUsd(""); setPeriod(currentPeriod()); setDueDate(""); setMinimum(""); setCustom(""); setInstallments("1"); setOtherInst(false);
    if (f === "card") { setEntity(target?.entity ?? ""); setCardName(target?.name ?? ""); setCardType(target?.cardType ?? "VISA"); }
  };
  useEffect(() => { if (card && form === "card") { setEntity(card.entity ?? ""); setCardName(card.name ?? ""); setCardType(card.cardType ?? "VISA"); } }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialForm && card && !autoOpened) { setAutoOpened(true); const ok = card.householdId === active?.id && canWrite && (initialForm === "purchase" || card.isOwner); if (ok) open(initialForm, card); }
  }, [card?.id, active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const path = form === "card" ? card ? `/api/plan/cards/${card.id}` : "/api/plan/cards" : form === "purchase" ? "/api/plan/card-purchases" : "/api/plan/card-statements";
    const body = form === "card" ? { entity, cardType, name: cardName.trim() || undefined } : form === "purchase" ? { cardId: card?.id, description: name, amount: parseMoney(amount), currency, installments: Number(installments), firstPeriod: period } : { cardId: card?.id, period, totalArs: parseMoney(amount), usdAmount: parseMoney(usd) || null, dueDate: dueDate || null, payMode, minimumArs: minimum ? parseMoney(minimum) : null, customAmount: custom ? parseMoney(custom) : null };
    mutation.mutate({ method: form === "card" && card ? "PATCH" : "POST", path, body }, { onSuccess: () => { if (!card) onClose(); else setForm(null); } });
  };
  const undoPaid = (id: string) => { const st = plan.data?.statements.find((x) => x.cardId === id && x.isPaid); if (st) mutation.mutate({ method: "POST", path: `/api/plan/card-statements/${st.id}/unpay`, body: {} }); };

  // Carrusel: «Todas» + cada tarjeta, con el monto del mes cuando hay datos.
  const slides = useMemo<CarouselSlide[]>(() => {
    const label = capitalize(formatPeriod(month));
    const data = ov.data;
    const totals = data ? cardsTotals(data, month) : null;
    const sumArs = cards.reduce((n, c) => n + (c.unpaidArs ?? 0), 0);
    const all: CarouselSlide = {
      key: "all", aggregate: true, color: palette.entity.cards, title: "Todas las tarjetas", caption: `Por pagar · ${label}`,
      amount: formatMoney(totals ? totals.toPay : sumArs),
      holder: `${cards.length} ${cards.length === 1 ? "tarjeta" : "tarjetas"}${totals ? ` · Pagado ${formatMoney(totals.paid)}${totals.estimated > 0 ? ` · Estimado ${formatMoney(totals.estimated)}` : ""}` : ""}`,
    };
    return [all, ...cards.map((c) => {
      const mine = data?.cards.find((x) => x.id === c.id);
      if (data && mine) {
        const { statement, projectedArs } = cardMonth(data, c.id, month);
        const st = statementStatus(statement, projectedArs, data.today);
        return { key: c.id, title: c.name, bank: c.entity, network: c.cardType, caption: `${st === "paid" ? "Pagado" : st === "estimated" ? "Estimado" : "A pagar"} · ${label}`, amount: formatMoney(statement ? statement.totalArs : projectedArs) };
      }
      return { key: c.id, title: c.name, bank: c.entity, network: c.cardType, caption: "A pagar", amount: formatMoney(c.unpaidArs ?? 0) };
    })];
  }, [cards, ov.data, month]);
  const slideIndex = focus === "all" || !card ? 0 : slides.findIndex((s) => s.key === focus);
  const goTo = (i: number) => setFocus(i <= 0 ? "all" : slides[i]?.key ?? "all");

  const label = (t: string) => <Text variant="bodyStrong">{t}</Text>;
  const title = form === "card" ? null : form ? FORM_TITLE[form] : "Tarjetas";
  const mine = card ? ov.data?.cards.find((x) => x.id === card.id) : undefined;
  const month$ = card && ov.data && mine ? cardMonth(ov.data, card.id, month) : null;
  const status = month$ && ov.data ? statementStatus(month$.statement, month$.projectedArs, ov.data.today) : null;
  const payable = !!month$ && !month$.statement?.isPaid && !!operable && card?.isOwner;
  const movements = detail.data?.movements ?? [];
  // Mientras no estén la lista de tarjetas y el resumen del mes, todo se dibuja como bloques del mismo tamaño que lo definitivo.
  const ready = !q.isPending && !ov.isPending;
  // Mientras se desliza o carga, el contenido de abajo es un esqueleto con la misma estructura: se nota que está cambiando de tarjeta.
  const settled = ready && !scrolling;

  return (
    <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], paddingBottom: space[3] }}>
            {form === "card" ? <EditableTitle value={cardName} onChange={setCardName} placeholder="Nombre de la tarjeta" /> : <Text variant="screenTitle" numberOfLines={1} style={{ flex: 1 }}>{title}</Text>}
            {!form && cardId !== null ? <PeriodSwitcher compact period={month} onChange={setSelected} min={MIN_PERIOD} max={MAX_PERIOD} /> : null}
            <IconButton icon="close" accessibilityLabel="Cerrar" onPress={onClose} />
          </View>
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space[4], paddingBottom: space[4] }}>
            {!form && cardId !== null ? <>
              {ready ? <CardsCarousel slides={slides} index={Math.max(0, slideIndex)} onIndexChange={goTo} onScrollingChange={setScrolling} /> : <View style={{ gap: space[3] }}><Skeleton height={176} shape="hero" /><View style={{ height: 8 }} /></View>}
              {mutation.error ? <Text variant="secondary" tone="dangerInk">{mutation.error.message}</Text> : null}

              {!settled ? (
                <View style={{ gap: space[4] }} accessibilityLabel="Cargando tarjeta"><Skeleton height={44} shape="pill" /><Skeleton height={150} /><Skeleton height={64} /><Skeleton height={64} /></View>
              ) : !card ? (
                ov.isError || !ov.data ? <Text variant="secondary" tone="dangerInk">No pudimos cargar el resumen. Deslizá para refrescar o reintentá.</Text> : ov.data.cards.length === 0 ? <Text variant="secondary" tone="inkMuted">Todavía no hay tarjetas en esta finanza.</Text> : (
                  <CardsBody
                    data={ov.data}
                    period={month}
                    markingId={markPaid.isPending ? markPaid.variables?.cardId : undefined}
                    onOpenCard={(id) => setFocus(id)}
                    onLoadStatement={canWrite ? (id) => { setFocus(id); const t = cards.find((c) => c.id === id); if (t) open("statement", t); } : undefined}
                    onMarkPaid={canWrite ? setPayId : undefined}
                    onUndo={canWrite ? undoPaid : undefined}
                  />
                )
              ) : <>
                <FinanceChip name={card.originFinanceName ? `${card.financeName} · origen ${card.originFinanceName}` : card.financeName} />
                {operable ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                    {card.isOwner ? <ActionCircle testID="card-load-statement" emphasis="solid" icon="document-text-outline" label="Cargar resumen" onPress={() => open("statement")} /> : null}
                    <ActionCircle testID="card-load-purchase" emphasis={card.isOwner ? "outline" : "solid"} icon="bag-add-outline" label="Cargar compra" onPress={() => open("purchase")} />
                    {payable ? <ActionCircle testID="card-pay" icon="checkmark-circle-outline" label={markPaid.isPending ? "Pagando…" : "Pagar"} disabled={markPaid.isPending} onPress={() => setPayId(card.id)} /> : null}
                    {editable ? <ActionCircle testID="card-edit" icon="create-outline" label="Editar" onPress={() => open("card")} /> : null}
                  </View>
                ) : finances.some((f) => f.id === card.householdId) ? <Button label={`Operar en ${card.financeName}`} onPress={() => void setActive(card.householdId)} /> : null}
                {month$ && status ? (
                  <CardStatementCard
                    card={{ name: card.name, entity: card.entity, brand: (card.cardType as never) ?? null }}
                    amount={month$.statement ? month$.statement.totalArs : month$.projectedArs}
                    status={status}
                    dueDate={month$.statement?.dueDate ?? null}
                    daysLeft={month$.statement?.dueDate && ov.data ? daysUntil(month$.statement.dueDate, ov.data.today) : undefined}
                    minimum={month$.statement?.minimumArs ?? null}
                    usdAmount={month$.statement?.usdAmount ?? null}
                    installmentsCount={month$.installmentsCount}
                    onMarkPaid={payable ? () => setPayId(card.id) : undefined}
                    onUndoPaid={canWrite && card.isOwner ? () => undoPaid(card.id) : undefined}
                  />
                ) : null}
                <View style={{ gap: space[1] }}>
                  <SectionHeader title="Movimientos" />
                  {detail.isPending ? <><Skeleton height={56} /><Skeleton height={56} /></> : null}
                  {detail.isSuccess && !movements.length ? <Text variant="secondary" tone="inkMuted">Todavía no hay compras ni resúmenes cargados.</Text> : null}
                  {movements.slice(0, 30).map((m) => <Movement key={`${m.type}-${m.id}`} m={m} />)}
                </View>
              </>}
            </> : null}

            {form ? <VStack gap={4}>
              {form === "card" ? <>
                <Text variant="secondary" tone="inkMuted">Tocá el nombre de arriba para cambiarlo.</Text>
                <VStack gap={2}>{label("Banco")}<BankPicker value={entity} onChange={(n) => setEntity(n)} /></VStack>
                <VStack gap={2}>{label("Red de la tarjeta")}<NetworkPicker value={cardType} onChange={setCardType} /></VStack>
              </> : <>
                <VStack gap={1}>
                  <Text variant="secondaryStrong" tone="inkMuted" align="center">{form === "statement" ? "Total del resumen en pesos" : "Monto de la compra"}</Text>
                  <BigAmountField autoFocus accessibilityLabel={form === "statement" ? "Total en pesos" : "Monto total"} value={amount} onChange={setAmount} symbol={form === "purchase" && currency === "USD" ? "US$" : "$"} />
                  {form === "purchase" ? <View style={{ alignItems: "center" }}><CurrencySelect value={currency} onChange={setCurrency} /></View> : null}
                </VStack>
                {form === "purchase" ? <>
                  <VStack gap={2}>{label("Descripción")}<TextField accessibilityLabel="Descripción" placeholder="¿Qué compraste?" value={name} onChangeText={setName} /></VStack>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[2] }}>
                    <View style={{ flexShrink: 1, gap: space[1] }}>
                      {label("Cuotas")}
                      <InstallmentsRow value={installments} custom={otherInst} onSelect={(n) => { setOtherInst(false); setInstallments(n); }} onCustom={(n) => { setOtherInst(true); setInstallments(n); }} />
                    </View>
                    <View style={{ gap: space[1] }}>
                      {label("Primera cuota")}
                      <PeriodSwitcher compact period={period} onChange={setPeriod} min={MIN} max={MAX} />
                    </View>
                  </View>
                </> : null}
                {form === "statement" ? <VStack gap={2}>
                  {label("Mes del resumen")}
                  <PeriodSwitcher compact period={period} onChange={setPeriod} min={MIN} max={MAX} />
                </VStack> : null}
                {form === "statement" ? <>
                  <VStack gap={2}>{label("Vencimiento")}<DateField label="Vencimiento" value={dueDate} onChange={setDueDate} placeholder="Sin fecha" clearable /></VStack>
                  <VStack gap={1}>
                    <Text variant="secondaryStrong" tone="inkMuted" align="center">Total en dólares (opcional)</Text>
                    <BigAmountField accessibilityLabel="Total en dólares" value={usd} onChange={setUsd} symbol="US$" />
                  </VStack>
                  <VStack gap={2}>{label("¿Cuánto vas a pagar?")}<ChipRow value={payMode} options={PAY_MODES} onChange={setPayMode} /></VStack>
                  {payMode === "MINIMUM" ? <VStack gap={1}><Text variant="secondaryStrong" tone="inkMuted" align="center">Pago mínimo</Text><BigAmountField accessibilityLabel="Pago mínimo" value={minimum} onChange={setMinimum} /></VStack> : null}
                  {payMode === "CUSTOM" ? <VStack gap={1}><Text variant="secondaryStrong" tone="inkMuted" align="center">Monto a pagar</Text><BigAmountField accessibilityLabel="Otro monto a pagar" value={custom} onChange={setCustom} /></VStack> : null}
                </> : null}
              </>}
              {mutation.error ? <Text variant="secondary" tone="dangerInk">{mutation.error.message}</Text> : null}
              <View style={{ flexDirection: "row", gap: space[3] }}>
                <View style={{ flex: 1 }}><Button variant="secondary" label="Cancelar" onPress={() => (card ? setForm(null) : onClose())} /></View>
                <View style={{ flex: 1 }}><Button label="Guardar" busy={mutation.isPending} disabled={form === "purchase" && !(Number(installments) >= 1)} onPress={save} /></View>
              </View>
              {form === "card" && card && editable ? <VStack gap={3}>
                <ResourceMoveOptions resource={card} kind="cards" />
                <Button variant="text" label="Eliminar tarjeta sin historial" onPress={() => mutation.mutate({ method: "DELETE", path: `/api/plan/cards/${card.id}` }, { onSuccess: onClose })} />
              </VStack> : null}
            </VStack> : null}
          </ScrollView>
        <KeyboardDoneBar />
      {payId ? (() => {
        const target = cards.find((c) => c.id === payId);
        const st = ov.data ? cardMonth(ov.data, payId, month).statement : null;
        const total = st ? st.totalArs + (st.usdAmount ?? 0) * (ov.data?.usdRate ?? 0) : null;
        return (
          <CardPaymentSheet
            cardName={target?.name ?? "Tarjeta"}
            monthLabel={capitalize(formatPeriod(month))}
            statement={{ total, minimum: st?.minimumArs ?? null, usdAmount: st?.usdAmount ?? null }}
            busy={markPaid.isPending}
            error={markPaid.error?.message}
            onClose={() => { markPaid.reset(); setPayId(null); }}
            onConfirm={(p) => markPaid.mutate({ cardId: payId, period: month, accountId: p.accountId, usdAccountId: p.usdAccountId, paidAt: p.paidAt, mode: p.mode, amount: p.amount }, { onSuccess: () => setPayId(null) })}
          />
        );
      })() : null}
    </>
  );
}
