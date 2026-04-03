-- CreateTable
CREATE TABLE "FixedExpenseTemplate" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedExpenseTemplate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FixedExpenseTemplate" ADD CONSTRAINT "FixedExpenseTemplate_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
