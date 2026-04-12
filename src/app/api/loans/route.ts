import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_ID, AVELINO_ID } from "../../../../prisma/constants";

export async function GET() {
  try {
    const loans = await prisma.loan.findMany({
      where: { householdId: HOUSEHOLD_ID },
      include: { installmentRecords: { orderBy: { installmentNumber: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    const serialized = loans.map((loan) => ({
      ...loan,
      principal:          Number(loan.principal),
      principalArs:       loan.principalArs ? Number(loan.principalArs) : null,
      dollarRateSnapshot: loan.dollarRateSnapshot ? Number(loan.dollarRateSnapshot) : null,
      interestRate:       Number(loan.interestRate),
      totalAmount:        Number(loan.totalAmount),
      installmentRecords: loan.installmentRecords.map((inst) => ({
        ...inst,
        amount:  Number(inst.amount),
        dueDate: inst.dueDate.toISOString(),
        paidDate: inst.paidDate ? inst.paidDate.toISOString() : null,
      })),
      createdAt: loan.createdAt.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error("[api/loans GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      direction,
      counterpart,
      paymentMethod,
      currency,
      principal,
      installments,
      installmentUnit,
      interestRate,
      totalAmount,
      notes,
    } = body;

    if (!direction || !counterpart || !principal || !installments || !totalAmount) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const principalNum    = parseFloat(principal);
    const installmentsNum = parseInt(installments, 10);
    const interestRateNum = parseFloat(interestRate ?? "0");
    const totalAmountNum  = parseFloat(totalAmount);

    if (isNaN(principalNum) || isNaN(installmentsNum) || isNaN(totalAmountNum)) {
      return NextResponse.json({ error: "Valores numéricos inválidos" }, { status: 400 });
    }

    const amountPerInstallment = totalAmountNum / installmentsNum;

    // Generate installment records
    const now = new Date();
    const installmentRecordsData = Array.from({ length: installmentsNum }, (_, i) => {
      const dueDate = new Date(now);
      if (installmentUnit === "WEEKLY") {
        dueDate.setDate(dueDate.getDate() + (i + 1) * 7);
      } else {
        // MONTHLY — set to same day next N months
        dueDate.setMonth(dueDate.getMonth() + i + 1);
      }
      return {
        installmentNumber: i + 1,
        dueDate,
        amount:   amountPerInstallment,
        currency: currency ?? "ARS",
        isPaid:   false,
      };
    });

    const loan = await prisma.loan.create({
      data: {
        householdId:    HOUSEHOLD_ID,
        ownerUserId:    AVELINO_ID,
        createdById:    AVELINO_ID,
        direction,
        counterpart:    counterpart.trim(),
        paymentMethod:  paymentMethod?.trim() || undefined,
        currency:       currency ?? "ARS",
        principal:      principalNum,
        installments:   installmentsNum,
        installmentUnit: installmentUnit ?? "MONTHLY",
        interestRate:   interestRateNum,
        totalAmount:    totalAmountNum,
        notes:          notes?.trim() || undefined,
        installmentRecords: { create: installmentRecordsData },
      },
      include: { installmentRecords: { orderBy: { installmentNumber: "asc" } } },
    });

    return NextResponse.json(
      {
        ...loan,
        principal:          Number(loan.principal),
        principalArs:       loan.principalArs ? Number(loan.principalArs) : null,
        dollarRateSnapshot: loan.dollarRateSnapshot ? Number(loan.dollarRateSnapshot) : null,
        interestRate:       Number(loan.interestRate),
        totalAmount:        Number(loan.totalAmount),
        installmentRecords: loan.installmentRecords.map((inst) => ({
          ...inst,
          amount:   Number(inst.amount),
          dueDate:  inst.dueDate.toISOString(),
          paidDate: inst.paidDate ? inst.paidDate.toISOString() : null,
        })),
        createdAt: loan.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/loans POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
