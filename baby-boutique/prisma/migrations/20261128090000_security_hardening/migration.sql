-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "mfaVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecret" TEXT;

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");


-- Database-level guards: even a bug or a hand-edited row cannot create negative stock,
-- zero/negative quantities or negative money amounts.
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_nonnegative" CHECK ("stock" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_price_positive" CHECK ("price" IS NULL OR "price" > 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_basePrice_nonnegative" CHECK ("basePrice" >= 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_range" CHECK ("quantity" BETWEEN 1 AND 100);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_unitPrice_nonnegative" CHECK ("unitPrice" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_nonnegative" CHECK ("subtotal" >= 0 AND "shippingFee" >= 0 AND "discount" >= 0 AND "total" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_nonnegative" CHECK ("amount" >= 0);
