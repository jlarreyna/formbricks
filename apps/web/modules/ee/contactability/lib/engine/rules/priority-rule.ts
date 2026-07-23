import {
  CONTACTABILITY_REASONS,
  CONTACTABILITY_RULE_NAMES,
  type TContactabilityContext,
  type TContactabilityRuleResult,
} from "@formbricks/types/contactability";
import type { ContactabilityRule } from "../types";

export class PriorityRule implements ContactabilityRule {
  readonly name = CONTACTABILITY_RULE_NAMES.PRIORITY;

  evaluate(ctx: TContactabilityContext): TContactabilityRuleResult {
    const competing = ctx.competingSurveys ?? [];

    if (competing.length === 0) {
      return { allowed: true, reason: null, matched: false, ruleName: this.name };
    }

    const surveyPriority = ctx.survey.priority;
    const hasHigherPriority = competing.some(
      (other) => other.surveyId !== ctx.survey.id && other.priority > surveyPriority
    );

    if (hasHigherPriority) {
      return {
        allowed: false,
        reason: CONTACTABILITY_REASONS.PRIORITY,
        matched: true,
        ruleName: this.name,
      };
    }

    return { allowed: true, reason: null, matched: true, ruleName: this.name };
  }
}
