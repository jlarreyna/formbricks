"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  MAX_EMAIL_CAMPAIGN_RECIPIENTS,
  MAX_EMAIL_CAMPAIGN_TEMPLATE_HTML,
  ZEmailCampaignMode,
  ZEmailCampaignRecipientInput,
} from "@formbricks/types/email-campaigns";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { createEmailCampaign, getEmailCampaigns, sendTransactionalEmailToContact } from "./lib/campaign";
import {
  createEmailCampaignTemplate,
  deleteEmailCampaignTemplate,
  getEmailCampaignTemplate,
  getEmailCampaignTemplates,
  updateEmailCampaignTemplate,
} from "./lib/templates";

const ZGetEmailCampaignsAction = z.object({
  workspaceId: ZId,
});

export const getEmailCampaignsAction = authenticatedActionClient
  .inputSchema(ZGetEmailCampaignsAction)
  .action(async ({ ctx, parsedInput }) => {
    const { workspaceId } = parsedInput;

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromWorkspaceId(workspaceId),
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "workspaceTeam", workspaceId, minPermission: "read" },
      ],
    });

    return getEmailCampaigns(workspaceId);
  });

const ZCreateEmailCampaignAction = z.object({
  workspaceId: ZId,
  surveyId: ZId,
  mode: ZEmailCampaignMode,
  subject: z.string().min(1).max(200),
  name: z.string().max(200).optional(),
  templateId: ZId.optional(),
  recipients: z.array(ZEmailCampaignRecipientInput).min(1).max(MAX_EMAIL_CAMPAIGN_RECIPIENTS),
});

export const createEmailCampaignAction = authenticatedActionClient
  .inputSchema(ZCreateEmailCampaignAction)
  .action(
    withAuditLogging("created", "emailCampaign", async ({ ctx, parsedInput }) => {
      const { workspaceId, surveyId, mode, subject, name, templateId, recipients } = parsedInput;
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          { type: "organization", roles: ["owner", "manager"] },
          { type: "workspaceTeam", workspaceId, minPermission: "readWrite" },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;

      const result = await createEmailCampaign({
        workspaceId,
        surveyId,
        mode,
        subject,
        name,
        templateId,
        recipients,
        source: "ui",
        createdBy: ctx.user.id,
      });

      if (!result.ok) {
        throw new Error(result.error.details?.[0]?.issue ?? result.error.type);
      }

      ctx.auditLoggingCtx.emailCampaignId = result.data.id;
      ctx.auditLoggingCtx.newObject = result.data as unknown as Record<string, unknown>;

      return result.data;
    })
  );

const ZSendTransactionalEmailAction = z.object({
  workspaceId: ZId,
  contactId: ZId,
  surveyId: ZId,
  mode: ZEmailCampaignMode,
  subject: z.string().min(1).max(200),
  templateId: ZId.optional(),
});

export const sendTransactionalEmailToContactAction = authenticatedActionClient
  .inputSchema(ZSendTransactionalEmailAction)
  .action(
    withAuditLogging("created", "emailCampaign", async ({ ctx, parsedInput }) => {
      const { workspaceId, contactId, surveyId, mode, subject, templateId } = parsedInput;
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          { type: "organization", roles: ["owner", "manager"] },
          { type: "workspaceTeam", workspaceId, minPermission: "readWrite" },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;

      const result = await sendTransactionalEmailToContact({
        workspaceId,
        contactId,
        surveyId,
        mode,
        subject,
        templateId,
        createdBy: ctx.user.id,
      });

      if (!result.ok) {
        throw new Error(result.error.details?.[0]?.issue ?? result.error.type);
      }

      ctx.auditLoggingCtx.emailCampaignId = result.data.id;
      ctx.auditLoggingCtx.newObject = {
        ...(result.data as unknown as Record<string, unknown>),
        contactId,
      };

      return result.data;
    })
  );

const ZGetEmailCampaignTemplatesAction = z.object({
  workspaceId: ZId,
});

