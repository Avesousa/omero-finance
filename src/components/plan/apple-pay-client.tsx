"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import {
  EmptyHint, ErrorText, ListCard, PlanHeader, PrimaryButton, SecondaryButton, SectionTitle, TextInput,
  api, cardStyle, useAction,
} from "./plan-ui";

export interface TokenRow {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

const mono: React.CSSProperties = {
  backgroundColor: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      /* sin portapapeles: se puede seleccionar a mano */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold flex-shrink-0"
      style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
    >
      <Copy size={13} />
      {done ? "Copiado" : label}
    </button>
  );
}

export function ApplePayClient({ tokens }: { tokens: TokenRow[] }) {
  const action = useAction();
  const [name, setName] = useState("iPhone");
  const [asking, setAsking] = useState(false);
  const [fresh, setFresh] = useState<{ id: string; token: string } | null>(null);
  const [test, setTest] = useState<"idle" | "busy" | "ok" | string>("idle");

  const url = typeof window === "undefined" ? "" : `${window.location.origin}/api/plan/inbox/apple-pay`;

  function create() {
    return action.run(async () => {
      const res = (await api("POST", "/api/plan/tokens", { name: name.trim() || "iPhone" })) as { id: string; token: string };
      setFresh(res);
      setAsking(false);
      setTest("idle");
    });
  }

  async function probe() {
    if (!fresh) return;
    setTest("busy");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${fresh.token}` },
        body: JSON.stringify({ amount: "$ 1.234,56", merchant: "Prueba Omero", card: "Prueba" }),
      });
      const json = await res.json().catch(() => ({}));
      setTest(res.ok ? "ok" : (json as { error?: string }).error ?? "No funcionó");
    } catch {
      setTest("No se pudo conectar");
    }
  }

  function revoke(t: TokenRow) {
    return action.run(() => api("DELETE", `/api/plan/tokens/${t.id}`), () => {
      if (fresh?.id === t.id) setFresh(null);
    });
  }

  const steps: React.ReactNode[] = [
    <>Abrí <strong>Atajos</strong> en el iPhone y andá a <strong>Automatización</strong>.</>,
    <>Tocá <strong>+</strong> y elegí <strong>Transacción</strong>.</>,
    <>Elegí las tarjetas de Wallet que querés que cuenten y marcá <strong>Ejecutar inmediatamente</strong>. Tocá <strong>Siguiente</strong>.</>,
    <>Elegí <strong>Nuevo atajo en blanco</strong> y agregá la acción <strong>Obtener contenido de URL</strong>.</>,
    <>En <strong>URL</strong> pegá la dirección de abajo. Método: <strong>POST</strong>.</>,
    <>En <strong>Encabezados</strong> agregá <code>Authorization</code> con el valor <code>Bearer </code> seguido de tu clave.</>,
    <>En <strong>Cuerpo de la solicitud</strong> elegí <strong>JSON</strong> y agregá estos campos de texto, tocando cada valor para elegir la variable: <code>amount</code> = <em>Importe</em>, <code>merchant</code> = <em>Comercio</em>, <code>card</code> = <em>Tarjeta o pase</em>, <code>name</code> = <em>Nombre</em>.</>,
    <>Listo. Cada pago va a aparecer en <Link href="/plan/por-confirmar" className="underline" style={{ color: "var(--accent)" }}>Por confirmar</Link>.</>,
  ];

  return (
    <>
      <PlanHeader title="Apple Pay automático" backHref="/plan/mas" />
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Cada vez que pagás con Apple Pay, tu iPhone avisa a Omero y el pago queda en Por confirmar.
        Vos solo elegís la categoría y cómo pagaste, con un toque.
      </p>

      <SectionTitle>Tus claves</SectionTitle>
      {fresh && (
        <div className="rounded-2xl p-4 space-y-3" style={cardStyle}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Tu clave nueva</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-xs break-all select-all" style={mono}>{fresh.token}</div>
            <CopyButton value={fresh.token} />
          </div>
          <p className="text-xs" style={{ color: "var(--accent-amber)" }}>
            Guardala ahora: no la vamos a mostrar de nuevo. Si la perdés, creá otra y revocá esta.
          </p>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={probe} disabled={test === "busy"}>
              {test === "busy" ? "Probando…" : "Probar"}
            </SecondaryButton>
            {test === "ok" && (
              <p className="text-xs" style={{ color: "var(--accent-green)" }}>
                Llegó bien. <Link href="/plan/por-confirmar" className="underline font-semibold">Ver en Por confirmar</Link>
              </p>
            )}
            {test !== "idle" && test !== "busy" && test !== "ok" && (
              <p className="text-xs" style={{ color: "var(--accent-red)" }}>{test}</p>
            )}
          </div>
        </div>
      )}

      {tokens.length === 0 && !fresh ? (
        <EmptyHint>Todavía no creaste ninguna clave.</EmptyHint>
      ) : (
        tokens.length > 0 && (
          <ListCard>
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3" style={{ backgroundColor: "var(--bg-card)" }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {t.lastUsedAt ? `Último pago recibido: ${whenLabel(t.lastUsedAt)}` : "Todavía no se usó"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(t)}
                  disabled={action.busy}
                  className="text-xs font-semibold disabled:opacity-50"
                  style={{ color: "var(--accent-red)" }}
                >
                  Revocar
                </button>
              </div>
            ))}
          </ListCard>
        )
      )}

      {asking ? (
        <div className="rounded-2xl p-4 space-y-3" style={cardStyle}>
          <TextInput aria-label="Nombre de la clave" placeholder="iPhone" value={name} onChange={(e) => setName(e.target.value)} />
          <PrimaryButton onClick={create} busy={action.busy}>Crear clave</PrimaryButton>
        </div>
      ) : (
        <PrimaryButton onClick={() => setAsking(true)}>Crear clave para el atajo</PrimaryButton>
      )}
      <ErrorText error={action.error} />

      <SectionTitle>Cómo armar el atajo</SectionTitle>
      <div className="rounded-2xl p-4 space-y-3" style={cardStyle}>
        <ol className="space-y-2.5 text-sm list-decimal pl-5" style={{ color: "var(--text-primary)" }}>
          {steps.map((s, i) => <li key={i} className="pl-1">{s}</li>)}
        </ol>
        <div>
          <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>Dirección (URL)</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-xs break-all select-all" style={mono}>{url}</div>
            <CopyButton value={url} />
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Solo funciona con pagos con el iPhone o el reloj (Apple Pay). Si un pago no trae monto, queda para completar.
        </p>
      </div>
    </>
  );
}
