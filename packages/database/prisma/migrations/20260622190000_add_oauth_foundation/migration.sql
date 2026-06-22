CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'APPLE');

CREATE TABLE "AuthAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "email" TEXT,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthStateToken" (
  "id" TEXT NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "stateHash" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthStateToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthAccount_provider_providerAccountId_key"
  ON "AuthAccount"("provider", "providerAccountId");
CREATE INDEX "AuthAccount_userId_idx" ON "AuthAccount"("userId");
CREATE INDEX "AuthAccount_email_idx" ON "AuthAccount"("email");

CREATE UNIQUE INDEX "OAuthStateToken_stateHash_key" ON "OAuthStateToken"("stateHash");
CREATE INDEX "OAuthStateToken_provider_createdAt_idx" ON "OAuthStateToken"("provider", "createdAt");
CREATE INDEX "OAuthStateToken_expiresAt_idx" ON "OAuthStateToken"("expiresAt");

ALTER TABLE "AuthAccount"
  ADD CONSTRAINT "AuthAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
