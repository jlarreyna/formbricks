import { z } from "zod";

export const ZEmailCampaignMode = z.enum(["embed", "link"]);
export type TEmailCampaignMode = z.infer<typeof ZEmailCampaignMode>;

export const ZEmailCampaignStatus = z.enum(["processing", "completed", "failed"]);
export type TEmailCampaignStatus = z.infer<typeof ZEmailCampaignStatus>;

export const ZEmailCampaignSource = z.enum(["ui", "api", "transactional"]);
export type TEmailCampaignSource = z.infer<typeof ZEmailCampaignSource>;

export const ZEmailCampaignRecipientStatus = z.enum(["pending", "sent", "failed"]);
export type TEmailCampaignRecipientStatus = z.infer<typeof ZEmailCampaignRecipientStatus>;

// Reserved query params used by the survey link/prefill pipeline — hidden field ids must avoid these.
export const EMAIL_CAMPAIGN_RESERVED_HIDDEN_FIELD_IDS = [
  "userid",
  "source",
  "suid",
  "sutoken",
  "end",
  "start",
  "welcomecard",
  "hidden",
  "verifiedemail",
  "multilanguage",
  "embed",
  "verify",
  "preview",
  "skipprefilled",
  "lang",
  "email",
] as const;

export const ZEmailCampaignHiddenFields = z.record(z.string(), z.string());
export type TEmailCampaignHiddenFields = z.infer<typeof ZEmailCampaignHiddenFields>;

export const ZEmailCampaignVariables = z.record(z.string(), z.string());
export type TEmailCampaignVariables = z.infer<typeof ZEmailCampaignVariables>;

export const ZEmailCampaignRecipientInput = z.object({
  email: z.email(),
  hiddenFields: ZEmailCampaignHiddenFields.optional(),
  variables: ZEmailCampaignVariables.optional(),
});
export type TEmailCampaignRecipientInput = z.infer<typeof ZEmailCampaignRecipientInput>;

export const MAX_EMAIL_CAMPAIGN_RECIPIENTS = 5000;
export const MAX_EMAIL_CAMPAIGN_TEMPLATE_HTML = 50_000;

export const ZEmailCampaignCreateInput = z.object({
  workspaceId: z.cuid2(),
  surveyId: z.cuid2(),
  mode: ZEmailCampaignMode,
  subject: z.string().min(1).max(200),
  name: z.string().max(200).optional(),
  templateId: z.cuid2().optional(),
  recipients: z.array(ZEmailCampaignRecipientInput).min(1).max(MAX_EMAIL_CAMPAIGN_RECIPIENTS),
});
export type TEmailCampaignCreateInput = z.infer<typeof ZEmailCampaignCreateInput>;

export const ZEmailCampaignRecipient = z.object({
  id: z.string(),
  campaignId: z.string(),
  contactId: z.string().nullable(),
  email: z.email(),
  hiddenFields: ZEmailCampaignHiddenFields,
  variables: ZEmailCampaignVariables,
  status: ZEmailCampaignRecipientStatus,
  error: z.string().nullable(),
  sentAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TEmailCampaignRecipient = z.infer<typeof ZEmailCampaignRecipient>;

export const ZEmailCampaign = z.object({
  id: z.string(),
  name: z.string().nullable(),
  subject: z.string(),
  mode: ZEmailCampaignMode,
  status: ZEmailCampaignStatus,
  source: ZEmailCampaignSource,
  workspaceId: z.string(),
  surveyId: z.string(),
  templateId: z.string().nullable(),
  createdBy: z.string().nullable(),
  totalRecipients: z.number(),
  sentCount: z.number(),
  failedCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TEmailCampaign = z.infer<typeof ZEmailCampaign>;

export const ZEmailCampaignTemplate = z.object({
  id: z.string(),
  name: z.string(),
  subject: z.string().nullable(),
  html: z.string(),
  workspaceId: z.string(),
  createdBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TEmailCampaignTemplate = z.infer<typeof ZEmailCampaignTemplate>;

export const ZEmailCampaignTemplateCreateInput = z.object({
  workspaceId: z.cuid2(),
  name: z.string().min(1).max(200),
  subject: z.string().max(200).optional(),
  html: z.string().min(1).max(MAX_EMAIL_CAMPAIGN_TEMPLATE_HTML),
});
export type TEmailCampaignTemplateCreateInput = z.infer<typeof ZEmailCampaignTemplateCreateInput>;

export const ZEmailCampaignTemplateUpdateInput = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().max(200).nullable().optional(),
  html: z.string().min(1).max(MAX_EMAIL_CAMPAIGN_TEMPLATE_HTML).optional(),
});
export type TEmailCampaignTemplateUpdateInput = z.infer<typeof ZEmailCampaignTemplateUpdateInput>;
