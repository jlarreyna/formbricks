import {
  DEFAULT_CONTACTABILITY_RULES,
  DEFAULT_SURVEY_AUDIENCE_FILTERS,
  type TContactabilityRules,
  type TResolvedContactabilityConfig,
  type TSurveyAudienceFilters,
  ZContactabilityRules,
  ZSurveyAudienceFilters,
} from "@formbricks/types/contactability";

export const parseContactabilityRules = (
  value: unknown,
  fallbackRecontactDays?: number
): TContactabilityRules => {
  const parsed = ZContactabilityRules.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  if (typeof fallbackRecontactDays === "number") {
    return {
      ...DEFAULT_CONTACTABILITY_RULES,
      cooldown: {
        enabled: fallbackRecontactDays > 0,
        period: fallbackRecontactDays,
        unit: "days",
      },
    };
  }

  return DEFAULT_CONTACTABILITY_RULES;
};

export const parseSurveyAudienceFilters = (value: unknown): TSurveyAudienceFilters => {
  const parsed = ZSurveyAudienceFilters.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return DEFAULT_SURVEY_AUDIENCE_FILTERS;
};

export const resolveContactabilityConfig = ({
  workspaceRules,
  recontactDays,
  audienceFilters,
  priority,
}: {
  workspaceRules: unknown;
  recontactDays?: number;
  audienceFilters: unknown;
  priority: number;
}): TResolvedContactabilityConfig => {
  const contactability = parseContactabilityRules(workspaceRules, recontactDays);
  const audience = parseSurveyAudienceFilters(audienceFilters);

  return {
    cooldown: contactability.cooldown,
    frequencyLimits: contactability.frequencyLimits,
    fatigueScore: contactability.fatigueScore,
    includedSegments: audience.includedSegments,
    excludedSegments: audience.excludedSegments,
    priority,
  };
};
