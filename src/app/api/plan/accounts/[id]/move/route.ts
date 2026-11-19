import { NextRequest, NextResponse } from "next/server";
import { moveResource } from "@/lib/plan/resource-moves";
import { readBody, withSession } from "@/lib/plan/server";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 return withSession(req, "update", async (ctx) => { const { id } = await params; const b = await readBody(req); return NextResponse.json(await moveResource(ctx, "account", id, b.toFinanceId)); });
}
