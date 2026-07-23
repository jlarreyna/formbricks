import {
  CONTACTABILITY_REASONS,
  CONTACTABILITY_RULE_NAMES,
  type TContactabilityContext,
  type TContactabilityRuleResult,
  cooldownToMilliseconds,
} from "@formbricks/types/contactability";
import type { ContactabilityRule } from "../types";

export class CooldownRule implements ContactabilityRule {
  readonly name = CONTACTABILITY_RULE_NAMES.COOLDOWN;

  evaluate(ctx: TContactabilityContext): TContactabilityRuleResult {
    const { cooldown } = ctx.rules;

    if (!cooldown.enabled || cooldown.period <= 0) {
      return { allowed: true, reason: null, matched: false, ruleName: this.name };
    }

    const windowMs = cooldownToMilliseconds(cooldown.period, cooldown.unit);
    const cutoff = ctx.now.getTime() - windowMs;

    const hasRecentInvitation = ctx.invitationHistory.some(
      (invitation) => invitation.sentAt.getTime() >= cutoff
    );

    if (hasRecentInvitation) {
      return {
        allowed: false,
        reason: CONTACTABILITY_REASONS.COOLDOWN,
        matched: true,
        ruleName: this.name,
      };
    }

    return { allowed: true, reason: null, matched: true, ruleName: this.name };
  }
}
