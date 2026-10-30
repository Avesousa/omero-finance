import type { Insets } from "react-native";
import { sizes } from "../../design-system";

/** Insets para que un control de `width` x `height` alcance el objetivo táctil mínimo (44px). */
export function hitSlopFor(width: number, height: number = width): Insets {
  const h = Math.max(0, Math.ceil((sizes.touch - width) / 2));
  const v = Math.max(0, Math.ceil((sizes.touch - height) / 2));
  return { top: v, bottom: v, left: h, right: h };
}
