-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Part" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "oemReference" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "categoryId" TEXT,
    "supplierId" TEXT,
    "vatRate" REAL NOT NULL DEFAULT 0.2,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "reorderThreshold" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Part_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Part_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Part" ("active", "brand", "categoryId", "createdAt", "description", "id", "location", "name", "oemReference", "reference", "reorderThreshold", "stockQty", "supplierId", "updatedAt", "vatRate") SELECT "active", "brand", "categoryId", "createdAt", "description", "id", "location", "name", "oemReference", "reference", "reorderThreshold", "stockQty", "supplierId", "updatedAt", "vatRate" FROM "Part";
DROP TABLE "Part";
ALTER TABLE "new_Part" RENAME TO "Part";
CREATE UNIQUE INDEX "Part_reference_key" ON "Part"("reference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
