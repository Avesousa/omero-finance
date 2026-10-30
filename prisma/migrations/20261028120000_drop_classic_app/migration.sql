-- Borra la app clásica: sus tablas y sus tipos. No toca Plan simple, usuarios, hogares ni tarjetas.
-- Decisión: no se exportan los datos viejos. Esto no se puede deshacer.

-- DropTable (las que dependen de otras primero; CASCADE quita sus claves foráneas)
DROP TABLE IF EXISTS "AccountTransfer" CASCADE;
DROP TABLE IF EXISTS "LoanInstallment" CASCADE;
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "Loan" CASCADE;
DROP TABLE IF EXISTS "Debt" CASCADE;
DROP TABLE IF EXISTS "Saving" CASCADE;
DROP TABLE IF EXISTS "RentPayment" CASCADE;
DROP TABLE IF EXISTS "PersonalExpense" CASCADE;
DROP TABLE IF EXISTS "HouseholdExpense" CASCADE;
DROP TABLE IF EXISTS "GroceryExpense" CASCADE;
DROP TABLE IF EXISTS "FixedExpense" CASCADE;
DROP TABLE IF EXISTS "FixedExpenseTemplate" CASCADE;
DROP TABLE IF EXISTS "CreditCardStatement" CASCADE;
DROP TABLE IF EXISTS "Income" CASCADE;
DROP TABLE IF EXISTS "MercadoPagoMovement" CASCADE;
DROP TABLE IF EXISTS "BudgetConfig" CASCADE;
DROP TABLE IF EXISTS "ExchangeRate" CASCADE;

-- DropEnum
DROP TYPE IF EXISTS "IncomeType";
DROP TYPE IF EXISTS "ExpenseType";
DROP TYPE IF EXISTS "RentType";
DROP TYPE IF EXISTS "SavingType";
DROP TYPE IF EXISTS "LoanDirection";
DROP TYPE IF EXISTS "InstallmentUnit";
DROP TYPE IF EXISTS "DebtStatus";
DROP TYPE IF EXISTS "MPMovementStatus";
DROP TYPE IF EXISTS "BudgetCategory";
DROP TYPE IF EXISTS "RateSource";
DROP TYPE IF EXISTS "AccountType";
