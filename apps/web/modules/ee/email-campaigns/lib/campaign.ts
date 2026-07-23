import { prisma } from "@formbricks/database";
import { EmailCampaignRecipientStatus } from "@formbricks/database/prisma";
import {
  enqueueEmailCampaignRecipientJob,
  removeBackgroundJob,
  scheduleEmailCampaignDispatchJobAt,
} from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import {
  TEmailCampaignMode,
  TEmailCampaignRecipientInput,
  TEmailCampaignSource,
} from "@formbricks/types/email-campaigns";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { getSurvey } from "@/lib/survey/service";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { getContactAttributes } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { resolveContactIdsByEmail } from "@/modules/ee/email-campaigns/lib/contacts";
import { deliverEmailCampaignRecipientOrFail } from "@/modules/ee/email-campaigns/lib/deliver";
import { resolveCampaignHtmlTemplate } from "@/modules/ee/email-campaigns/lib/templates";
import { IS_SMTP_CONFIGURED } from "@/modules/email";

export type TEmailCampaignStatusValue = "scheduled" | "processing" | "completed" | "failed" | "canceled";

export interface TCreateEmailCampaignInput {
  workspaceId: string;
  surveyId: string;
  mode: TEmailCampaignMode;
  subject: string;
  name?: string;
  templateId?: string;
  recipients: Array<TEmailCampaignRecipientInput & { contactId?: string }>;
  source: TEmailCampaignSource;
  createdBy?: string;
  /** When true, deliver the single recipient synchronously instead of enqueueing. */
  deliverSynchronously?: boolean;
  /** When provided and in the future, the campaign is dispatched at this time instead of immediately. */
  scheduledAt?: Date;
}

export interface TEmailCampaignListItem {
  id: string;
  name: string | null;
  subject: string;
  mode: TEmailCampaignMode;
  status: TEmailCampaignStatusValue;
  source: TEmailCampaignSource;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  scheduledAt: Date | null;
  createdAt: Date;
  survey: { id: string; name: string };
}

const dedupeRecipientsByEmail = (
  recipients: Array<TEmailCampaignRecipientInput & { contactId?: string }>
): Array<TEmailCampaignRecipientInput & { contactId?: string }> => {
  const byEmail = new Map<string, TEmailCampaignRecipientInput & { contactId?: string }>();
  for (const recipient of recipients) {
    byEmail.set(recipient.email.trim().toLowerCase(), recipient);
  }
  return [...byEmail.values()];
};

const toListItem = (
  campaign: {
    id: string;
    name: string | null;
    subject: string;
    mode: TEmailCampaignMode;
    status: TEmailCampaignStatusValue;
    source: TEmailCampaignSource;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    scheduledAt: Date | null;
    createdAt: Date;
  },
  survey: { id: string; name: string }
): TEmailCampaignListItem => ({
  id: campaign.id,
  name: campaign.name,
  subject: campaign.subject,
  mode: campaign.mode,
  status: campaign.status,
  source: campaign.source,
  totalRecipients: campaign.totalRecipients,
  sentCount: campaign.sentCount,
  failedCount: campaign.failedCount,
  skippedCount: campaign.skippedCount,
  scheduledAt: campaign.scheduledAt,
  createdAt: campaign.createdAt,
  survey: { id: survey.id, name: survey.name },
});

const MIN_SCHEDULE_LEAD_TIME_MS = 60 * 1000;

const validateFutureScheduledAt = (scheduledAt: Date): Result<true, ApiErrorResponseV2> => {
  if (Number.isNaN(scheduledAt.getTime())) {
    return err({
      type: "bad_request",
      details: [{ field: "scheduledAt", issue: "invalid date" }],
    });
  }

  if (scheduledAt.getTime() - Date.now() <= MIN_SCHEDULE_LEAD_TIME_MS) {
    return err({
      type: "bad_request",
      details: [{ field: "scheduledAt", issue: "must be at least 1 minute in the future" }],
    });
  }

  return ok(true);
};

