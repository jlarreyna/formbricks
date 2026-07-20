-- AlterEnum
-- Must be committed separately before the new enum value is used in the same migration transaction.
ALTER TYPE "public"."EmailCampaignSource" ADD VALUE IF NOT EXISTS 'transactional';

-- AlterTable
ALTER TABLE "public"."EmailCampaign" ADD COLUMN IF NOT EXISTS "htmlTemplate" TEXT;
ALTER TABLE "public"."EmailCampaign" ADD COLUMN IF NOT EXISTS "templateId" TEXT;

-- AlterTable
ALTER TABLE "public"."EmailCampaignRecipient" ADD COLUMN IF NOT EXISTS "variables" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."EmailCampaignTemplate" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "html" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "EmailCampaignTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailCampaignTemplate_workspaceId_created_at_idx" ON "public"."EmailCampaignTemplate"("workspaceId", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailCampaign_templateId_idx" ON "public"."EmailCampaign"("templateId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."EmailCampaignTemplate" ADD CONSTRAINT "EmailCampaignTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "public"."EmailCampaignTemplate" ADD CONSTRAINT "EmailCampaignTemplate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "public"."EmailCampaign" ADD CONSTRAINT "EmailCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."EmailCampaignTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
