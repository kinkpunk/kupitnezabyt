-- Map existing URGENT item statuses to NEED_BUY before shrinking the enum
UPDATE "Item" SET "status" = 'NEED_BUY' WHERE "status" = 'URGENT';
UPDATE "CheckSessionItem" SET "selectedStatus" = 'NEED_BUY' WHERE "selectedStatus" = 'URGENT';

-- Drop the shopping list priority (the urgent-priority concept is removed)
DROP INDEX "ShoppingListItem_userId_isCompleted_priority_idx";
DROP INDEX "ShoppingListItem_workspaceId_isCompleted_priority_idx";
ALTER TABLE "ShoppingListItem" DROP COLUMN "priority";
DROP TYPE "ShoppingPriority";
CREATE INDEX "ShoppingListItem_userId_isCompleted_idx" ON "ShoppingListItem"("userId", "isCompleted");
CREATE INDEX "ShoppingListItem_workspaceId_isCompleted_idx" ON "ShoppingListItem"("workspaceId", "isCompleted");

-- Recreate ItemStatus without URGENT
CREATE TYPE "ItemStatus_new" AS ENUM ('IN_STOCK', 'LOW', 'NEED_BUY', 'PAUSED');
ALTER TABLE "Item" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Item" ALTER COLUMN "status" TYPE "ItemStatus_new" USING ("status"::text::"ItemStatus_new");
ALTER TABLE "Item" ALTER COLUMN "status" SET DEFAULT 'IN_STOCK';
ALTER TABLE "CheckSessionItem" ALTER COLUMN "selectedStatus" TYPE "ItemStatus_new" USING ("selectedStatus"::text::"ItemStatus_new");
DROP TYPE "ItemStatus";
ALTER TYPE "ItemStatus_new" RENAME TO "ItemStatus";
