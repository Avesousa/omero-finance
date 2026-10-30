import "i18next";
import type { esResources } from "./resources";

// Tipado de claves a partir de los JSON de es: una clave inexistente no compila.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: typeof esResources;
    returnNull: false;
  }
}
