-- CreateEnum
CREATE TYPE "PlanKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "PlanFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PlanPayMode" AS ENUM ('TOTAL', 'MINIMUM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PlanBalanceType" AS ENUM ('ASSET', 'DEBT');

-- CreateTable
CREATE TABLE "PlanMonth" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "usdRate" DECIMAL(10,4) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCategory" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "kind" "PlanKind" NOT NULL,
    "name" TEXT NOT NULL,
    "systemKey" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanRecurring" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "kind" "PlanKind" NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "targetCategoryId" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(14,2) NOT NULL,
    "frequency" "PlanFrequency" NOT NULL DEFAULT 'MONTHLY',
    "weekday" INTEGER,
    "dueDay" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanRecurring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEntry" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "kind" "PlanKind" NOT NULL,
    "recurringId" TEXT,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "targetCategoryId" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanBudget" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PlanBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCardPurchase" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(14,2) NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "firstPeriod" TEXT NOT NULL,
    "purchaseDate" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanCardPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCardStatement" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "dueDate" DATE,
    "totalArs" DECIMAL(14,2) NOT NULL,
    "minimumArs" DECIMAL(14,2),
    "usdAmount" DECIMAL(14,2),
    "payMode" "PlanPayMode" NOT NULL DEFAULT 'TOTAL',
    "customAmount" DECIMAL(14,2),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanCardStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanBalanceItem" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "type" "PlanBalanceType" NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanBalanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanBalanceValue" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PlanBalanceValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanMonth_householdId_period_key" ON "PlanMonth"("householdId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCategory_householdId_kind_name_key" ON "PlanCategory"("householdId", "kind", "name");

-- CreateIndex
CREATE INDEX "PlanRecurring_householdId_kind_idx" ON "PlanRecurring"("householdId", "kind");

-- CreateIndex
CREATE INDEX "PlanEntry_householdId_period_idx" ON "PlanEntry"("householdId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntry_recurringId_period_key" ON "PlanEntry"("recurringId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PlanBudget_householdId_period_categoryId_key" ON "PlanBudget"("householdId", "period", "categoryId");

-- CreateIndex
CREATE INDEX "PlanCardPurchase_householdId_cardId_idx" ON "PlanCardPurchase"("householdId", "cardId");

-- CreateIndex
CREATE INDEX "PlanCardStatement_householdId_period_idx" ON "PlanCardStatement"("householdId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCardStatement_cardId_period_key" ON "PlanCardStatement"("cardId", "period");

-- CreateIndex
CREATE INDEX "PlanBalanceItem_householdId_idx" ON "PlanBalanceItem"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanBalanceValue_itemId_period_key" ON "PlanBalanceValue"("itemId", "period");

-- AddForeignKey
ALTER TABLE "PlanMonth" ADD CONSTRAINT "PlanMonth_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCategory" ADD CONSTRAINT "PlanCategory_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRecurring" ADD CONSTRAINT "PlanRecurring_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRecurring" ADD CONSTRAINT "PlanRecurring_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PlanCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRecurring" ADD CONSTRAINT "PlanRecurring_targetCategoryId_fkey" FOREIGN KEY ("targetCategoryId") REFERENCES "PlanCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "PlanRecurring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PlanCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_targetCategoryId_fkey" FOREIGN KEY ("targetCategoryId") REFERENCES "PlanCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanBudget" ADD CONSTRAINT "PlanBudget_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanBudget" ADD CONSTRAINT "PlanBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PlanCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCardPurchase" ADD CONSTRAINT "PlanCardPurchase_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCardPurchase" ADD CONSTRAINT "PlanCardPurchase_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCardPurchase" ADD CONSTRAINT "PlanCardPurchase_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PlanCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCardStatement" ADD CONSTRAINT "PlanCardStatement_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCardStatement" ADD CONSTRAINT "PlanCardStatement_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanBalanceItem" ADD CONSTRAINT "PlanBalanceItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanBalanceValue" ADD CONSTRAINT "PlanBalanceValue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlanBalanceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
