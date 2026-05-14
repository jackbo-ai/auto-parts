-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- Seed brands from existing free-text Part.brand values
INSERT INTO "Brand" ("id", "name")
SELECT lower(hex(randomblob(16))), TRIM("brand")
FROM "Part"
WHERE "brand" IS NOT NULL AND TRIM("brand") <> ''
GROUP BY TRIM("brand");

-- RedefineTables: Part.brand (TEXT) -> Part.brandId (FK Brand)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Part" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brandId" TEXT,
    "categoryId" TEXT,
    "supplierId" TEXT,
    "vatRate" REAL NOT NULL DEFAULT 0.2,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "reorderThreshold" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Part_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Part_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Part_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Part" ("active", "brandId", "categoryId", "createdAt", "description", "id", "location", "name", "reference", "reorderThreshold", "stockQty", "supplierId", "updatedAt", "vatRate")
SELECT "active", (SELECT "id" FROM "Brand" WHERE "Brand"."name" = TRIM("Part"."brand")), "categoryId", "createdAt", "description", "id", "location", "name", "reference", "reorderThreshold", "stockQty", "supplierId", "updatedAt", "vatRate" FROM "Part";
DROP TABLE "Part";
ALTER TABLE "new_Part" RENAME TO "Part";
CREATE UNIQUE INDEX "Part_reference_key" ON "Part"("reference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
