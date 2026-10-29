import { useCallback, useEffect, useState } from "react";
import { prefGet, prefSet } from "./storage";

/** Una elección que se recuerda en el dispositivo (qué número ver, detalle abierto…). */
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    let alive = true;
    prefGet(key).then((v) => {
      if (alive && v && (allowed as readonly string[]).includes(v)) setValue(v as T);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback((v: T) => {
    setValue(v);
    prefSet(key, v);
  }, [key]);
  return [value, set] as const;
}
