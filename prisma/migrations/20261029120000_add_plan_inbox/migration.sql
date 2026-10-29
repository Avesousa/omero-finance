-- CreateEnum
CREATE TYPE "PlanInboxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');

-- CreateTable
CREATE TABLE "PlanApiToken" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanInboxItem" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "merchant" TEXT,
    "amount" DECIMAL(14,2),
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "rawAmount" TEXT,
    "walletCard" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PlanInboxStatus" NOT NULL DEFAULT 'PENDING',
    "entryId" TEXT,
    "purchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanInboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanInboxRule" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "categoryId" TEXT,
    "cardId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanInboxRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanApiToken_tokenHash_key" ON "PlanApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PlanApiToken_householdId_idx" ON "PlanApiToken"("householdId");

-- CreateIndex
CREATE INDEX "PlanInboxItem_householdId_status_idx" ON "PlanInboxItem"("householdId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanInboxRule_householdId_kind_key_key" ON "PlanInboxRule"("householdId", "kind", "key");

-- AddForeignKey
ALTER TABLE "PlanApiToken" ADD CONSTRAINT "PlanApiToken_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanApiToken" ADD CONSTRAINT "PlanApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanInboxItem" ADD CONSTRAINT "PlanInboxItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanInboxRule" ADD CONSTRAINT "PlanInboxRule_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