export const createEmailCampaign = async (
  input: TCreateEmailCampaignInput
): Promise<Result<TEmailCampaignListItem, ApiErrorResponseV2>> => {
  if (!IS_SMTP_CONFIGURED) {
    return err({
      type: "bad_request",
      details: [{ field: "smtp", issue: "SMTP is not configured on this instance" }],
    });
  }

  const survey = await getSurvey(input.surveyId);
  if (!survey || survey.workspaceId !== input.workspaceId) {
    return err({
      type: "not_found",
      details: [{ field: "surveyId", issue: "not_found" }],
    });
  }

  const recipients = dedupeRecipientsByEmail(input.recipients);
  if (recipients.length === 0) {
    return err({
      type: "bad_request",
      details: [{ field: "recipients", issue: "at least one valid recipient is required" }],
    });
  }

  if (input.deliverSynchronously && recipients.length !== 1) {
    return err({
      type: "bad_request",
      details: [{ field: "recipients", issue: "synchronous delivery requires exactly one recipient" }],
    });
  }

  if (input.scheduledAt) {
    if (input.deliverSynchronously) {
      return err({
        type: "bad_request",
        details: [{ field: "scheduledAt", issue: "cannot schedule a synchronous transactional send" }],
      });
    }

    const validation = validateFutureScheduledAt(input.scheduledAt);
    if (!validation.ok) {
      return validation;
    }
  }

  const allowedHiddenFieldIds = new Set(
    survey.hiddenFields.enabled ? (survey.hiddenFields.fieldIds ?? []) : []
  );
  const { html, templateId } = await resolveCampaignHtmlTemplate(input.workspaceId, input.templateId);

  try {
    const emailToContactId = await resolveContactIdsByEmail(
      input.workspaceId,
      recipients.map((recipient) => recipient.email)
    );

    const campaign = await prisma.emailCampaign.create({
      data: {
        workspaceId: input.workspaceId,
        surveyId: input.surveyId,
        subject: input.subject,
        name: input.name,
        mode: input.mode,
        source: input.source,
        createdBy: input.createdBy,
        totalRecipients: recipients.length,
        htmlTemplate: html,
        templateId,
        ...(input.scheduledAt ? { status: "scheduled" as const, scheduledAt: input.scheduledAt } : {}),
      },
    });

    const createdRecipients = await prisma.emailCampaignRecipient.createManyAndReturn({
      data: recipients.map((recipient) => {
        const email = recipient.email.trim().toLowerCase();
        const variables: Record<string, string> = {
          ...(recipient.variables ?? {}),
          email,
        };
        const hiddenFields = Object.fromEntries(
          Object.entries(recipient.hiddenFields ?? {}).filter(([fieldId]) =>
            allowedHiddenFieldIds.has(fieldId)
          )
        );

        // Also promote variable keys that match hidden field ids.
        for (const [key, value] of Object.entries(variables)) {
          if (allowedHiddenFieldIds.has(key) && !hiddenFields[key]) {
            hiddenFields[key] = value;
          }
        }

        return {
          campaignId: campaign.id,
          contactId: recipient.contactId ?? emailToContactId.get(email) ?? null,
          email,
          variables,
          hiddenFields,
        };
      }),
      select: { id: true },
    });

    if (input.deliverSynchronously) {
      await deliverEmailCampaignRecipientOrFail(createdRecipients[0].id);
      const refreshed = await prisma.emailCampaign.findUniqueOrThrow({
        where: { id: campaign.id },
        select: {
          id: true,
          name: true,
          subject: true,
          mode: true,
          status: true,
          source: true,
          totalRecipients: true,
          sentCount: true,
          failedCount: true,
          skippedCount: true,
          scheduledAt: true,
          createdAt: true,
        },
      });

      return ok(toListItem(refreshed, { id: survey.id, name: survey.name }));
    }

    if (input.scheduledAt) {
      try {
        const dispatchJob = await scheduleEmailCampaignDispatchJobAt(
          { runAt: input.scheduledAt },
          { campaignId: campaign.id }
        );
        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: { dispatchJobId: dispatchJob.id ?? null },
        });
      } catch (error) {
        logger.error(
          { err: error, campaignId: campaign.id },
          "Failed to schedule email campaign dispatch job"
        );
      }

      return ok(toListItem(campaign, { id: survey.id, name: survey.name }));
    }

    await Promise.all(
      createdRecipients.map(async (recipient) => {
        try {
          await enqueueEmailCampaignRecipientJob({ campaignId: campaign.id, recipientId: recipient.id });
        } catch (error) {
          logger.error(
            { err: error, campaignId: campaign.id, recipientId: recipient.id },
            "Failed to enqueue email campaign recipient job"
          );
        }
      })
    );

    return ok(toListItem(campaign, { id: survey.id, name: survey.name }));
  } catch (error) {
    logger.error({ err: error, workspaceId: input.workspaceId }, "Failed to create email campaign");
    return err({
      type: "internal_server_error",
      details: [{ field: "campaign", issue: error instanceof Error ? error.message : "Unknown error" }],
    });
  }
};

