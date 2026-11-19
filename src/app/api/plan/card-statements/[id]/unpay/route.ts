import { NextRequest, NextResponse } from "next/server";
import { payStatement } from "@/lib/plan/statement-payments";
import { readBody, withSession } from "@/lib/plan/server";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 return withSession(req, "update", async (ctx) => NextResponse.json(await payStatement(ctx, (await params).id, await readBody(req), true)));
}
