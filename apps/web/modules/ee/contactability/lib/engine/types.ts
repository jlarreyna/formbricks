import type {
  TContactabilityContext,
  TContactabilityRuleName,
  TContactabilityRuleResult,
} from "@formbricks/types/contactability";
import type { TBaseFilters } from "@formbricks/types/segment";

export type SegmentEvaluator = (
  attributes: Record<string, string | number>,
  filters: TBaseFilters,
  contact: { id: string; userId?: string },
  deviceType?: "phone" | "desktop"
) => Promise<boolean> | boolean;

export interface ContactabilityRule {
  readonly name: TContactabilityRuleName;
  evaluate(ctx: TContactabilityContext): Promise<TContactabilityRuleResult> | TContactabilityRuleResult;
}
