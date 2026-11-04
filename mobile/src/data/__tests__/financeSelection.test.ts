import test from "node:test";
import assert from "node:assert/strict";
import { isCurrentFinanceRequest, selectableFinanceId } from "../../../lib/finance-selection.ts";

test("hogar previo al backfill: recuperarse de un 403 no vuelve a enviar el id rechazado", () => {
  let activeId: string | null = "legacy";
  const requests = [activeId, activeId, activeId];
  let recoveries = 0;
  for (const requestedId of requests) {
    if (isCurrentFinanceRequest(requestedId, activeId)) {
      recoveries++;
      activeId = selectableFinanceId({ activeId: "legacy", finances: [] });
    }
  }
  assert.equal(recoveries, 1);
  assert.equal(activeId, null);
  // Recargar la lista conserva el acceso sin header: no se reinicia el ciclo.
  assert.equal(selectableFinanceId({ activeId: "legacy", finances: [] }), null);
});

test("tras el backfill, la finanza activa con membresía se selecciona normalmente", () => {
  assert.equal(selectableFinanceId({ activeId: "personal", finances: [{ id: "personal" }, { id: "hogar" }] }), "personal");
  assert.equal(selectableFinanceId({ activeId: "hogar", finances: [{ id: "personal" }, { id: "hogar" }] }), "hogar");
});

test("un 403 tardío no cambia la nueva selección y un pedido sin header no inicia recuperación", () => {
  assert.equal(isCurrentFinanceRequest("anterior", "actual"), false);
  assert.equal(isCurrentFinanceRequest("anterior", null), false);
  assert.equal(isCurrentFinanceRequest(null, null), false);
  assert.equal(isCurrentFinanceRequest("actual", "actual"), true);
});
