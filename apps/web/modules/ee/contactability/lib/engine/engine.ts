import type {
  TContactabilityContext,
  TContactabilityDecision,
  TContactabilityRuleName,
} from "@formbricks/types/contactability";
import type { ContactabilityRule } from "./types";

/**
 * Extensible contactability engine using the Strategy pattern.
 * Rules are injectable and evaluated in the configured order; the first blocking rule wins.
 */
export class ContactabilityEngine {
  constructor(private readonly rules: ContactabilityRule[]) {}

  async evaluate(ctx: TContactabilityContext): Promise<TContactabilityDecision> {
    const matchedRules: TContactabilityRuleName[] = [];

    for (const rule of this.rules) {
      const result = await rule.evaluate(ctx);

      if (result.matched) {
        matchedRules.push(result.ruleName);
      }

      if (!result.allowed) {
        return {
          allowed: false,
          reason: result.reason,
          matchedRules,
        };
      }
    }

    return {
      allowed: true,
      reason: null,
      matchedRules,
    };
  }

  getRuleOrder(): TContactabilityRuleName[] {
    return this.rules.map((rule) => rule.name);
  }
}
