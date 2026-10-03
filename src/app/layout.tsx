import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { appleStartupImages } from "@/lib/apple-startup";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Omero Finance",
  description: "Presupuesto del hogar",
  // El manifest se genera en app/manifest.ts y Next agrega el <link> solo.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Omero",
    startupImage: appleStartupImages,
  },
  // Next ya emite "mobile-web-app-capable"; iOS usa el nombre con prefijo para pantalla completa y arranque.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0F" },
    { media: "(prefers-color-scheme: light)", color: "#F8F9FF" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={geistSans.variable}
      suppressHydrationWarning
    >
      <body className="min-h-svh flex flex-col">
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <ThemeProvider>
          {/* Header */}
          <header
            className="glass sticky top-0 z-40 flex items-center justify-between px-5"
            style={{
              // Instalada en el iPhone el contenido llega hasta arriba: dejamos libre la barra de estado.
              paddingTop: "env(safe-area-inset-top)",
              height: "calc(3.5rem + env(safe-area-inset-top))",
              backgroundColor: "rgba(9,9,11,0.75)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-lg gradient-strip"
                style={{ flexShrink: 0 }}
              />
              <span
                className="text-base font-bold tracking-tight"
                style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
              >
                omero
              </span>
            </div>
            <ThemeToggle />
          </header>

          {/* Main content — padded for bottom nav */}
          <main className="flex-1 mb-nav">{children}</main>

          {/* Bottom nav */}
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
