-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "accountNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_accountNumber_key" ON "Customer"("accountNumber");
