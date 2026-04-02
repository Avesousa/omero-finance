import { NextRequest, NextResponse } from "next/server";

// TODO: replace stub with real Prisma + auth once wired
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Basic validation
    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    // Stub response — will be replaced with DB insert
    return NextResponse.json({ ok: true, id: crypto.randomUUID() }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
