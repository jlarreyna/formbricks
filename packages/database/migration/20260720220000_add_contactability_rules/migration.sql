-- AlterEnum
ALTER TYPE "EmailCampaignRecipientStatus" ADD VALUE 'skipped';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "fatigueScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EmailCampaign" ADD COLUMN "skippedCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "EmailCampaignRecipient_contactId_sentAt_idx" ON "EmailCampaignRecipient"("contactId", "sentAt");

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "audienceFilters" JSONB;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "contactabilityRules" JSONB;
