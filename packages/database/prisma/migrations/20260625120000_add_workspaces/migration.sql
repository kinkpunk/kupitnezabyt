CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceMember" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'EDITOR',
  "invitedEmail" TEXT,
  "invitedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Category" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Item" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ShoppingListItem" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Reminder" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ItemGroup" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "CheckSession" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "RecommendationDismissal" ADD COLUMN "workspaceId" TEXT;

INSERT INTO "Workspace" ("id", "ownerId", "name", "createdAt", "updatedAt")
SELECT
  'workspace_' || "id",
  "id",
  COALESCE("displayName", "firstName", "email", 'Личный список'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User";

INSERT INTO "WorkspaceMember" (
  "id",
  "workspaceId",
  "userId",
  "role",
  "joinedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'workspace_member_' || "id",
  'workspace_' || "id",
  "id",
  'OWNER',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User";

UPDATE "Category" SET "workspaceId" = 'workspace_' || "userId";
UPDATE "Item" SET "workspaceId" = 'workspace_' || "userId";
UPDATE "ShoppingListItem" SET "workspaceId" = 'workspace_' || "userId";
UPDATE "Reminder" SET "workspaceId" = 'workspace_' || "userId";
UPDATE "ItemGroup" SET "workspaceId" = 'workspace_' || "userId";
UPDATE "CheckSession" SET "workspaceId" = 'workspace_' || "userId";
UPDATE "RecommendationDismissal" SET "workspaceId" = 'workspace_' || "userId";

CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key"
  ON "WorkspaceMember"("workspaceId", "userId");
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");
CREATE INDEX "WorkspaceMember_invitedEmail_idx" ON "WorkspaceMember"("invitedEmail");

CREATE INDEX "Category_workspaceId_archivedAt_idx" ON "Category"("workspaceId", "archivedAt");
CREATE INDEX "Category_workspaceId_nextCheckAt_idx" ON "Category"("workspaceId", "nextCheckAt");
CREATE INDEX "Item_workspaceId_categoryId_archivedAt_idx"
  ON "Item"("workspaceId", "categoryId", "archivedAt");
CREATE INDEX "Item_workspaceId_status_idx" ON "Item"("workspaceId", "status");
CREATE INDEX "Item_workspaceId_nextCheckAt_idx" ON "Item"("workspaceId", "nextCheckAt");
CREATE INDEX "ShoppingListItem_workspaceId_isCompleted_priority_idx"
  ON "ShoppingListItem"("workspaceId", "isCompleted", "priority");
CREATE INDEX "Reminder_workspaceId_status_scheduledFor_idx"
  ON "Reminder"("workspaceId", "status", "scheduledFor");
CREATE INDEX "ItemGroup_workspaceId_archivedAt_idx" ON "ItemGroup"("workspaceId", "archivedAt");
CREATE INDEX "ItemGroup_workspaceId_nextCheckAt_idx" ON "ItemGroup"("workspaceId", "nextCheckAt");
CREATE INDEX "CheckSession_workspaceId_status_startedAt_idx"
  ON "CheckSession"("workspaceId", "status", "startedAt");
CREATE INDEX "RecommendationDismissal_workspaceId_ruleId_idx"
  ON "RecommendationDismissal"("workspaceId", "ruleId");

ALTER TABLE "Workspace"
  ADD CONSTRAINT "Workspace_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item"
  ADD CONSTRAINT "Item_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingListItem"
  ADD CONSTRAINT "ShoppingListItem_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder"
  ADD CONSTRAINT "Reminder_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemGroup"
  ADD CONSTRAINT "ItemGroup_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckSession"
  ADD CONSTRAINT "CheckSession_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationDismissal"
  ADD CONSTRAINT "RecommendationDismissal_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
