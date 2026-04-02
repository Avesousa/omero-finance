-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('SUELDO', 'FREELANCE', 'AHORROS', 'PAGO_DEUDA', 'REMANENTES', 'PRESTAMO', 'INVERSION');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('NECESSARY', 'UNNECESSARY');

-- CreateEnum
CREATE TYPE "RentType" AS ENUM ('ALQUILER', 'EXPENSAS', 'TRABAJOS');

-- CreateEnum
CREATE TYPE "SavingType" AS ENUM ('AHORRO', 'VIAJE', 'INVERSION');

-- CreateEnum
CREATE TYPE "LoanDirection" AS ENUM ('DADO', 'TOMADO');

-- CreateEnum
CREATE TYPE "InstallmentUnit" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('ACTIVE', 'SETTLED');

-- CreateEnum
CREATE TYPE "MPMovementStatus" AS ENUM ('PENDING', 'CATEGORIZED');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('ALQUILER', 'TDC', 'GASTOS_FIJOS', 'MERCADO', 'GASTOS_LIBRES', 'AHORRO_CASA', 'AHORRO_VACACIONES', 'INVERSION_AHORRO', 'OTROS');

-- CreateEnum
CREATE TYPE "RateSource" AS ENUM ('API', 'MANUAL');

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "avatarColor" TEXT NOT NULL DEFAULT '#6366F1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "IncomeType" NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(14,2) NOT NULL,
    "amountArs" DECIMAL(14,2),
    "dollarRateSnapshot" DECIMAL(10,4),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCardStatement" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "cardName" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "minimumPayment" DECIMAL(14,2),
    "totalAmountArs" DECIMAL(14,2) NOT NULL,
    "usdAmount" DECIMAL(14,2),
    "dollarRateSnapshot" DECIMAL(10,4),
    "customAmount" DECIMAL(14,2),
    "amountToPay" DECIMAL(14,2) NOT NULL,
    "payMinimum" BOOLEAN NOT NULL DEFAULT false,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCardStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedExpense" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "subcategory" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(14,2) NOT NULL,
    "amountArs" DECIMAL(14,2),
    "dollarRateSnapshot" DECIMAL(10,4),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryExpense" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(14,2) NOT NULL,
    "amountArs" DECIMAL(14,2),
    "dollarRateSnapshot" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdExpense" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "expenseType" "ExpenseType" NOT NULL DEFAULT 'UNNECESSARY',
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(14,2) NOT NULL,
    "amountArs" DECIMAL(14,2),
    "dollarRateSnapshot" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalExpense" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "concept" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(14,2) NOT NULL,
    "amountArs" DECIMAL(14,2),
    "dollarRateSnapshot" DECIMAL(10,4),
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentPayment" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "RentType" NOT NULL,
    "apartment" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(14,2) NOT NULL,
    "amountArs" DECIMAL(14,2),
    "dollarRateSnapshot" DECIMAL(10,4),
    "description" TEXT,
    "cbuAlias" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Saving" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "type" "SavingType" NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(14,2) NOT NULL,
    "amountArs" DECIMAL(14,2),
    "dollarRateSnapshot" DECIMAL(10,4),
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Saving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "direction" "LoanDirection" NOT NULL,
    "counterpart" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "principal" DECIMAL(14,2) NOT NULL,
    "principalArs" DECIMAL(14,2),
    "dollarRateSnapshot" DECIMAL(10,4),
    "installments" INTEGER NOT NULL,
    "installmentUnit" "InstallmentUnit" NOT NULL DEFAULT 'MONTHLY',
    "interestRate" DECIMAL(6,4) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanInstallment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidDate" TIMESTAMP(3),

    CONSTRAINT "LoanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "concept" TEXT NOT NULL,
    "debtor" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "totalArs" DECIMAL(14,2),
    "dollarRateSnapshot" DECIMAL(10,4),
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MercadoPagoMovement" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "mpReferenceId" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "transactionType" TEXT NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "partialBalance" DECIMAL(14,2),
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "status" "MPMovementStatus" NOT NULL DEFAULT 'PENDING',
    "category" TEXT,
    "subCategory" TEXT,
    "linkedExpenseId" TEXT,
    "notes" TEXT,
    "categorizedById" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MercadoPagoMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetConfig" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "manualPercentage" DECIMAL(6,4),
    "manualAmount" DECIMAL(14,2),
    "manualCurrency" "Currency" NOT NULL DEFAULT 'ARS',
    "isReserved" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BudgetConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "householdId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "usdArs" DECIMAL(10,4) NOT NULL,
    "source" "RateSource" NOT NULL DEFAULT 'API',

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoMovement_mpReferenceId_key" ON "MercadoPagoMovement"("mpReferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetConfig_householdId_month_year_category_key" ON "BudgetConfig"("householdId", "month", "year", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_date_key" ON "ExchangeRate"("date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardStatement" ADD CONSTRAINT "CreditCardStatement_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardStatement" ADD CONSTRAINT "CreditCardStatement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedExpense" ADD CONSTRAINT "FixedExpense_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedExpense" ADD CONSTRAINT "FixedExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryExpense" ADD CONSTRAINT "GroceryExpense_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryExpense" ADD CONSTRAINT "GroceryExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdExpense" ADD CONSTRAINT "HouseholdExpense_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdExpense" ADD CONSTRAINT "HouseholdExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpense" ADD CONSTRAINT "PersonalExpense_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpense" ADD CONSTRAINT "PersonalExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpense" ADD CONSTRAINT "PersonalExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saving" ADD CONSTRAINT "Saving_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saving" ADD CONSTRAINT "Saving_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MercadoPagoMovement" ADD CONSTRAINT "MercadoPagoMovement_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MercadoPagoMovement" ADD CONSTRAINT "MercadoPagoMovement_categorizedById_fkey" FOREIGN KEY ("categorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetConfig" ADD CONSTRAINT "BudgetConfig_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
