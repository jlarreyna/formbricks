import {
  CONTACTABILITY_REASONS,
  CONTACTABILITY_RULE_NAMES,
  type TContactabilityContext,
  type TContactabilityRuleResult,
} from "@formbricks/types/contactability";
import type { ContactabilityRule } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

const countInWindow = (
  history: TContactabilityContext["invitationHistory"],
  now: Date,
  windowMs: number
): number => {
  const cutoff = now.getTime() - windowMs;
  return history.filter((invitation) => invitation.sentAt.getTime() >= cutoff).length;
};

export class FrequencyLimitsRule implements ContactabilityRule {
  readonly name = CONTACTABILITY_RULE_NAMES.FREQUENCY;

  evaluate(ctx: TContactabilityContext): TContactabilityRuleResult {
    const { frequencyLimits } = ctx.rules;

    if (!frequencyLimits.enabled) {
      return { allowed: true, reason: null, matched: false, ruleName: this.name };
    }

    const checks: Array<{ limit: number | null; windowMs: number; reason: string }> = [
      { limit: frequencyLimits.perDay, windowMs: DAY_MS, reason: CONTACTABILITY_REASONS.FREQUENCY_DAY },
      {
        limit: frequencyLimits.perWeek,
        windowMs: 7 * DAY_MS,
        reason: CONTACTABILITY_REASONS.FREQUENCY_WEEK,
      },
      {
        limit: frequencyLimits.perMonth,
        windowMs: 30 * DAY_MS,
        reason: CONTACTABILITY_REASONS.FREQUENCY_MONTH,
      },
      {
        limit: frequencyLimits.perYear,
        windowMs: 365 * DAY_MS,
        reason: CONTACTABILITY_REASONS.FREQUENCY_YEAR,
      },
    ];

    let anyLimitConfigured = false;

    for (const check of checks) {
      if (check.limit === null) {
        continue;
      }
      anyLimitConfigured = true;
      const count = countInWindow(ctx.invitationHistory, ctx.now, check.windowMs);
      if (count >= check.limit) {
        return {
          allowed: false,
          reason: check.reason,
          matched: true,
          ruleName: this.name,
        };
      }
    }

    return {
      allowed: true,
      reason: null,
      matched: anyLimitConfigured,
      ruleName: this.name,
    };
  }
}
