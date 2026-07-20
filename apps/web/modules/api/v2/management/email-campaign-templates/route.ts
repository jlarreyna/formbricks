import { NextRequest } from "next/server";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import {
  ZEmailCampaignTemplateApiCreateInput,
  ZEmailCampaignTemplatesGetFilter,
} from "@/modules/api/v2/management/email-campaigns/types/email-campaigns";
import { resolveBodyIdsV2 } from "@/modules/api/v2/management/lib/workspace-resolver";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  createEmailCampaignTemplate,
  getEmailCampaignTemplates,
} from "@/modules/ee/email-campaigns/lib/templates";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZEmailCampaignTemplatesGetFilter,
    },
    handler: async ({ authentication, parsedInput }) => {
      const { query } = parsedInput;

      if (!query) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "query", issue: "missing" }],
        });
      }

      if (!hasPermission(authentication.workspacePermissions, query.workspaceId, "GET")) {
        return handleApiError(request, { type: "forbidden" });
      }

      const templates = await getEmailCampaignTemplates(query.workspaceId);
      return responses.successResponse({ data: templates });
    },
  });

export const POST = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZEmailCampaignTemplateApiCreateInput,
    },
    bodyTransform: async (body, auth) => {
      const resolved = await resolveBodyIdsV2(body, auth.workspacePermissions, "POST");
      if (!resolved.ok) throw resolved.error;
      return { ...body, ...resolved.data };
    },
    handler: async ({ parsedInput, authentication, auditLog }) => {
      const { body } = parsedInput;

      if (!body) {
        return handleApiError(
          request,
          { type: "bad_request", details: [{ field: "body", issue: "missing" }] },
          auditLog
        );
      }

      try {
        await applyRateLimit(rateLimitConfigs.api.emailCampaignTemplatesCreate, authentication.apiKeyId);
      } catch {
        return handleApiError(request, { type: "too_many_requests" }, auditLog);
      }

      const result = await createEmailCampaignTemplate({
        workspaceId: body.workspaceId,
        name: body.name,
        subject: body.subject,
        html: body.html,
      });

      if (!result.ok) {
        return handleApiError(request, result.error, auditLog);
      }

      if (auditLog) {
        auditLog.targetId = result.data.id;
        auditLog.newObject = result.data as unknown as Record<string, unknown>;
      }

      return responses.createdResponse(result);
    },
    action: "created",
    targetType: "emailCampaignTemplate",
  });
