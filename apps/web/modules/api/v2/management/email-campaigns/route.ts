import { NextRequest } from "next/server";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { resolveEmailCampaignApiRecipients } from "@/modules/api/v2/management/email-campaigns/lib/email-campaigns";
import {
  ZEmailCampaignApiCreateInput,
  ZEmailCampaignMultipartCreateInput,
  ZEmailCampaignsGetFilter,
} from "@/modules/api/v2/management/email-campaigns/types/email-campaigns";
import { resolveBodyIdsV2 } from "@/modules/api/v2/management/lib/workspace-resolver";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { createEmailCampaign, getEmailCampaigns } from "@/modules/ee/email-campaigns/lib/campaign";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

const MAX_MULTIPART_CSV_BYTES = 2_000_000;

const getStringFormValue = (formData: FormData, key: string): string | undefined => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

const getCsvFile = (formData: FormData): File | null => {
  const file = formData.get("file");
  return file instanceof File ? file : null;
};

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZEmailCampaignsGetFilter,
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

      const result = await getEmailCampaigns({
        workspaceId: query.workspaceId,
        source: query.source,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        page: query.page,
        limit: query.limit,
      });
      return responses.successResponse({
        data: result.data,
        meta: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          pageCount: result.pageCount,
        },
      });
    },
  });

const handleJsonPost = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZEmailCampaignApiCreateInput,
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
        await applyRateLimit(rateLimitConfigs.api.emailCampaignsCreate, authentication.apiKeyId);
      } catch {
        return handleApiError(request, { type: "too_many_requests" }, auditLog);
      }

      const recipientsResult = await resolveEmailCampaignApiRecipients(body);
      if (!recipientsResult.ok) {
        return handleApiError(request, recipientsResult.error, auditLog);
      }

      const result = await createEmailCampaign({
        workspaceId: body.workspaceId,
        surveyId: body.surveyId,
        mode: body.mode,
        subject: body.subject,
        name: body.name,
        templateId: body.templateId,
        recipients: recipientsResult.data,
        source: "api",
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
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
    targetType: "emailCampaign",
  });

const handleMultipartPost = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    handler: async ({ authentication, auditLog }) => {
      try {
        await applyRateLimit(rateLimitConfigs.api.emailCampaignsCreate, authentication.apiKeyId);
      } catch {
        return handleApiError(request, { type: "too_many_requests" }, auditLog);
      }

      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return handleApiError(
          request,
          { type: "bad_request", details: [{ field: "body", issue: "Malformed form data" }] },
          auditLog
        );
      }

      const rawFields = {
        workspaceId: getStringFormValue(formData, "workspaceId"),
        surveyId: getStringFormValue(formData, "surveyId"),
        mode: getStringFormValue(formData, "mode"),
        subject: getStringFormValue(formData, "subject"),
        name: getStringFormValue(formData, "name"),
        templateId: getStringFormValue(formData, "templateId"),
        scheduledAt: getStringFormValue(formData, "scheduledAt"),
      };

      const parsedFields = ZEmailCampaignMultipartCreateInput.safeParse(rawFields);
      if (!parsedFields.success) {
        return handleApiError(
          request,
          {
            type: "unprocessable_entity",
            details: parsedFields.error.issues.map((issue) => ({
              field: issue.path.join(".") || "body",
              issue: issue.message,
            })),
          },
          auditLog
        );
      }

      const workspace = await findWorkspaceByIdOrLegacyEnvId(parsedFields.data.workspaceId);
      if (!workspace) {
        return handleApiError(
          request,
          { type: "not_found", details: [{ field: "workspaceId", issue: "workspace not found" }] },
          auditLog
        );
      }

      if (!hasPermission(authentication.workspacePermissions, workspace.id, "POST")) {
        return handleApiError(request, { type: "forbidden" }, auditLog);
      }

      const file = getCsvFile(formData);
      if (!file) {
        return handleApiError(
          request,
          { type: "bad_request", details: [{ field: "file", issue: "CSV file is required" }] },
          auditLog
        );
      }

      if (file.size > MAX_MULTIPART_CSV_BYTES) {
        return handleApiError(
          request,
          {
            type: "payload_too_large",
            details: [{ field: "file", issue: `CSV file exceeds ${MAX_MULTIPART_CSV_BYTES} bytes` }],
          },
          auditLog
        );
      }

      const csv = await file.text();
      const recipientsResult = await resolveEmailCampaignApiRecipients({
        workspaceId: workspace.id,
        surveyId: parsedFields.data.surveyId,
        mode: parsedFields.data.mode,
        subject: parsedFields.data.subject,
        name: parsedFields.data.name,
        templateId: parsedFields.data.templateId,
        csv,
      });

      if (!recipientsResult.ok) {
        return handleApiError(request, recipientsResult.error, auditLog);
      }

      const result = await createEmailCampaign({
        workspaceId: workspace.id,
        surveyId: parsedFields.data.surveyId,
        mode: parsedFields.data.mode,
        subject: parsedFields.data.subject,
        name: parsedFields.data.name,
        templateId: parsedFields.data.templateId,
        recipients: recipientsResult.data,
        source: "api",
        scheduledAt: parsedFields.data.scheduledAt ? new Date(parsedFields.data.scheduledAt) : undefined,
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
    targetType: "emailCampaign",
  });

export const POST = async (request: NextRequest) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return handleMultipartPost(request);
  }
  return handleJsonPost(request);
};
