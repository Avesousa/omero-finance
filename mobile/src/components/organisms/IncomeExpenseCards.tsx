import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatMoney } from "../../i18n/format";
import { Icon, Surface, Text } from "../atoms";
import { maskedMoney } from "./privacy";

export interface IncomeExpenseCardsProps {
  /** Ingresos del mes. */
  income: number;
  /** Gastos del mes (lo que ya salió). */
  expenses: number;
  /** Montos ocultos (ojito). */
  hidden?: boolean;
  onIncomePress?: () => void;
  onExpensesPress?: () => void;
}

interface CardProps {
  testID: string;
  label: string;
  amount: string;
  a11y: string;
  hint: string;
  arrow: "arrow-up" | "arrow-down";
  positive: boolean;
  onPress?: () => void;
}

function FlowCard({ testID, label, amount, a11y, hint, arrow, positive, onPress }: CardProps) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
    >
      <Surface style={{ gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.pill,
              backgroundColor: positive ? colors.positiveTint : colors.dangerTint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={arrow} size="sm" color={positive ? colors.positiveInk : colors.dangerInk} />
          </View>
          <Text variant="bodySemi" tone="inkMuted" numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </Text>
          <Icon name="chevron-forward" size="sm" tone="inkMuted" />
        </View>
        <Text variant="numberSmall" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {amount}
        </Text>
      </Surface>
    </Pressable>
  );
}

/** Dos tarjetas lado a lado: Ingresos (flecha arriba, verde) y Gastos (flecha abajo, roja) del mes, cada una con su chevron. */
export function IncomeExpenseCards({ income, expenses, hidden = false, onIncomePress, onExpensesPress }: IncomeExpenseCardsProps) {
  const { t } = useTranslation("home");
  const { space } = useTheme();
  const incomeText = hidden ? maskedMoney() : formatMoney(income);
  const expensesText = hidden ? maskedMoney() : formatMoney(expenses);
  return (
    <View style={{ flexDirection: "row", gap: space[3] }}>
      <FlowCard
        testID="card-income"
        label={t("cards.income")}
        amount={incomeText}
        a11y={t("cards.incomeA11y", { amount: hidden ? t("balance.hiddenAmount") : formatMoney(income) })}
        hint={t("cards.open")}
        arrow="arrow-up"
        positive
        onPress={onIncomePress}
      />
      <FlowCard
        testID="card-expenses"
        label={t("cards.expenses")}
        amount={expensesText}
        a11y={t("cards.expensesA11y", { amount: hidden ? t("balance.hiddenAmount") : formatMoney(expenses) })}
        hint={t("cards.open")}
        arrow="arrow-down"
        positive={false}
        onPress={onExpensesPress}
      />
    </View>
  );
}
