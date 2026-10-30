import { NextRequest, NextResponse } from "next/server";
import { loadInbox } from "@/lib/plan/inbox";
import { withSession } from "@/lib/plan/server";

/** GET /api/plan/inbox — pagos por confirmar, con sus sugerencias de categoría y forma de pago. */
export async function GET(req: NextRequest) {
  return withSession(req, async ({ householdId }) => {
    return NextResponse.json({ items: await loadInbox(householdId) });
  });
}
