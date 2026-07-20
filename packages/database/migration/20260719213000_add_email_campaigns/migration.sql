-- CreateEnum
CREATE TYPE "public"."EmailCampaignMode" AS ENUM ('embed', 'link');

-- CreateEnum
CREATE TYPE "public"."EmailCampaignStatus" AS ENUM ('processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "public"."EmailCampaignSource" AS ENUM ('ui', 'api');

-- CreateEnum
CREATE TYPE "public"."EmailCampaignRecipientStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "public"."EmailCampaign" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "subject" TEXT NOT NULL,
    "mode" "public"."EmailCampaignMode" NOT NULL,
    "status" "public"."EmailCampaignStatus" NOT NULL DEFAULT 'processing',
    "source" "public"."EmailCampaignSource" NOT NULL DEFAULT 'ui',
    "workspaceId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "createdBy" TEXT,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailCampaignRecipient" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "email" TEXT NOT NULL,
    "hiddenFields" JSONB NOT NULL DEFAULT '{}',
    "status" "public"."EmailCampaignRecipientStatus" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailCampaign_workspaceId_created_at_idx" ON "public"."EmailCampaign"("workspaceId", "created_at");

-- CreateIndex
CREATE INDEX "EmailCampaign_surveyId_idx" ON "public"."EmailCampaign"("surveyId");

-- CreateIndex
CREATE INDEX "EmailCampaignRecipient_campaignId_idx" ON "public"."EmailCampaignRecipient"("campaignId");

-- CreateIndex
CREATE INDEX "EmailCampaignRecipient_campaignId_status_idx" ON "public"."EmailCampaignRecipient"("campaignId", "status");

-- AddForeignKey
ALTER TABLE "public"."EmailCampaign" ADD CONSTRAINT "EmailCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailCampaign" ADD CONSTRAINT "EmailCampaign_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailCampaign" ADD CONSTRAINT "EmailCampaign_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