export const getEmailCampaignTemplatesAction = authenticatedActionClient
  .inputSchema(ZGetEmailCampaignTemplatesAction)
  .action(async ({ ctx, parsedInput }) => {
    const { workspaceId } = parsedInput;

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromWorkspaceId(workspaceId),
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "workspaceTeam", workspaceId, minPermission: "read" },
      ],
    });

    return getEmailCampaignTemplates(workspaceId);
  });

const ZCreateEmailCampaignTemplateAction = z.object({
  workspaceId: ZId,
  name: z.string().min(1).max(200),
  subject: z.string().max(200).optional(),
  html: z.string().min(1).max(MAX_EMAIL_CAMPAIGN_TEMPLATE_HTML),
});

export const createEmailCampaignTemplateAction = authenticatedActionClient
  .inputSchema(ZCreateEmailCampaignTemplateAction)
  .action(
    withAuditLogging("created", "emailCampaignTemplate", async ({ ctx, parsedInput }) => {
      const { workspaceId, name, subject, html } = parsedInput;
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          { type: "organization", roles: ["owner", "manager"] },
          { type: "workspaceTeam", workspaceId, minPermission: "readWrite" },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;

      const result = await createEmailCampaignTemplate({
        workspaceId,
        name,
        subject,
        html,
        createdBy: ctx.user.id,
      });

      if (!result.ok) {
        throw new Error(result.error.details?.[0]?.issue ?? result.error.type);
      }

      ctx.auditLoggingCtx.emailCampaignTemplateId = result.data.id;
      ctx.auditLoggingCtx.newObject = result.data as unknown as Record<string, unknown>;

      return result.data;
    })
  );

const ZUpdateEmailCampaignTemplateAction = z.object({
  workspaceId: ZId,
  templateId: ZId,
  name: z.string().min(1).max(200).optional(),
  subject: z.string().max(200).nullable().optional(),
  html: z.string().min(1).max(MAX_EMAIL_CAMPAIGN_TEMPLATE_HTML).optional(),
});

export const updateEmailCampaignTemplateAction = authenticatedActionClient
  .inputSchema(ZUpdateEmailCampaignTemplateAction)
  .action(
    withAuditLogging("updated", "emailCampaignTemplate", async ({ ctx, parsedInput }) => {
      const { workspaceId, templateId, name, subject, html } = parsedInput;
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          { type: "organization", roles: ["owner", "manager"] },
          { type: "workspaceTeam", workspaceId, minPermission: "readWrite" },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.emailCampaignTemplateId = templateId;

      const existing = await getEmailCampaignTemplate(templateId, workspaceId);
      if (existing) {
        ctx.auditLoggingCtx.oldObject = existing as unknown as Record<string, unknown>;
      }

      const result = await updateEmailCampaignTemplate({
        templateId,
        workspaceId,
        name,
        subject,
        html,
      });

      if (!result.ok) {
        throw new Error(result.error.details?.[0]?.issue ?? result.error.type);
      }

      ctx.auditLoggingCtx.newObject = result.data as unknown as Record<string, unknown>;

      return result.data;
    })
  );

const ZDeleteEmailCampaignTemplateAction = z.object({
  workspaceId: ZId,
  templateId: ZId,
});

export const deleteEmailCampaignTemplateAction = authenticatedActionClient
  .inputSchema(ZDeleteEmailCampaignTemplateAction)
  .action(
    withAuditLogging("deleted", "emailCampaignTemplate", async ({ ctx, parsedInput }) => {
      const { workspaceId, templateId } = parsedInput;
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          { type: "organization", roles: ["owner", "manager"] },
          { type: "workspaceTeam", workspaceId, minPermission: "readWrite" },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.emailCampaignTemplateId = templateId;

      const existing = await getEmailCampaignTemplate(templateId, workspaceId);
      if (existing) {
        ctx.auditLoggingCtx.oldObject = existing as unknown as Record<string, unknown>;
      }

      const result = await deleteEmailCampaignTemplate(templateId, workspaceId);
      if (!result.ok) {
        throw new Error(result.error.details?.[0]?.issue ?? result.error.type);
      }

      return result.data;
    })
  );
