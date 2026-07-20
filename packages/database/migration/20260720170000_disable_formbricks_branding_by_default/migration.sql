-- AlterTable
-- Formbricks branding ("Powered by Formbricks") must not be shown on any survey (link or in-app/embedded)
ALTER TABLE "public"."Workspace" ALTER COLUMN "linkSurveyBranding" SET DEFAULT false;
ALTER TABLE "public"."Workspace" ALTER COLUMN "inAppSurveyBranding" SET DEFAULT false;

-- Disable branding for all existing workspaces
UPDATE "public"."Workspace" SET "linkSurveyBranding" = false, "inAppSurveyBranding" = false;
