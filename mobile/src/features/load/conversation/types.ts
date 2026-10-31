import type { EntryDraft, VoicePendingIntent } from "../../../domain/index.ts";
import type { MascotMoment } from "../../../mascots/types.ts";

/** Tipos de carga manual que ofrece la mascota como respuestas rápidas. */
export type ManualKind = "income" | "debt" | "expense" | "statement";

interface Base {
  id: string;
  /** Epoch ms. */
  at: number;
}

export interface UserTextMessage extends Base {
  from: "user";
  kind: "user.text";
  text: string;
}

export interface UserAudioMessage extends Base {
  from: "user";
  kind: "user.audio";
  uri: string;
  durationMs: number;
  /** ~32 barras, 0..1. */
  waveform: number[];
  /** Lo que se escuchó; llega con la respuesta. */
  transcript?: string;
}

/** El texto se resuelve al renderizar (`useChatLine`) para que cambie con la mascota y el modo. */
export interface MascotLineMessage extends Base {
  from: "mascot";
  kind: "mascot.line";
  moment: MascotMoment;
  vars?: Record<string, string | number>;
  /** Solo en `voiceNotYet`: la acción que todavía no se carga (`useChatLine` la traduce). */
  intent?: VoicePendingIntent;
}

export interface MascotTypingMessage extends Base {
  from: "mascot";
  kind: "mascot.typing";
}

/** Opciones de carga manual como respuestas rápidas. */
export interface MascotOptionsMessage extends Base {
  from: "mascot";
  kind: "mascot.options";
}

/** `pending` = esperando Confirmar/Editar (también si se cerró el formulario sin guardar). */
export type DraftStatus = "pending" | "saving" | "saved";

/** De dónde salió el borrador: el formulario muestra "Escuché: …" solo si fue un audio. */
export type DraftSource = "audio" | "text";

export interface MascotDraftMessage extends Base {
  from: "mascot";
  kind: "mascot.draft";
  draftId: string;
  intent: "income" | "expense";
  draft: EntryDraft;
  source: DraftSource;
  /** Lo que se escuchó; solo si `source` es "audio". */
  transcript?: string;
  status: DraftStatus;
  /** Monto ya formateado, cuando `status` es "saved". */
  savedAmount?: string;
  /** El último intento de guardar falló (vuelve a `pending` con el aviso). */
  error?: boolean;
}

export interface MascotErrorMessage extends Base {
  from: "mascot";
  kind: "mascot.error";
  /** Id del mensaje del usuario que se puede reenviar. */
  retryOf: string;
  retryable: boolean;
}

export type ChatMessage =
  | UserTextMessage
  | UserAudioMessage
  | MascotLineMessage
  | MascotTypingMessage
  | MascotOptionsMessage
  | MascotDraftMessage
  | MascotErrorMessage;

export type ChatMessageKind = ChatMessage["kind"];