export const sendTransactionalEmailToContact = async (input: {
  workspaceId: string;
  contactId: string;
  surveyId: string;
  mode: TEmailCampaignMode;
  subject: string;
  templateId?: string;
  createdBy?: string;
}): Promise<Result<TEmailCampaignListItem, ApiErrorResponseV2>> => {
  const contact = await getContact(input.contactId);
  if (!contact || contact.workspaceId !== input.workspaceId) {
    return err({
      type: "not_found",
      details: [{ field: "contactId", issue: "not_found" }],
    });
  }

  const attributes = await getContactAttributes(input.contactId);
  const email = typeof attributes.email === "string" ? attributes.email.trim().toLowerCase() : "";
  if (!email) {
    return err({
      type: "bad_request",
      details: [{ field: "contactId", issue: "contact has no email attribute" }],
    });
  }

  const survey = await getSurvey(input.surveyId);
  if (!survey || survey.workspaceId !== input.workspaceId) {
    return err({
      type: "not_found",
      details: [{ field: "surveyId", issue: "not_found" }],
    });
  }

  const allowedHiddenFieldIds = new Set(
    survey.hiddenFields.enabled ? (survey.hiddenFields.fieldIds ?? []) : []
  );
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === "string") {
      variables[key] = value;
    } else if (value != null) {
      variables[key] = String(value);
    }
  }
  variables.email = email;

  const hiddenFields = Object.fromEntries(
    Object.entries(variables).filter(([fieldId]) => allowedHiddenFieldIds.has(fieldId))
  );

  return createEmailCampaign({
    workspaceId: input.workspaceId,
    surveyId: input.surveyId,
    mode: input.mode,
    subject: input.subject,
    templateId: input.templateId,
    recipients: [{ email, variables, hiddenFields, contactId: input.contactId }],
    source: "transactional",
    createdBy: input.createdBy,
    deliverSynchronously: true,
  });
};

export interface TEmailCampaignFailureItem {
  id: string;
  email: string;
  contactId: string | null;
  status: "skipped" | "failed";
  reason: string | null;
  updatedAt: Date;
}

export type TEmailCampaignListFilters = {
  workspaceId: string;
  source?: TEmailCampaignSource;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
};

export type TPaginatedEmailCampaigns = {
  data: TEmailCampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const DEFAULT_CAMPAIGN_LIST_LIMIT = 25;
const MAX_CAMPAIGN_LIST_LIMIT = 100;

const normalizeCampaignPagination = (page?: number, limit?: number) => {
  const pageSize = Math.min(Math.max(limit ?? DEFAULT_CAMPAIGN_LIST_LIMIT, 1), MAX_CAMPAIGN_LIST_LIMIT);
  const currentPage = Math.max(page ?? 1, 1);
  return {
    page: currentPage,
    pageSize,
    skip: (currentPage - 1) * pageSize,
  };
};

export const getEmailCampaigns = async (
  filters: TEmailCampaignListFilters
): Promise<TPaginatedEmailCampaigns> => {
  const { page, pageSize, skip } = normalizeCampaignPagination(filters.page, filters.limit);
  const where = {
    workspaceId: filters.workspaceId,
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  const [total, campaigns] = await Promise.all([
    prisma.emailCampaign.count({ where }),
    prisma.emailCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        subject: true,
        mode: true,
        status: true,
        source: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
        skippedCount: true,
        scheduledAt: true,
        createdAt: true,
        survey: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    data: campaigns.map((campaign) =>
      toListItem(campaign, { id: campaign.survey.id, name: campaign.survey.name })
    ),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
};

export const getEmailCampaignById = async (
  campaignId: string,
  workspaceId: string
): Promise<TEmailCampaignListItem | null> => {
  const campaign = await prisma.emailCampaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: {
      id: true,
      name: true,
      subject: true,
      mode: true,
      status: true,
      source: true,
      totalRecipients: true,
      sentCount: true,
      failedCount: true,
      skippedCount: true,
      scheduledAt: true,
      createdAt: true,
      survey: { select: { id: true, name: true } },
    },
  });

  if (!campaign) {
    return null;
  }

  return toListItem(campaign, { id: campaign.survey.id, name: campaign.survey.name });
};

const CAMPAIGN_LIST_ITEM_SELECT = {
  id: true,
  name: true,
  subject: true,
  mode: true,
  status: true,
  source: true,
  totalRecipients: true,
  sentCount: true,
  failedCount: true,
  skippedCount: true,
  scheduledAt: true,
  createdAt: true,
  survey: { select: { id: true, name: true } },
} as const;

/**
 * Cancels a campaign that is still `scheduled` (has not started dispatching). Removes the pending
 * BullMQ dispatch job so it never fires. No-op recipients were never created for scheduled campaigns.
 */
export const cancelEmailCampaign = async (
  campaignId: string,
  workspaceId: string
): Promise<Result<TEmailCampaignListItem, ApiErrorResponseV2>> => {
  const campaign = await prisma.emailCampaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { id: true, status: true, dispatchJobId: true },
  });

  if (!campaign) {
    return err({ type: "not_found", details: [{ field: "campaignId", issue: "not_found" }] });
  }

  if (campaign.status !== "scheduled") {
    return err({
      type: "bad_request",
      details: [{ field: "status", issue: "only scheduled campaigns can be canceled" }],
    });
  }

  if (campaign.dispatchJobId) {
    await removeBackgroundJob(campaign.dispatchJobId);
  }

  const updated = await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: "canceled", dispatchJobId: null },
    select: CAMPAIGN_LIST_ITEM_SELECT,
  });

  return ok(toListItem(updated, { id: updated.survey.id, name: updated.survey.name }));
};

