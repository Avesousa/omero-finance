-- AlterTable
ALTER TABLE "PlanLoan" ADD COLUMN     "interestAnnual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "interestTaxPct" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "PlanLoanBalance" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanLoanBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanLoanBalance_loanId_period_key" ON "PlanLoanBalance"("loanId", "period");

-- AddForeignKey
ALTER TABLE "PlanLoanBalance" ADD CONSTRAINT "PlanLoanBalance_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "PlanLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
