import { useCallback, useEffect, useState } from "react";
import { prefGet, prefSet } from "../../../lib/storage";
import type { HeroView } from "../../components/organisms";

export const HERO_VIEW_STORAGE_KEY = "omero_home_hero_view";
const DEFAULT_VIEW: HeroView = "free";

/** Qué monto muestra el héroe (Disponible | Libre), recordado por dispositivo. Default `free`. */
export function useHeroView(): [HeroView, (view: HeroView) => void] {
  const [view, setState] = useState<HeroView>(DEFAULT_VIEW);
  useEffect(() => {
    let alive = true;
    prefGet(HERO_VIEW_STORAGE_KEY).then((saved) => {
      if (alive && (saved === "available" || saved === "free")) setState(saved);
    });
    return () => {
      alive = false;
    };
  }, []);
  const setView = useCallback((next: HeroView) => {
    setState(next);
    prefSet(HERO_VIEW_STORAGE_KEY, next);
  }, []);
  return [view, setView];
}