/**
 * Reschedules a campaign that is still `scheduled` to a new future send time: removes the existing
 * dispatch job and schedules a new one, keeping the campaign in `scheduled` status.
 */
export const rescheduleEmailCampaign = async (
  campaignId: string,
  workspaceId: string,
  scheduledAt: Date
): Promise<Result<TEmailCampaignListItem, ApiErrorResponseV2>> => {
  const validation = validateFutureScheduledAt(scheduledAt);
  if (!validation.ok) {
    return validation;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { id: true, status: true, dispatchJobId: true },
  });

  if (!campaign) {
    return err({ type: "not_found", details: [{ field: "campaignId", issue: "not_found" }] });
  }

  if (campaign.status !== "scheduled") {
    return err({
      type: "bad_request",
      details: [{ field: "status", issue: "only scheduled campaigns can be rescheduled" }],
    });
  }

  if (campaign.dispatchJobId) {
    await removeBackgroundJob(campaign.dispatchJobId);
  }

  const dispatchJob = await scheduleEmailCampaignDispatchJobAt({ runAt: scheduledAt }, { campaignId });

  const updated = await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { scheduledAt, dispatchJobId: dispatchJob.id ?? null },
    select: CAMPAIGN_LIST_ITEM_SELECT,
  });

  return ok(toListItem(updated, { id: updated.survey.id, name: updated.survey.name }));
};

export type TEmailCampaignFailureFilters = {
  campaignId: string;
  workspaceId: string;
  page?: number;
  limit?: number;
};

export type TPaginatedEmailCampaignFailures = {
  data: TEmailCampaignFailureItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/**
 * Lists only the recipients of a campaign that were NOT successfully sent: those skipped by
 * contactability rules and those that hit a critical error during delivery. Successful (`sent`)
 * recipients are intentionally excluded — this is a failure log, not a full recipient list.
 */
export const getEmailCampaignFailures = async (
  filters: TEmailCampaignFailureFilters
): Promise<TPaginatedEmailCampaignFailures> => {
  const { page, pageSize, skip } = normalizeCampaignPagination(filters.page, filters.limit);
  const failureStatuses: EmailCampaignRecipientStatus[] = [
    EmailCampaignRecipientStatus.skipped,
    EmailCampaignRecipientStatus.failed,
  ];
  const where = {
    campaignId: filters.campaignId,
    campaign: { workspaceId: filters.workspaceId },
    status: { in: failureStatuses },
  };

  const [total, recipients] = await Promise.all([
    prisma.emailCampaignRecipient.count({ where }),
    prisma.emailCampaignRecipient.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        contactId: true,
        status: true,
        error: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    data: recipients.map((recipient) => ({
      id: recipient.id,
      email: recipient.email,
      contactId: recipient.contactId,
      status: recipient.status as "skipped" | "failed",
      reason: recipient.error,
      updatedAt: recipient.updatedAt,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
};
