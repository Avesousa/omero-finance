-- CreateEnum
CREATE TYPE "PlanLoanDirection" AS ENUM ('OWE', 'OWED');

-- CreateEnum
CREATE TYPE "PlanLoanMode" AS ENUM ('FIXED', 'SCHEDULE', 'OPEN');

-- AlterTable
ALTER TABLE "PlanEntry" ADD COLUMN     "interestAmount" DECIMAL(14,2),
ADD COLUMN     "loanId" TEXT;

-- CreateTable
CREATE TABLE "PlanLoan" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "direction" "PlanLoanDirection" NOT NULL,
    "mode" "PlanLoanMode" NOT NULL,
    "name" TEXT NOT NULL,
    "counterpart" TEXT,
    "categoryId" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "principal" DECIMAL(14,2) NOT NULL,
    "installments" INTEGER,
    "installmentAmount" DECIMAL(14,2),
    "interestRate" DECIMAL(8,4),
    "interestFrequency" "PlanFrequency",
    "startPeriod" TEXT NOT NULL,
    "dueDay" INTEGER,
    "endDate" DATE,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanLoanScheduleItem" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PlanLoanScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanLoan_householdId_idx" ON "PlanLoan"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanLoanScheduleItem_loanId_period_key" ON "PlanLoanScheduleItem"("loanId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntry_loanId_period_key" ON "PlanEntry"("loanId", "period");

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "PlanLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLoan" ADD CONSTRAINT "PlanLoan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLoan" ADD CONSTRAINT "PlanLoan_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PlanCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLoanScheduleItem" ADD CONSTRAINT "PlanLoanScheduleItem_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "PlanLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
