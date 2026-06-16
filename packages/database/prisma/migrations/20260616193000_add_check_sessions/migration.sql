CREATE TYPE "CheckSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "CheckSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "categoryId" TEXT,
  "groupId" TEXT,
  "status" "CheckSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CheckSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheckSessionItem" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "selectedStatus" "ItemStatus",
  "checkedAt" TIMESTAMP(3),
  CONSTRAINT "CheckSessionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CheckSession_userId_status_startedAt_idx" ON "CheckSession"("userId", "status", "startedAt");
CREATE INDEX "CheckSession_categoryId_status_idx" ON "CheckSession"("categoryId", "status");
CREATE INDEX "CheckSession_groupId_status_idx" ON "CheckSession"("groupId", "status");
CREATE UNIQUE INDEX "CheckSessionItem_sessionId_itemId_key" ON "CheckSessionItem"("sessionId", "itemId");
CREATE INDEX "CheckSessionItem_sessionId_sortOrder_idx" ON "CheckSessionItem"("sessionId", "sortOrder");

ALTER TABLE "CheckSession" ADD CONSTRAINT "CheckSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckSession" ADD CONSTRAINT "CheckSession_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckSessionItem" ADD CONSTRAINT "CheckSessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CheckSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckSessionItem" ADD CONSTRAINT "CheckSessionItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
