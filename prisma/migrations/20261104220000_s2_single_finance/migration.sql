-- CreateEnum
CREATE TYPE "PlanAccountType" AS ENUM ('BANK', 'WALLET', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "PlanTransferKind" AS ENUM ('TRANSFER', 'CASH_WITHDRAWAL', 'BUY_USD');

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "originFinanceName" TEXT,
ADD COLUMN     "ownerUserId" TEXT;

-- AlterTable
ALTER TABLE "PlanEntry" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "originFinanceName" TEXT,
ADD COLUMN     "paidAt" DATE;

-- AlterTable
ALTER TABLE "PlanCardPurchase" ADD COLUMN     "originFinanceName" TEXT;

-- AlterTable
ALTER TABLE "PlanCardStatement" ADD COLUMN     "originFinanceName" TEXT;

-- CreateTable
CREATE TABLE "PlanAccount" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlanAccountType" NOT NULL DEFAULT 'BANK',
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingDate" DATE,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "originFinanceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanAccountTransfer" (
    "originFinanceName" TEXT,
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "kind" "PlanTransferKind" NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amountFrom" DECIMAL(14,2) NOT NULL,
    "amountTo" DECIMAL(14,2) NOT NULL,
    "rate" DECIMAL(14,4),
    "date" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanAccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCardPayment" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidByUserId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originFinanceName" TEXT,

    CONSTRAINT "PlanCardPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanAccount_householdId_currency_isArchived_idx" ON "PlanAccount"("householdId", "currency", "isArchived");

-- CreateIndex
CREATE INDEX "PlanAccount_ownerUserId_idx" ON "PlanAccount"("ownerUserId");

-- CreateIndex
CREATE INDEX "PlanAccountTransfer_fromAccountId_date_idx" ON "PlanAccountTransfer"("fromAccountId", "date");

-- CreateIndex
CREATE INDEX "PlanAccountTransfer_toAccountId_date_idx" ON "PlanAccountTransfer"("toAccountId", "date");

-- CreateIndex
CREATE INDEX "PlanCardPayment_accountId_idx" ON "PlanCardPayment"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCardPayment_statementId_currency_key" ON "PlanCardPayment"("statementId", "currency");

-- CreateIndex
CREATE INDEX "PlanEntry_accountId_isDone_idx" ON "PlanEntry"("accountId", "isDone");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PlanAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAccount" ADD CONSTRAINT "PlanAccount_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAccount" ADD CONSTRAINT "PlanAccount_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAccountTransfer" ADD CONSTRAINT "PlanAccountTransfer_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAccountTransfer" ADD CONSTRAINT "PlanAccountTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "PlanAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAccountTransfer" ADD CONSTRAINT "PlanAccountTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "PlanAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCardPayment" ADD CONSTRAINT "PlanCardPayment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "PlanCardStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCardPayment" ADD CONSTRAINT "PlanCardPayment_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCardPayment" ADD CONSTRAINT "PlanCardPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PlanAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
