import { useTranslation } from "react-i18next";
import { useMascotLine } from "../../../mascots/useMascotLine";
import type { MascotLineMessage } from "./types";

/** Texto de un `mascot.line` en la voz de la mascota y el modo actuales (traduce la acción de `voiceNotYet`). */
export function useChatLine(message: Pick<MascotLineMessage, "moment" | "vars" | "intent">): string {
  const { t } = useTranslation("mascots");
  const action = message.intent ? (t as unknown as (k: string) => string)(`common.actions.${message.intent}`) : undefined;
  return useMascotLine(message.moment, action ? { ...message.vars, action } : message.vars);
}
