-- CreateTable
CREATE TABLE "StockMovementReason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "StockMovementReason_label_key" ON "StockMovementReason"("label");
