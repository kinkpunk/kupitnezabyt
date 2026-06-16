CREATE TYPE "ItemStatus" AS ENUM ('IN_STOCK', 'LOW', 'NEED_BUY', 'URGENT', 'PAUSED');
CREATE TYPE "ItemImportance" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "ShoppingPriority" AS ENUM ('NORMAL', 'URGENT');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "telegramUserId" TEXT NOT NULL,
  "telegramUsername" TEXT,
  "firstName" TEXT,
  "language" TEXT NOT NULL DEFAULT 'ru',
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Minsk',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Item" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "brand" TEXT,
  "notes" TEXT,
  "status" "ItemStatus" NOT NULL DEFAULT 'IN_STOCK',
  "importance" "ItemImportance" NOT NULL DEFAULT 'NORMAL',
  "usageCycleDays" INTEGER,
  "lastCheckedAt" TIMESTAMP(3),
  "lastBoughtAt" TIMESTAMP(3),
  "nextCheckAt" TIMESTAMP(3),
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShoppingListItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemId" TEXT,
  "title" TEXT NOT NULL,
  "categoryId" TEXT,
  "priority" "ShoppingPriority" NOT NULL DEFAULT 'NORMAL',
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShoppingListItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_telegramUserId_key" ON "User"("telegramUserId");
CREATE INDEX "Category_userId_archivedAt_idx" ON "Category"("userId", "archivedAt");
CREATE INDEX "Item_userId_categoryId_archivedAt_idx" ON "Item"("userId", "categoryId", "archivedAt");
CREATE INDEX "Item_userId_status_idx" ON "Item"("userId", "status");
CREATE INDEX "ShoppingListItem_userId_isCompleted_priority_idx" ON "ShoppingListItem"("userId", "isCompleted", "priority");
CREATE INDEX "ShoppingListItem_itemId_isCompleted_idx" ON "ShoppingListItem"("itemId", "isCompleted");
CREATE UNIQUE INDEX "ShoppingListItem_one_open_item_idx" ON "ShoppingListItem"("itemId") WHERE "itemId" IS NOT NULL AND "isCompleted" = false;

ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
