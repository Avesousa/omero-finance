"use client";

import { useState, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ExpenseTarget = "casa" | "personal";
type ExpenseCategory = "mercado" | "general" | "fijo";
type Currency = "ARS" | "USD";

interface FormState {
  amount: string;
  currency: Currency;
  category: ExpenseCategory;
  description: string;
  expenseType: "NECESSARY" | "UNNECESSARY";
  cardName: string;
  convertToArs: boolean;
}

const DEFAULT_FORM: FormState = {
  amount: "",
  currency: "ARS",
  category: "mercado",
  description: "",
  expenseType: "UNNECESSARY",
  cardName: "",
  convertToArs: false,
};

const CARDS = [
  "VISA MARIA BBVA",
  "VISA MARIA CP",
  "VISA AVELINO BN",
  "MC AVELINO BN",
  "VISA AVELINO BK",
  "MC AVELINO MP",
];

interface ExpenseFormProps {
  currentRate: number;
  onSubmit: (data: FormState & { target: ExpenseTarget }) => Promise<void>;
}

export function ExpenseForm({ currentRate, onSubmit }: ExpenseFormProps) {
  const [target, setTarget] = useState<ExpenseTarget>("casa");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isListening, setIsListening] = useState(false);
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const update = (patch: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  /* ── Voice recording ─────────────────────── */
  async function startListening() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = handleVoiceStop;
      recorder.start();
      mediaRef.current = recorder;
      setIsListening(true);
      setVoiceHint(null);
    } catch {
      setVoiceHint("No se pudo acceder al micrófono");
    }
  }

  function stopListening() {
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    setIsListening(false);
  }

  async function handleVoiceStop() {
    setIsParsingVoice(true);
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("audio", blob, "voice.webm");
      fd.append("target", target);

      const res = await fetch("/api/voice/parse", { method: "POST", body: fd });
      const json = await res.json();

      if (json.fields) {
        update(json.fields);
        if (json.hint) setVoiceHint(json.hint);
      }
    } catch {
      setVoiceHint("No se pudo interpretar el audio. Intentá de nuevo.");
    } finally {
      setIsParsingVoice(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ ...form, target });
      setForm(DEFAULT_FORM);
      setVoiceHint(null);
      // Haptic feedback on mobile
      navigator.vibrate?.(50);
    } finally {
      setIsSubmitting(false);
    }
  }

  const showCard = target === "casa" && form.category !== "fijo";
  const showExpenseType = target === "casa" && form.category === "general";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      {/* Target toggle */}
      <div
        className="flex border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {(["casa", "personal"] as ExpenseTarget[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTarget(t); setForm(DEFAULT_FORM); }}
            className="flex-1 py-3 text-sm font-medium transition-colors"
            style={{
              backgroundColor: target === t ? "var(--accent)" : "transparent",
              color: target === t ? "var(--accent-foreground)" : "var(--text-secondary)",
            }}
          >
            {t === "casa" ? "🏠 Casa" : "👤 Personal"}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* Voice button */}
        <button
          type="button"
          onPointerDown={startListening}
          onPointerUp={stopListening}
          onPointerLeave={stopListening}
          disabled={isParsingVoice}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors"
          style={{
            borderColor: isListening ? "var(--accent)" : "var(--border)",
            backgroundColor: isListening ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)",
            color: isListening ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          {isParsingVoice ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isListening ? (
            <MicOff size={18} />
          ) : (
            <Mic size={18} />
          )}
          <span className="text-sm">
            {isParsingVoice
              ? "Interpretando..."
              : isListening
              ? "Soltá para procesar"
              : "Mantené para hablar"}
          </span>
        </button>

        {voiceHint && (
          <p
            className="text-xs px-1"
            style={{ color: "var(--accent-amber)" }}
          >
            {voiceHint}
          </p>
        )}

        <div
          className="border-t pt-3"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Amount + currency */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label
                htmlFor="amount"
                className="text-xs mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Monto
              </Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.amount}
                onChange={(e) => update({ amount: e.target.value })}
                className="text-lg font-semibold tabular-nums h-12"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div className="w-24">
              <Label
                className="text-xs mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Moneda
              </Label>
              <Select
                value={form.currency}
                onValueChange={(v) => update({ currency: v as Currency })}
              >
                <SelectTrigger
                  className="h-12"
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rate hint for USD */}
          {form.currency === "USD" && currentRate > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                1 USD = ${currentRate.toLocaleString("es-AR")}
              </p>
              <button
                type="button"
                onClick={() => update({ convertToArs: !form.convertToArs })}
                className="text-xs px-2 py-0.5 rounded-full border transition-colors"
                style={{
                  borderColor: form.convertToArs ? "var(--accent)" : "var(--border)",
                  color: form.convertToArs ? "var(--accent)" : "var(--text-secondary)",
                  backgroundColor: form.convertToArs ? "rgba(99,102,241,0.1)" : "transparent",
                }}
              >
                {form.convertToArs ? "✓ Convertir a ARS" : "Convertir a ARS"}
              </button>
            </div>
          )}
        </div>

        {/* Category (casa only) */}
        {target === "casa" && (
          <div>
            <Label
              className="text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Tipo
            </Label>
            <div className="flex gap-2">
              {(["mercado", "general", "fijo"] as ExpenseCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update({ category: c })}
                  className="flex-1 py-2 rounded-xl text-sm font-medium border transition-colors capitalize"
                  style={{
                    backgroundColor: form.category === c ? "var(--accent)" : "var(--bg-elevated)",
                    borderColor: form.category === c ? "var(--accent)" : "var(--border)",
                    color: form.category === c ? "var(--accent-foreground)" : "var(--text-secondary)",
                  }}
                >
                  {c === "mercado" ? "🛒" : c === "general" ? "💸" : "📌"} {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Expense type (necessary / unnecessary) */}
        {showExpenseType && (
          <div>
            <Label
              className="text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Clasificación
            </Label>
            <div className="flex gap-2">
              {(["NECESSARY", "UNNECESSARY"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update({ expenseType: t })}
                  className="flex-1 py-2 rounded-xl text-sm border transition-colors"
                  style={{
                    backgroundColor: form.expenseType === t ? "var(--bg-elevated)" : "transparent",
                    borderColor: form.expenseType === t ? "var(--accent)" : "var(--border)",
                    color: form.expenseType === t ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {t === "NECESSARY" ? "✅ Necesario" : "💭 Innecesario"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <Label
            htmlFor="description"
            className="text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Descripción <span style={{ color: "var(--text-secondary)" }}>(opcional)</span>
          </Label>
          <Input
            id="description"
            placeholder={
              target === "personal"
                ? "ej: Uñas, Sube, Gym..."
                : form.category === "mercado"
                ? "ej: Coto, Jumbo..."
                : "ej: Pizza, Uber..."
            }
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            style={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Card selector */}
        {showCard && (
          <div>
            <Label
              className="text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Tarjeta <span style={{ color: "var(--text-secondary)" }}>(opcional)</span>
            </Label>
            <Select
              value={form.cardName}
              onValueChange={(v) => update({ cardName: v ?? "" })}
            >
              <SelectTrigger
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <SelectValue placeholder="Sin tarjeta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin tarjeta</SelectItem>
                {CARDS.map((card) => (
                  <SelectItem key={card} value={card}>
                    {card}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={!form.amount || isSubmitting}
          className="w-full h-12 text-base font-semibold rounded-xl"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-foreground)",
          }}
        >
          {isSubmitting ? (
            <Loader2 size={18} className="animate-spin mr-2" />
          ) : null}
          {isSubmitting ? "Guardando..." : "Agregar →"}
        </Button>
      </div>
    </form>
  );
}
