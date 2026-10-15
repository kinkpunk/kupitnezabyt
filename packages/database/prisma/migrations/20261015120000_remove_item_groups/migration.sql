-- Remove historical group-scoped check sessions and group reminders before
-- dropping the ItemGroup tables and columns. The feature is being removed.

DELETE FROM "CheckSessionItem"
WHERE "sessionId" IN (
  SELECT "id" FROM "CheckSession" WHERE "groupId" IS NOT NULL
);

DELETE FROM "CheckSession" WHERE "groupId" IS NOT NULL;

DELETE FROM "Reminder" WHERE "type" = 'GROUP_CHECK';

-- DropForeignKey
ALTER TABLE "CheckSession" DROP CONSTRAINT "CheckSession_groupId_fkey";

-- DropIndex
DROP INDEX "CheckSession_groupId_status_idx";

-- AlterTable
ALTER TABLE "CheckSession" DROP COLUMN "groupId";

-- DropIndex
DROP INDEX "Reminder_groupId_scheduledFor_idx";

-- AlterTable
ALTER TABLE "Reminder" DROP COLUMN "groupId";

-- DropTable
DROP TABLE "ItemGroupItem";

-- DropTable
DROP TABLE "ItemGroup";

-- AlterEnum
BEGIN;
CREATE TYPE "ReminderType_new" AS ENUM ('ITEM_CHECK', 'CATEGORY_CHECK', 'SHOPPING_REMINDER');
ALTER TABLE "Reminder" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Reminder" ALTER COLUMN "type" TYPE "ReminderType_new" USING ("type"::text::"ReminderType_new");
ALTER TYPE "ReminderType" RENAME TO "ReminderType_old";
ALTER TYPE "ReminderType_new" RENAME TO "ReminderType";
DROP TYPE "ReminderType_old";
COMMIT;
