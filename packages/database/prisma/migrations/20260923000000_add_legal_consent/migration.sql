-- Track explicit acceptance of the Terms of Service and Privacy Policy
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "termsAcceptedVersion" TEXT,
ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "privacyAcceptedVersion" TEXT;

-- Carry optional legal consent through the OAuth sign-in flow
ALTER TABLE "OAuthStateToken" ADD COLUMN "consent" JSONB;
