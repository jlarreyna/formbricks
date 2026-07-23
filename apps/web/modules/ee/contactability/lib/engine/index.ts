import type { TBaseFilters, TEvaluateSegmentUserData } from "@formbricks/types/segment";
import { evaluateSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { ContactabilityEngine } from "./engine";
import { CooldownRule } from "./rules/cooldown-rule";
import { ExcludedSegmentsRule } from "./rules/excluded-segments-rule";
import { FatigueScoreRule } from "./rules/fatigue-score-rule";
import { FrequencyLimitsRule } from "./rules/frequency-limits-rule";
import { IncludedSegmentsRule } from "./rules/included-segments-rule";
import { PriorityRule } from "./rules/priority-rule";
import type { ContactabilityRule, SegmentEvaluator } from "./types";

export { ContactabilityEngine } from "./engine";
export { CooldownRule } from "./rules/cooldown-rule";
export { ExcludedSegmentsRule } from "./rules/excluded-segments-rule";
export { FatigueScoreRule } from "./rules/fatigue-score-rule";
export { FrequencyLimitsRule } from "./rules/frequency-limits-rule";
export { IncludedSegmentsRule } from "./rules/included-segments-rule";
export { PriorityRule } from "./rules/priority-rule";
export type { ContactabilityRule, SegmentEvaluator } from "./types";

const defaultSegmentEvaluator: SegmentEvaluator = async (
  attributes,
  filters: TBaseFilters,
  contact,
  deviceType = "desktop"
) => {
  const userData: TEvaluateSegmentUserData = {
    contactId: contact.id,
    userId: contact.userId ?? "",
    attributes,
    deviceType,
  };
  return evaluateSegment(userData, filters);
};

/**
 * Creates the default contactability engine with the production rule order.
 * Rules can be swapped or reordered by constructing ContactabilityEngine directly.
 */
export const createDefaultContactabilityEngine = (
  evaluateFilters: SegmentEvaluator = defaultSegmentEvaluator
): ContactabilityEngine => {
  const rules: ContactabilityRule[] = [
    new CooldownRule(),
    new FrequencyLimitsRule(),
    new IncludedSegmentsRule(evaluateFilters),
    new ExcludedSegmentsRule(evaluateFilters),
    new PriorityRule(),
    new FatigueScoreRule(),
  ];

  return new ContactabilityEngine(rules);
};
