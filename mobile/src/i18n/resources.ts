import esCommon from "./locales/es/common.json";
import esHome from "./locales/es/home.json";
import esMascots from "./locales/es/mascots.json";
import esMore from "./locales/es/more.json";
import esNotifications from "./locales/es/notifications.json";
import esTabs from "./locales/es/tabs.json";
import esCards from "./locales/es/cards.json";
import esWealth from "./locales/es/wealth.json";
import ptCommon from "./locales/pt-BR/common.json";
import ptHome from "./locales/pt-BR/home.json";
import ptMascots from "./locales/pt-BR/mascots.json";
import ptMore from "./locales/pt-BR/more.json";
import ptNotifications from "./locales/pt-BR/notifications.json";
import ptTabs from "./locales/pt-BR/tabs.json";
import ptCards from "./locales/pt-BR/cards.json";
import ptWealth from "./locales/pt-BR/wealth.json";
import enCommon from "./locales/en/common.json";
import enHome from "./locales/en/home.json";
import enMascots from "./locales/en/mascots.json";
import enMore from "./locales/en/more.json";
import enNotifications from "./locales/en/notifications.json";
import enTabs from "./locales/en/tabs.json";
import enCards from "./locales/en/cards.json";
import enWealth from "./locales/en/wealth.json";

/** Recursos de es (fuente de verdad de las claves). pt-BR y en tienen las mismas claves, vacías. */
export const esResources = {
  common: esCommon,
  tabs: esTabs,
  home: esHome,
  notifications: esNotifications,
  more: esMore,
  mascots: esMascots,
  cards: esCards,
  wealth: esWealth,
};

export const resources = {
  es: esResources,
  "pt-BR": { common: ptCommon, tabs: ptTabs, home: ptHome, notifications: ptNotifications, more: ptMore, mascots: ptMascots, cards: ptCards, wealth: ptWealth },
  en: { common: enCommon, tabs: enTabs, home: enHome, notifications: enNotifications, more: enMore, mascots: enMascots, cards: enCards, wealth: enWealth },
};

export const NAMESPACES = ["common", "tabs", "home", "notifications", "more", "mascots", "cards", "wealth"] as const;
export type Namespace = (typeof NAMESPACES)[number];
