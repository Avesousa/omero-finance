import { useTranslation } from "react-i18next";
import { Button } from "../atoms";

export interface ChatErrorActionsProps {
  onRetry: () => void;
  disabled?: boolean;
}

/** Acción bajo el mensaje de error de la mascota: reenviar lo mismo. */
export function ChatErrorActions({ onRetry, disabled }: ChatErrorActionsProps) {
  const { t } = useTranslation("load");
  return <Button testID="chat-retry" variant="secondary" fullWidth={false} icon="refresh" label={t("retry")} disabled={disabled} onPress={onRetry} />;
}
