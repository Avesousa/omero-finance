"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { periodLabel } from "@/lib/plan/core";
import { PlanHeader, Segmented, cardStyle, withPeriod } from "./plan-ui";

type Format = "md" | "json";

const FORMATS: readonly { value: Format; label: string }[] = [
  { value: "md", label: "Texto (Markdown)" },
  { value: "json", label: "Datos (JSON)" },
];

const MIME: Record<Format, string> = { md: "text/markdown", json: "application/json" };

const noopSubscribe = () => () => {};
/** El menú "Compartir" del sistema existe en el iPhone y en algunos navegadores de escritorio. */
const canShare = () => typeof navigator.share === "function";

export function ExportClient({ period, markdown, json }: { period: string; markdown: string; json: string }) {
  const [format, setFormat] = useState<Format>("md");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const shareAvailable = useSyncExternalStore(noopSubscribe, canShare, () => false);

  const text = format === "md" ? markdown : json;
  const fileName = `omero-${period}.${format}`;
  const title = `Resumen de ${periodLabel(period)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ tone: "ok", text: "Copiado. Ya lo podés pegar donde quieras." });
    } catch {
      setStatus({ tone: "error", text: "No pude copiarlo. Probá con Descargar." });
    }
  }

  async function share() {
    const file = new File([text], fileName, { type: MIME[format] });
    try {
      // Como archivo si el sistema lo permite; si no, como texto.
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title });
      else await navigator.share({ title, text });
      setStatus(null);
    } catch (e) {
      // Cerrar el menú sin elegir nada no es un error.
      if ((e as Error).name !== "AbortError") setStatus({ tone: "error", text: "No pude abrir el menú de compartir. Probá con Copiar." });
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: `${MIME[format]};charset=utf-8` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ tone: "ok", text: `Descargado como ${fileName}.` });
  }

  const actions = [
    { label: "Copiar", icon: Copy, onClick: copy, primary: true },
    ...(shareAvailable ? [{ label: "Compartir", icon: Share2, onClick: share, primary: false }] : []),
    { label: "Descargar", icon: Download, onClick: download, primary: false },
  ];

  return (
    <>
      <PlanHeader title="Exportar" period={period} backHref={withPeriod("/plan/mas", period)} />

      <div className="rounded-2xl p-4 space-y-1" style={cardStyle}>
        <p className="text-sm font-semibold first-letter:uppercase" style={{ color: "var(--text-primary)" }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Todo el mes en un solo texto para pasarle a una AI o a otra persona: disponible, ingresos, gastos,
          tarjetas, presupuesto, préstamos y patrimonio. Incluye tus montos y nombres: compartilo solo con quien quieras.
        </p>
      </div>

      <Segmented options={FORMATS} value={format} onChange={(f) => { setFormat(f); setStatus(null); }} />

      <div className="flex gap-2">
        {actions.map(({ label, icon: Icon, onClick, primary }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={primary
              ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }
              : { backgroundColor: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {status && (
        <p
          role="status"
          className="text-xs flex items-center justify-center gap-1.5"
          style={{ color: status.tone === "ok" ? "var(--accent-green)" : "var(--accent-red)" }}
        >
          {status.tone === "ok" && <Check size={13} />}
          {status.text}
        </p>
      )}

      <pre
        aria-label={`Vista previa de ${fileName}`}
        tabIndex={0}
        className="rounded-2xl p-4 text-[11px] leading-relaxed overflow-auto whitespace-pre-wrap break-words"
        style={{ ...cardStyle, color: "var(--text-secondary)", maxHeight: "55svh", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
      >
        {text}
      </pre>
    </>
  );
}
