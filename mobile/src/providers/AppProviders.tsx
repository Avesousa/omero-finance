import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import "../i18n";
import { SessionProvider } from "../../lib/session";
import { queryClient } from "../data";
import { ThemeProvider } from "../design-system";
import { MascotProvider } from "../mascots";

/** Todos los providers de la app: i18n (efecto de import), React Query, sesión, tema y mascota. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider>
          <MascotProvider>{children}</MascotProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
