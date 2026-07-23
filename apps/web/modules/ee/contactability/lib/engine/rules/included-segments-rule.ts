import {
  CONTACTABILITY_REASONS,
  CONTACTABILITY_RULE_NAMES,
  type TContactabilityContext,
  type TContactabilityRuleResult,
} from "@formbricks/types/contactability";
import type { ContactabilityRule, SegmentEvaluator } from "../types";

export class IncludedSegmentsRule implements ContactabilityRule {
  readonly name = CONTACTABILITY_RULE_NAMES.INCLUDED_SEGMENT;

  constructor(private readonly evaluateFilters: SegmentEvaluator) {}

  async evaluate(ctx: TContactabilityContext): Promise<TContactabilityRuleResult> {
    const { includedSegments } = ctx.rules;

    if (!includedSegments.enabled || includedSegments.filters.length === 0) {
      return { allowed: true, reason: null, matched: false, ruleName: this.name };
    }

    const matches = await this.evaluateFilters(
      ctx.attributes,
      includedSegments.filters,
      ctx.contact,
      ctx.deviceType
    );

    if (!matches) {
      return {
        allowed: false,
        reason: CONTACTABILITY_REASONS.INCLUDED_SEGMENT,
        matched: true,
        ruleName: this.name,
      };
    }

    return { allowed: true, reason: null, matched: true, ruleName: this.name };
  }
}
