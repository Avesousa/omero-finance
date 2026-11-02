-- CreateEnum
CREATE TYPE "FinanceKind" AS ENUM ('PERSONAL', 'SHARED');

-- CreateEnum
CREATE TYPE "FinanceRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "color" TEXT,
ADD COLUMN     "kind" "FinanceKind" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN     "ownerUserId" TEXT;

-- CreateTable
CREATE TABLE "FinanceMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "role" "FinanceRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceMember_householdId_idx" ON "FinanceMember"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceMember_userId_householdId_key" ON "FinanceMember"("userId", "householdId");

-- CreateIndex
CREATE INDEX "Household_ownerUserId_idx" ON "Household"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceMember" ADD CONSTRAINT "FinanceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceMember" ADD CONSTRAINT "FinanceMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
