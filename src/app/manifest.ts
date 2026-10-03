import type { MetadataRoute } from "next";

/**
 * Manifest de la app instalable (se sirve en /manifest.webmanifest).
 * Al abrirla desde el ícono arranca en Plan simple.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Omero Finance",
    short_name: "Omero",
    description: "Tu mes, tus gastos y tu presupuesto en un solo lugar",
    lang: "es-AR",
    start_url: "/plan",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090B",
    theme_color: "#09090B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
