-- AlterEnum
ALTER TYPE "OrganizationRole" ADD VALUE 'auditor';

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "target_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ip_address" TEXT,
    "api_url" TEXT,
    "event_id" TEXT,
    "changes" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "public"."audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_actor_id_created_at_idx" ON "public"."audit_logs"("organization_id", "actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_action_created_at_idx" ON "public"."audit_logs"("organization_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_target_type_created_at_idx" ON "public"."audit_logs"("organization_id", "target_type", "created_at");

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
