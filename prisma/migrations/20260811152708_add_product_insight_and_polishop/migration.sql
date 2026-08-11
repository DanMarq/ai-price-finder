-- CreateEnum
CREATE TYPE "PriceAssessment" AS ENUM ('GOOD_DEAL', 'TYPICAL', 'ABOVE_AVERAGE', 'INSUFFICIENT_DATA');

-- CreateTable
CREATE TABLE "ProductInsight" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "priceAssessment" "PriceAssessment" NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductInsight_productId_key" ON "ProductInsight"("productId");

-- AddForeignKey
ALTER TABLE "ProductInsight" ADD CONSTRAINT "ProductInsight_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
