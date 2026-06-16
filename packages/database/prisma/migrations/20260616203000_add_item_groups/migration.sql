CREATE TABLE "ItemGroup" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon" TEXT,
  "usageCycleDays" INTEGER,
  "nextCheckAt" TIMESTAMP(3),
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ItemGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItemGroupItem" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemGroupItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItemGroup_userId_archivedAt_idx" ON "ItemGroup"("userId", "archivedAt");
CREATE INDEX "ItemGroup_userId_nextCheckAt_idx" ON "ItemGroup"("userId", "nextCheckAt");
CREATE UNIQUE INDEX "ItemGroupItem_groupId_itemId_key" ON "ItemGroupItem"("groupId", "itemId");
CREATE INDEX "ItemGroupItem_itemId_idx" ON "ItemGroupItem"("itemId");

ALTER TABLE "ItemGroup" ADD CONSTRAINT "ItemGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemGroupItem" ADD CONSTRAINT "ItemGroupItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ItemGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemGroupItem" ADD CONSTRAINT "ItemGroupItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckSession" ADD CONSTRAINT "CheckSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ItemGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
