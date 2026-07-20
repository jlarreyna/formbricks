import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { MAX_EMAIL_CAMPAIGN_TEMPLATE_HTML, TEmailCampaignTemplate } from "@formbricks/types/email-campaigns";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { DEFAULT_EMAIL_CAMPAIGN_TEMPLATE } from "@/modules/ee/email-campaigns/lib/template";

export type TEmailCampaignTemplateListItem = Pick<
  TEmailCampaignTemplate,
  "id" | "name" | "subject" | "html" | "workspaceId" | "createdBy" | "createdAt" | "updatedAt"
>;

export const getEmailCampaignTemplates = async (
  workspaceId: string
): Promise<TEmailCampaignTemplateListItem[]> => {
  return prisma.emailCampaignTemplate.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      subject: true,
      html: true,
      workspaceId: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const getEmailCampaignTemplate = async (
  templateId: string,
  workspaceId: string
): Promise<TEmailCampaignTemplateListItem | null> => {
  return prisma.emailCampaignTemplate.findFirst({
    where: { id: templateId, workspaceId },
    select: {
      id: true,
      name: true,
      subject: true,
      html: true,
      workspaceId: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

/**
 * Resolves the HTML snapshot for a campaign: saved template (if valid for the workspace) or the default.
 */
export const resolveCampaignHtmlTemplate = async (
  workspaceId: string,
  templateId?: string | null
): Promise<{ html: string; templateId: string | null }> => {
  if (!templateId) {
    return { html: DEFAULT_EMAIL_CAMPAIGN_TEMPLATE, templateId: null };
  }

  const template = await getEmailCampaignTemplate(templateId, workspaceId);
  if (!template) {
    return { html: DEFAULT_EMAIL_CAMPAIGN_TEMPLATE, templateId: null };
  }

  return { html: template.html, templateId: template.id };
};

export const createEmailCampaignTemplate = async (input: {
  workspaceId: string;
  name: string;
  subject?: string;
  html: string;
  createdBy?: string;
}): Promise<Result<TEmailCampaignTemplateListItem, ApiErrorResponseV2>> => {
  if (input.html.length > MAX_EMAIL_CAMPAIGN_TEMPLATE_HTML) {
    return err({
      type: "bad_request",
      details: [{ field: "html", issue: `html exceeds max length of ${MAX_EMAIL_CAMPAIGN_TEMPLATE_HTML}` }],
    });
  }

  try {
    const template = await prisma.emailCampaignTemplate.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name.trim(),
        subject: input.subject?.trim() || null,
        html: input.html,
        createdBy: input.createdBy,
      },
      select: {
        id: true,
        name: true,
        subject: true,
        html: true,
        workspaceId: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return ok(template);
  } catch (error) {
    logger.error({ err: error, workspaceId: input.workspaceId }, "Failed to create email campaign template");
    return err({
      type: "internal_server_error",
      details: [{ field: "template", issue: error instanceof Error ? error.message : "Unknown error" }],
    });
  }
};

export const updateEmailCampaignTemplate = async (input: {
  templateId: string;
  workspaceId: string;
  name?: string;
  subject?: string | null;
  html?: string;
}): Promise<Result<TEmailCampaignTemplateListItem, ApiErrorResponseV2>> => {
  const existing = await getEmailCampaignTemplate(input.templateId, input.workspaceId);
  if (!existing) {
    return err({
      type: "not_found",
      details: [{ field: "templateId", issue: "not_found" }],
    });
  }

  if (input.html !== undefined && input.html.length > MAX_EMAIL_CAMPAIGN_TEMPLATE_HTML) {
    return err({
      type: "bad_request",
      details: [{ field: "html", issue: `html exceeds max length of ${MAX_EMAIL_CAMPAIGN_TEMPLATE_HTML}` }],
    });
  }

  try {
    const template = await prisma.emailCampaignTemplate.update({
      where: { id: input.templateId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.subject !== undefined ? { subject: input.subject?.trim() || null } : {}),
        ...(input.html !== undefined ? { html: input.html } : {}),
      },
      select: {
        id: true,
        name: true,
        subject: true,
        html: true,
        workspaceId: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return ok(template);
  } catch (error) {
    logger.error({ err: error, templateId: input.templateId }, "Failed to update email campaign template");
    return err({
      type: "internal_server_error",
      details: [{ field: "template", issue: error instanceof Error ? error.message : "Unknown error" }],
    });
  }
};

export const deleteEmailCampaignTemplate = async (
  templateId: string,
  workspaceId: string
): Promise<Result<{ id: string }, ApiErrorResponseV2>> => {
  const existing = await getEmailCampaignTemplate(templateId, workspaceId);
  if (!existing) {
    return err({
      type: "not_found",
      details: [{ field: "templateId", issue: "not_found" }],
    });
  }

  try {
    await prisma.emailCampaignTemplate.delete({ where: { id: templateId } });
    return ok({ id: templateId });
  } catch (error) {
    logger.error({ err: error, templateId }, "Failed to delete email campaign template");
    return err({
      type: "internal_server_error",
      details: [{ field: "template", issue: error instanceof Error ? error.message : "Unknown error" }],
    });
  }
};
