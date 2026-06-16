CREATE TABLE "RecommendationDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "suggestedItem" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecommendationDismissal_userId_ruleId_suggestedItem_key" ON "RecommendationDismissal"("userId", "ruleId", "suggestedItem");
CREATE INDEX "RecommendationDismissal_userId_ruleId_idx" ON "RecommendationDismissal"("userId", "ruleId");

ALTER TABLE "RecommendationDismissal" ADD CONSTRAINT "RecommendationDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
