import {
  CONTACTABILITY_REASONS,
  CONTACTABILITY_RULE_NAMES,
  type TContactabilityContext,
  type TContactabilityRuleResult,
} from "@formbricks/types/contactability";
import type { ContactabilityRule } from "../types";

export class FatigueScoreRule implements ContactabilityRule {
  readonly name = CONTACTABILITY_RULE_NAMES.FATIGUE;

  evaluate(ctx: TContactabilityContext): TContactabilityRuleResult {
    const { fatigueScore } = ctx.rules;

    if (!fatigueScore.enabled) {
      return { allowed: true, reason: null, matched: false, ruleName: this.name };
    }

    if (ctx.contact.fatigueScore > fatigueScore.maxScore) {
      return {
        allowed: false,
        reason: CONTACTABILITY_REASONS.FATIGUE,
        matched: true,
        ruleName: this.name,
      };
    }

    return { allowed: true, reason: null, matched: true, ruleName: this.name };
  }
}
