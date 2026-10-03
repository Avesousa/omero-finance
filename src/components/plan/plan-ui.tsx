"use client";

/**
 * Plan simple — piezas de interfaz compartidas.
 * Usan los mismos tokens que el resto de la app (globals.css).
 */

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  addMonths, currentPeriod, formatMoneyInput, periodLabel, type Currency,
} from "@/lib/plan/core";

// ─── Estilos base ─────────────────────────────────────────────────────────────

export const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow-card)",
};

export const fieldStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-elevated)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

export const TONE = {
  ok: "var(--accent-green)",
  near: "var(--accent-amber)",
  over: "var(--accent-red)",
  muted: "var(--text-secondary)",
} as const;

// ─── Llamadas a la API ────────────────────────────────────────────────────────

export async function api(method: string, url: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "No se pudo guardar");
  return json;
}

/**
 * Ejecuta una acción, refresca los datos del servidor y expone estado de carga y error.
 * `after` (por ejemplo, cerrar la hoja) corre recién cuando los datos nuevos ya están en
 * pantalla, para no mostrar por un instante la lista vieja.
 */
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const afterRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!refreshing && afterRef.current) {
      const after = afterRef.current;
      afterRef.current = null;
      after();
    }
  }, [refreshing]);

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      afterRef.current = after ?? null;
      startRefresh(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return { busy: busy || refreshing, error, setError, run };
}

// ─── Preferencias de vista (se recuerdan en este dispositivo) ────────────────

const choiceListeners = new Set<() => void>();

function subscribeChoice(onChange: () => void) {
  choiceListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    choiceListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Una elección entre opciones fijas que se recuerda en el dispositivo (localStorage).
 * En el servidor y hasta hidratar vale `fallback`; si el almacenamiento falla, dura lo que la pantalla.
 */
export function useStoredChoice<T extends string>(key: string, options: readonly T[], fallback: T): [T, (value: T) => void] {
  const read = (): T => {
    try {
      const stored = localStorage.getItem(key);
      if (stored && (options as readonly string[]).includes(stored)) return stored as T;
    } catch {
      /* sin almacenamiento disponible */
    }
    return memoryChoices.get(key) as T | undefined ?? fallback;
  };
  const value = useSyncExternalStore(subscribeChoice, read, () => fallback);

  function set(next: T) {
    memoryChoices.set(key, next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* se mantiene solo en memoria */
    }
    choiceListeners.forEach((notify) => notify());
  }

  return [value, set];
}

const memoryChoices = new Map<string, string>();

// ─── Encabezado de página con selector de mes ─────────────────────────────────

export function PlanHeader({ title, period, backHref }: {
  title: string;
  period?: string;
  backHref?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 min-h-9">
      <div className="flex items-center gap-2 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Volver"
            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
          >
            <ChevronLeft size={16} />
          </Link>
        )}
        <h1 className="text-lg font-bold truncate" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
      </div>
      {period && <PeriodNav period={period} />}
    </div>
  );
}

export function PeriodNav({ period }: { period: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isCurrent = period === currentPeriod();

  const go = (p: string) =>
    router.push(p === currentPeriod() ? pathname : `${pathname}?period=${p}`);

  const btn = "w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0";
  const btnStyle = { backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" };

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button type="button" className={btn} style={btnStyle} aria-label="Mes anterior" onClick={() => go(addMonths(period, -1))}>
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        onClick={() => !isCurrent && go(currentPeriod())}
        title={isCurrent ? undefined : "Volver al mes actual"}
        className="text-sm font-semibold capitalize text-center px-1 min-w-[104px]"
        style={{ color: isCurrent ? "var(--text-primary)" : "var(--accent)" }}
      >
        {periodLabel(period)}
      </button>
      <button type="button" className={btn} style={btnStyle} aria-label="Mes siguiente" onClick={() => go(addMonths(period, 1))}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/** Agrega `?period=` a un link interno cuando no se está viendo el mes actual. */
export function withPeriod(href: string, period: string): string {
  return period === currentPeriod() ? href : `${href}?period=${period}`;
}

// ─── Contenedores ─────────────────────────────────────────────────────────────

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 min-h-6">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
        {children}
      </p>
      {right}
    </div>
  );
}

export function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border divide-y divide-[var(--border)] overflow-hidden"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      {children}
    </div>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl px-4 py-5 text-sm text-center"
      style={{ border: "1px dashed var(--border-strong)", color: "var(--text-secondary)" }}
    >
      {children}
    </div>
  );
}

export function SmallAction({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
    >
      {children}
    </button>
  );
}

export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed right-5 w-14 h-14 rounded-full flex items-center justify-center z-40"
      style={{
        bottom: "max(7rem, calc(6rem + env(safe-area-inset-bottom)))",
        backgroundColor: "var(--accent)",
        color: "var(--accent-foreground)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <Plus size={24} />
    </button>
  );
}

