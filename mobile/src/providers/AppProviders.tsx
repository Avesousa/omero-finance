import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import "../i18n";
import { SessionProvider } from "../../lib/session";
import { queryClient } from "../data";
import { ThemeProvider } from "../design-system";
import { MascotProvider } from "../mascots";
import { PrivacyProvider } from "./PrivacyProvider";

/** Todos los providers de la app: i18n (efecto de import), React Query, sesión, tema, mascota y privacidad (ojito). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider>
          <MascotProvider>
            <PrivacyProvider>{children}</PrivacyProvider>
          </MascotProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
