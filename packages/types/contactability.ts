import { z } from "zod";
import { type TBaseFilters, ZSegmentFilters } from "./segment";

export const ZCooldownUnit = z.enum(["hours", "days", "weeks", "months"]);
export type TCooldownUnit = z.infer<typeof ZCooldownUnit>;

export const ZCooldownRule = z.object({
  enabled: z.boolean(),
  period: z.number().int().min(0).max(3650),
  unit: ZCooldownUnit,
});
export type TCooldownRule = z.infer<typeof ZCooldownRule>;

export const ZFrequencyLimitsRule = z.object({
  enabled: z.boolean(),
  perDay: z.number().int().min(0).nullable(),
  perWeek: z.number().int().min(0).nullable(),
  perMonth: z.number().int().min(0).nullable(),
  perYear: z.number().int().min(0).nullable(),
});
export type TFrequencyLimitsRule = z.infer<typeof ZFrequencyLimitsRule>;

export const ZFatigueScoreRule = z.object({
  enabled: z.boolean(),
  maxScore: z.number().min(0).max(100),
});
export type TFatigueScoreRule = z.infer<typeof ZFatigueScoreRule>;

/** Workspace-level contactability rules (Cooldown, Frequency, Fatigue). */
export const ZContactabilityRules = z.object({
  cooldown: ZCooldownRule,
  frequencyLimits: ZFrequencyLimitsRule,
  fatigueScore: ZFatigueScoreRule,
});
export type TContactabilityRules = z.infer<typeof ZContactabilityRules>;

export const ZAudienceSegmentRule = z.object({
  enabled: z.boolean(),
  filters: ZSegmentFilters,
});
export type TAudienceSegmentRule = z.infer<typeof ZAudienceSegmentRule>;

/** Survey-level audience rules (Included/Excluded Segments). Priority is a separate Survey column. */
export const ZSurveyAudienceFilters = z.object({
  includedSegments: ZAudienceSegmentRule,
  excludedSegments: ZAudienceSegmentRule,
});
export type TSurveyAudienceFilters = z.infer<typeof ZSurveyAudienceFilters>;

export const DEFAULT_CONTACTABILITY_RULES: TContactabilityRules = {
  cooldown: { enabled: true, period: 7, unit: "days" },
  frequencyLimits: {
    enabled: false,
    perDay: null,
    perWeek: null,
    perMonth: null,
    perYear: null,
  },
  fatigueScore: { enabled: false, maxScore: 80 },
};

export const DEFAULT_SURVEY_AUDIENCE_FILTERS: TSurveyAudienceFilters = {
  includedSegments: { enabled: false, filters: [] },
  excludedSegments: { enabled: false, filters: [] },
};

export const CONTACTABILITY_REASONS = {
  COOLDOWN: "Cooldown period active",
  FREQUENCY_DAY: "Daily frequency exceeded",
  FREQUENCY_WEEK: "Weekly frequency exceeded",
  FREQUENCY_MONTH: "Monthly frequency exceeded",
  FREQUENCY_YEAR: "Yearly frequency exceeded",
  INCLUDED_SEGMENT: "Contact does not match included segments",
  EXCLUDED_SEGMENT: "Contact matches excluded segments",
  PRIORITY: "Higher priority survey eligible",
  FATIGUE: "Survey fatigue detected",
} as const;

export type TContactabilityReason = (typeof CONTACTABILITY_REASONS)[keyof typeof CONTACTABILITY_REASONS];

export const CONTACTABILITY_RULE_NAMES = {
  COOLDOWN: "Cooldown",
  FREQUENCY: "Frequency Limit",
  INCLUDED_SEGMENT: "Included Segment",
  EXCLUDED_SEGMENT: "Excluded Segment",
  PRIORITY: "Priority",
  FATIGUE: "Fatigue Score",
} as const;

export type TContactabilityRuleName =
  (typeof CONTACTABILITY_RULE_NAMES)[keyof typeof CONTACTABILITY_RULE_NAMES];

export interface TContactabilityInvitation {
  surveyId: string;
  sentAt: Date;
}

export interface TContactabilityCompetingSurvey {
  surveyId: string;
  priority: number;
}

export interface TResolvedContactabilityConfig {
  cooldown: TCooldownRule;
  frequencyLimits: TFrequencyLimitsRule;
  fatigueScore: TFatigueScoreRule;
  includedSegments: TAudienceSegmentRule;
  excludedSegments: TAudienceSegmentRule;
  priority: number;
}

export interface TContactabilityContext {
  survey: { id: string; priority: number };
  contact: { id: string; fatigueScore: number; userId?: string };
  attributes: Record<string, string | number>;
  invitationHistory: TContactabilityInvitation[];
  competingSurveys?: TContactabilityCompetingSurvey[];
  now: Date;
  rules: TResolvedContactabilityConfig;
  deviceType?: "phone" | "desktop";
}

export interface TContactabilityRuleResult {
  allowed: boolean;
  reason: string | null;
  matched: boolean;
  ruleName: TContactabilityRuleName;
}

export interface TContactabilityDecision {
  allowed: boolean;
  reason: string | null;
  matchedRules: TContactabilityRuleName[];
}

/** Convert a cooldown period+unit into milliseconds. */
export const cooldownToMilliseconds = (period: number, unit: TCooldownUnit): number => {
  const hourMs = 60 * 60 * 1000;
  switch (unit) {
    case "hours":
      return period * hourMs;
    case "days":
      return period * 24 * hourMs;
    case "weeks":
      return period * 7 * 24 * hourMs;
    case "months":
      return period * 30 * 24 * hourMs;
  }
};

/** Convert a cooldown period+unit into whole days (ceil), for syncing Workspace.recontactDays. */
export const cooldownToDays = (period: number, unit: TCooldownUnit): number => {
  const ms = cooldownToMilliseconds(period, unit);
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
};

export type { TBaseFilters };
