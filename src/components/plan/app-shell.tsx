"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Share, X } from "lucide-react";

/**
 * Al volver a la app después de un rato (por ejemplo, tras mirar el homebanking),
 * vuelve a pedir los datos. Instalada en el teléfono no hay "deslizar para actualizar".
 * No pierde lo que se esté escribiendo: solo refresca los datos del servidor.
 */
export function RefreshOnReturn() {
  const router = useRouter();

  useEffect(() => {
    let hiddenAt = 0;
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > 30_000) {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [router]);

  return null;
}

const DISMISS_KEY = "omero_install_hint_dismissed";

/** true solo en Safari de iPhone/iPad cuando la app todavía no está instalada. */
function canSuggestInstall(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  // Otros navegadores de iOS no siempre ofrecen "Agregar a inicio".
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (standalone) return false;
  try {
    return localStorage.getItem(DISMISS_KEY) !== "1";
  } catch {
    return true;
  }
}

const noopSubscribe = () => () => {};

/** Aviso para instalar la app en iPhone (iOS no ofrece un botón de instalación propio). */
export function InstallHint() {
  const eligible = useSyncExternalStore(noopSubscribe, canSuggestInstall, () => false);
  const [dismissed, setDismissed] = useState(false);

  if (!eligible || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sin almacenamiento: se oculta solo en esta visita */
    }
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-start gap-3"
      style={{ backgroundColor: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
    >
      <Share size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Instalá Omero en tu iPhone
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Tocá <strong>Compartir</strong> y después <strong>Agregar a inicio</strong>. Se abre a pantalla completa, como una app.
        </p>
      </div>
      <button type="button" onClick={dismiss} aria-label="Cerrar aviso" style={{ color: "var(--text-secondary)" }}>
        <X size={18} />
      </button>
    </div>
  );
}
