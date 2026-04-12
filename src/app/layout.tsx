import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Omero Finance",
  description: "Presupuesto del hogar",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Omero",
  },
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
            className="glass sticky top-0 z-40 flex items-center justify-between px-5 h-14"
            style={{
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
