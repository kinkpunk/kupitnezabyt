CREATE TYPE "ReminderType" AS ENUM ('ITEM_CHECK', 'CATEGORY_CHECK', 'GROUP_CHECK', 'SHOPPING_REMINDER');
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

ALTER TABLE "Category"
  ADD COLUMN "usageCycleDays" INTEGER,
  ADD COLUMN "nextCheckAt" TIMESTAMP(3),
  ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "Reminder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ReminderType" NOT NULL,
  "itemId" TEXT,
  "categoryId" TEXT,
  "groupId" TEXT,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Reminder_idempotencyKey_key" ON "Reminder"("idempotencyKey");
CREATE INDEX "Category_userId_nextCheckAt_idx" ON "Category"("userId", "nextCheckAt");
CREATE INDEX "Item_userId_nextCheckAt_idx" ON "Item"("userId", "nextCheckAt");
CREATE INDEX "Reminder_userId_status_scheduledFor_idx" ON "Reminder"("userId", "status", "scheduledFor");
CREATE INDEX "Reminder_itemId_scheduledFor_idx" ON "Reminder"("itemId", "scheduledFor");
CREATE INDEX "Reminder_categoryId_scheduledFor_idx" ON "Reminder"("categoryId", "scheduledFor");
CREATE INDEX "Reminder_groupId_scheduledFor_idx" ON "Reminder"("groupId", "scheduledFor");

ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
