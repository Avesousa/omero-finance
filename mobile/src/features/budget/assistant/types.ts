import type { MascotMoment } from "../../../mascots/types.ts";
import type { AssistantTarget } from "../../../data/types.ts";

export type { AssistantTarget };

/** Una línea ya decidida: el tope que se guardaría para la categoría. */
export interface AssistantLine {
  categoryId: string;
  name: string;
  amount: number;
}

interface Base {
  id: string;
  /** Epoch ms. */
  at: number;
}

/** Texto de la mascota: se resuelve al renderizar (cambia con la mascota y el modo). `amount` va en número y se formatea al dibujar. */
export interface AssistantLineMessage extends Base {
  from: "mascot";
  kind: "mascot.line";
  moment: MascotMoment;
  vars?: { name?: string; amount?: number };
}

/** Resumen final: las líneas que se guardarían. El "Sin asignar" resultante lo calcula la pantalla con el plan. */
export interface AssistantSummaryMessage extends Base {
  from: "mascot";
  kind: "mascot.summary";
  lines: AssistantLine[];
}

export interface AssistantUserText extends Base {
  from: "user";
  kind: "user.text";
  text: string;
}

/** Respuesta con un toque: "Igual", "Cambiar", "Saltar", una categoría para agregar, "No, listo" o "Confirmar". */
export interface AssistantUserChoice extends Base {
  from: "user";
  kind: "user.choice";
  choice: "same" | "change" | "skip" | "pick" | "done" | "confirm";
  /** Monto (en "same") o nombre de la categoría (en "pick"). */
  amount?: number;
  name?: string;
}

export type AssistantMessage = AssistantLineMessage | AssistantSummaryMessage | AssistantUserText | AssistantUserChoice;
