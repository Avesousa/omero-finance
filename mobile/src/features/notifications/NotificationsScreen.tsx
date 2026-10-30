import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Divider, HStack, IconButton, Skeleton, Surface, Text, VStack } from "../../components/atoms";
import { EmptyState, SectionHeader } from "../../components/molecules";
import { NoticeRow, PendingConfirmCard } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { useConfirmPayment, useHome, useNotifications, type PendingPayment } from "../../data";
import { useTheme } from "../../design-system";

const TOAST_MS = 3000;

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Notificaciones: "Por confirmar" (pagos de Apple Pay con botón Confirmar) y, aparte, "Avisos". */
export function NotificationsScreen() {
  const { t } = useTranslation("notifications");
  const { t: tc } = useTranslation("common");
  const { colors, radius, space } = useTheme();
  const { data, isPending, isError, refetch } = useNotifications();
  const { data: home } = useHome();
  const confirm = useConfirmPayment();
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = home?.today ?? localToday();

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const show = useCallback((text: string) => {
    setToast(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // Confirmar con la categoría por defecto de la fuente de datos (la elección de categoría llega con Cargar).
  const onConfirm = useCallback(
    (payment: PendingPayment) => {
      setBusyId(payment.id);
      confirm.mutate(
        { id: payment.id },
        {
          onSuccess: () => show(t("pending.confirmed")),
          onError: () => show(t("pending.confirmError")),
          onSettled: () => setBusyId(null),
        },
      );
    },
    [confirm, show, t],
  );

  const back = (
    <HStack gap={3}>
      <IconButton icon="chevron-back" accessibilityLabel={tc("actions.back")} onPress={() => router.back()} />
      <Text variant="screenTitle" accessibilityRole="header">
        {t("title")}
      </Text>
    </HStack>
  );

  return (
    <ScreenTemplate edges={["top", "bottom"]} testID="notifications">
      {back}

      {toast ? (
        <View
          testID="toast"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ padding: space[3], borderRadius: radius.button, borderWidth: 2, borderColor: colors.positive, backgroundColor: colors.surface }}
        >
          <Text variant="secondaryStrong" tone="positiveInk">
            {toast}
          </Text>
        </View>
      ) : null}

      {isPending ? (
        <VStack gap={4} accessibilityLabel={tc("status.loading")}>
          <Skeleton height={150} />
          <Skeleton height={80} />
        </VStack>
      ) : isError || !data ? (
        <EmptyState title={t("state.errorTitle")} description={t("state.errorBody")} action={{ label: tc("actions.retry"), onPress: () => void refetch() }} />
      ) : (
        <>
          <VStack gap={3} testID="section-pending">
            <VStack gap={1}>
              <SectionHeader title={t("pending.title")} count={data.pending.length} />
              <Text variant="secondary" tone="inkMuted">
                {t("pending.subtitle")}
              </Text>
            </VStack>
            {data.pending.length === 0 ? (
              <Surface>
                <EmptyState title={t("pending.empty")} description={t("pending.emptyHint")} />
              </Surface>
            ) : (
              data.pending.map((p) => <PendingConfirmCard key={p.id} payment={p} today={today} busy={busyId === p.id} onConfirm={onConfirm} />)
            )}
          </VStack>

          <Divider />

          <VStack gap={2} testID="section-notices">
            <SectionHeader title={t("notices.title")} />
            {data.notices.length === 0 ? (
              <Surface>
                <EmptyState title={t("notices.empty")} description={t("notices.emptyHint")} />
              </Surface>
            ) : (
              <Surface>
                {data.notices.map((n) => (
                  <NoticeRow key={n.id} notice={n} today={today} />
                ))}
              </Surface>
            )}
          </VStack>
        </>
      )}
    </ScreenTemplate>
  );
}
