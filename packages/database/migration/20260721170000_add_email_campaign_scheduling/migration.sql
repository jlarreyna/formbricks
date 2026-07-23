-- AlterEnum
-- Must be committed separately before the new enum values are used in the same migration transaction.
ALTER TYPE "public"."EmailCampaignStatus" ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE "public"."EmailCampaignStatus" ADD VALUE IF NOT EXISTS 'canceled';

-- AlterTable
ALTER TABLE "public"."EmailCampaign" ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMP(3);
ALTER TABLE "public"."EmailCampaign" ADD COLUMN IF NOT EXISTS "dispatch_job_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailCampaign_status_scheduled_at_idx" ON "public"."EmailCampaign"("status", "scheduled_at");
