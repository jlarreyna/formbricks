import { z } from "zod";
import {
  MAX_EMAIL_CAMPAIGN_RECIPIENTS,
  ZEmailCampaignMode,
  ZEmailCampaignRecipientInput,
  ZEmailCampaignTemplateCreateInput,
} from "@formbricks/types/email-campaigns";

// Route-level schema for transactional/bulk sends via the API. Recipients can be provided either as a
// JSON array (already-parsed emails + hidden fields + variables) or as a raw CSV string (parsed
// server-side) — at least one of the two must be present. templateId is optional (default template).
export const ZEmailCampaignApiCreateInput = z
  .object({
    workspaceId: z.cuid2(),
    surveyId: z.cuid2(),
    mode: ZEmailCampaignMode,
    subject: z.string().min(1).max(200),
    name: z.string().max(200).optional(),
    templateId: z.cuid2().optional(),
    recipients: z.array(ZEmailCampaignRecipientInput).max(MAX_EMAIL_CAMPAIGN_RECIPIENTS).optional(),
    csv: z.string().max(2_000_000).optional(),
    // ISO 8601 datetime. When set and in the future, the campaign is dispatched at this time instead of immediately.
    scheduledAt: z.string().datetime().optional(),
  })
  .refine(
    (data) => (data.recipients && data.recipients.length > 0) || (data.csv && data.csv.trim().length > 0),
    {
      message: "Either `recipients` or `csv` must be provided with at least one recipient",
      path: ["recipients"],
    }
  );

export type TEmailCampaignApiCreateInput = z.infer<typeof ZEmailCampaignApiCreateInput>;

export const ZEmailCampaignsGetFilter = z.object({
  workspaceId: z.cuid2(),
  source: z.enum(["ui", "api", "transactional"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type TEmailCampaignsGetFilter = z.infer<typeof ZEmailCampaignsGetFilter>;

export const ZEmailCampaignMultipartCreateInput = z.object({
  workspaceId: z.cuid2(),
  surveyId: z.cuid2(),
  mode: ZEmailCampaignMode,
  subject: z.string().min(1).max(200),
  name: z.string().max(200).optional(),
  templateId: z.cuid2().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export type TEmailCampaignMultipartCreateInput = z.infer<typeof ZEmailCampaignMultipartCreateInput>;

export const ZEmailCampaignTemplatesGetFilter = z.object({
  workspaceId: z.cuid2(),
});

export type TEmailCampaignTemplatesGetFilter = z.infer<typeof ZEmailCampaignTemplatesGetFilter>;

export const ZEmailCampaignTemplateApiCreateInput = ZEmailCampaignTemplateCreateInput;

export type TEmailCampaignTemplateApiCreateInput = z.infer<typeof ZEmailCampaignTemplateApiCreateInput>;
