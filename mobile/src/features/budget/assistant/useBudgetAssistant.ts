import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { assistantTargets, projectedFree, usePlan, useSaveBudget } from "../../../data";
import { assistantReducer, initialAssistant, type AssistantAction, type AssistantInput } from "./reducer";

/**
 * Estado del asistente de presupuesto de un mes (vive mientras la pantalla está abierta).
 * Arranca solo cuando carga el plan, y al confirmar guarda las líneas con `useSaveBudget`.
 */
export function useBudgetAssistant(period?: string) {
  const plan = usePlan(period);
  const save = useSaveBudget();
  const [state, dispatch] = useReducer(assistantReducer, initialAssistant);
  const counter = useRef(0);

  const send = useCallback((input: AssistantInput) => dispatch({ ...input, at: Date.now() } as AssistantAction), []);
  const newId = () => `u${Date.now().toString(36)}-${(counter.current++).toString(36)}`;

  const data = plan.data;
  useEffect(() => {
    if (!data) return;
    const { steps, extras } = assistantTargets(data);
    send({ type: "start", steps, extras });
  }, [data, send]);

  const targetPeriod = data?.period;
  const actions = useMemo(
    () => ({
      choose: (choice: "same" | "change" | "skip") => send({ type: "choose", id: newId(), choice }),
      sendText: (text: string) => send({ type: "text", id: newId(), text }),
      pickExtra: (categoryId: string) => send({ type: "pickExtra", id: newId(), categoryId }),
      noMore: () => send({ type: "noMore", id: newId() }),
      confirm: () => {
        if (!data || !targetPeriod || state.phase !== "summary" || state.lines.length === 0) return;
        const items = state.lines.map((l) => ({ categoryId: l.categoryId, amount: l.amount }));
        const free = projectedFree(data, items);
        send({ type: "confirm", id: newId() });
        save.mutate(
          { period: targetPeriod, items },
          { onSuccess: () => send({ type: "saved", free }), onError: () => send({ type: "saveFailed" }) },
        );
      },
    }),
    // `newId` solo usa un ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [send, data, targetPeriod, state.phase, state.lines, save],
  );

  return { state, plan: data, isPending: plan.isPending, isError: plan.isError, refetch: plan.refetch, ...actions };
}
