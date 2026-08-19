-- DropIndex
DROP INDEX "customers_email_phone_key";

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");
