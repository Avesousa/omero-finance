import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatDate, formatMoney } from "../../i18n/format";
import { useFormatWhen } from "../../i18n/useFormatWhen";
import type { AppNotice, NoticeKind } from "../../data/types";
import { Icon, Text, type IconName } from "../atoms";

export interface NoticeRowProps {
  notice: AppNotice;
  /** Fecha 'YYYY-MM-DD' de referencia para "hoy" / "ayer". */
  today: string;
}

const NOTICE_ICON: Record<NoticeKind, IconName> = {
  due: "calendar-outline",
  weekClosed: "checkmark-circle-outline",
  debtDown: "trending-down-outline",
};

/** Aviso informativo: ícono según el tipo, texto con montos/fechas formateados, cuándo y marca de "sin leer". */
export function NoticeRow({ notice, today }: NoticeRowProps) {
  const { t } = useTranslation("notifications");
  const { colors, radius, space, sizes } = useTheme();
  const formatWhen = useFormatWhen();
  const { name, date, amount, n } = notice.params;
  const translate = t as unknown as (key: string, options: Record<string, string | number>) => string;
  const text = translate(`notices.${notice.kind}`, {
    name: name ?? "",
    date: date ? formatDate(date, "short") : "",
    amount: amount != null ? formatMoney(amount) : "",
    n: n ?? 0,
  });
  const when = formatWhen(notice.at, today);
  return (
    <View
      testID={`notice-${notice.id}`}
      accessible
      accessibilityLabel={`${notice.read ? "" : `${t("notices.unread")}. `}${text}. ${when}`}
      style={{ minHeight: sizes.touch, flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2] }}
    >
      <View
        style={{
          width: sizes.touch,
          height: sizes.touch,
          borderRadius: radius.pill,
          backgroundColor: colors.bg,
          borderWidth: sizes.hairline,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={NOTICE_ICON[notice.kind]} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant={notice.read ? "body" : "bodyStrong"}>{text}</Text>
        <Text variant="secondary" tone="inkMuted">
          {when}
        </Text>
      </View>
      {notice.read ? null : (
        <View style={{ width: space[2], height: space[2], borderRadius: radius.pill, backgroundColor: colors.danger }} />
      )}
    </View>
  );
}
