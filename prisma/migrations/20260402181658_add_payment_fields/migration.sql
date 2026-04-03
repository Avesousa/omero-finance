-- AlterTable
ALTER TABLE "CreditCardStatement" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentSource" TEXT;