export function ProgressBar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) : value > 0 ? 1 : 0;
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-elevated)" }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, backgroundColor: tone }} />
    </div>
  );
}

export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" | "ok" | "near" | "over" }) {
  const styles: Record<string, React.CSSProperties> = {
    muted: { backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" },
    accent: { backgroundColor: "var(--accent-subtle)", color: "var(--accent)" },
    ok: { backgroundColor: "var(--accent-green-subtle)", color: "var(--accent-green)" },
    near: { backgroundColor: "var(--accent-amber-subtle)", color: "var(--accent-amber)" },
    over: { backgroundColor: "var(--accent-red-subtle)", color: "var(--accent-red)" },
  };
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={styles[tone]}>
      {children}
    </span>
  );
}

/** Círculo tildable: cobrado / pagado. */
export function DoneToggle({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
      style={{
        backgroundColor: done ? "var(--accent-green)" : "transparent",
        border: done ? "1px solid var(--accent-green)" : "1.5px solid var(--border-strong)",
        color: "var(--bg-primary)",
      }}
    >
      {done && <Check size={14} strokeWidth={3} />}
    </button>
  );
}

// ─── Hoja modal ───────────────────────────────────────────────────────────────

export function Sheet({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-t-3xl sm:rounded-2xl px-5 pt-5 space-y-4 overflow-y-auto"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          maxHeight: "92svh",
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Campos ───────────────────────────────────────────────────────────────────

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
      {children}
      {hint && <p className="text-[11px] mt-1.5" style={{ color: "var(--text-secondary)" }}>{hint}</p>}
    </div>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  // En iOS los campos de fecha ignoran el ancho y centran el texto si conservan su apariencia nativa.
  const dateFix = props.type === "date" ? "appearance-none block text-left [&::-webkit-date-and-time-value]:text-left" : "";
  return (
    <Input
      {...props}
      className={`h-11 rounded-xl ${dateFix} ${props.className ?? ""}`}
      style={{ ...fieldStyle, ...props.style }}
    />
  );
}

/** Monto con separador de miles mientras se escribe. El valor es el texto formateado. */
export function MoneyInput({ value, onChange, currency = "ARS", large, autoFocus, placeholder = "0", ariaLabel }: {
  value: string;
  onChange: (text: string) => void;
  currency?: Currency;
  large?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      <span
        className={`absolute left-3 top-1/2 -translate-y-1/2 font-semibold pointer-events-none ${large ? "text-lg" : "text-sm"}`}
        style={{ color: "var(--text-secondary)" }}
      >
        {currency === "USD" ? "US$" : "$"}
      </span>
      <Input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(formatMoneyInput(e.target.value))}
        className={`rounded-xl tabular-nums font-semibold ${large ? "h-14 text-2xl" : "h-11 text-base"} ${currency === "USD" ? "pl-12" : "pl-8"}`}
        style={fieldStyle}
      />
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className="flex-1 py-2 px-1 text-xs font-semibold transition-colors"
          style={{
            backgroundColor: value === o.value ? "var(--accent)" : "var(--bg-elevated)",
            color: value === o.value ? "var(--accent-foreground)" : "var(--text-secondary)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips({ options, value, onChange }: {
  options: { id: string; label: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : o.id)}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: active ? "var(--accent-subtle)" : "var(--bg-elevated)",
              color: active ? "var(--accent)" : "var(--text-secondary)",
              border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function NativeSelect({ value, onChange, children, ariaLabel }: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 rounded-xl px-3 text-base md:text-sm border outline-none"
      style={fieldStyle}
    >
      {children}
    </select>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left w-full"
    >
      <span
        className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
        style={{ backgroundColor: checked ? "var(--accent)" : "var(--border-strong)" }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
          style={{ backgroundColor: "#fff", transform: checked ? "translateX(18px)" : "translateX(2px)" }}
        />
      </span>
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
    </button>
  );
}

// ─── Botones ──────────────────────────────────────────────────────────────────

export function PrimaryButton({ children, onClick, busy, disabled }: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {busy ? "Guardando…" : children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, tone = "default", disabled }: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 h-10 rounded-xl text-xs font-semibold px-3 disabled:opacity-50"
      style={{
        backgroundColor: "var(--bg-elevated)",
        color: tone === "danger" ? "var(--accent-red)" : "var(--text-primary)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </button>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p role="alert" className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>;
}

/** Aviso cuando el mes que se está viendo todavía no fue iniciado. */
export function NotStartedNotice({ period }: { period: string }) {
  return (
    <div className="rounded-2xl p-5 space-y-3 text-center" style={cardStyle}>
      <p className="text-sm font-semibold first-letter:uppercase" style={{ color: "var(--text-primary)" }}>
        {periodLabel(period)} todavía no está iniciado
      </p>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Inicialo desde el resumen del mes: trae tus fijos y el presupuesto anterior en un paso.
      </p>
      <Link
        href={withPeriod("/plan", period)}
        className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
      >
        Ir a iniciar el mes
      </Link>
    </div>
  );
}
