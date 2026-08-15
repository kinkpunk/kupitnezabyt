-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Item_workspaceId_categoryId_sortOrder_idx" ON "Item"("workspaceId", "categoryId", "sortOrder");
