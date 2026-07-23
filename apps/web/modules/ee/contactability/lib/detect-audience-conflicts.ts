import type { TBaseFilters, TSegmentAttributeFilter, TSegmentFilter } from "@formbricks/types/segment";
import { isResourceFilter } from "@/modules/ee/contacts/segments/lib/utils";

interface AttributeConditionSignature {
  key: string;
  operator: string;
  value: string;
}

const serializeFilterValue = (value: TSegmentAttributeFilter["value"]): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
};

const collectAttributeConditions = (
  filters: TBaseFilters,
  acc: AttributeConditionSignature[] = []
): AttributeConditionSignature[] => {
  for (const item of filters) {
    const { resource } = item;
    if (isResourceFilter(resource)) {
      const filter = resource as TSegmentFilter;
      if (filter.root.type === "attribute") {
        const attributeFilter = filter as TSegmentAttributeFilter;
        acc.push({
          key: attributeFilter.root.contactAttributeKey,
          operator: attributeFilter.qualifier.operator,
          value: serializeFilterValue(attributeFilter.value),
        });
      }
    } else {
      collectAttributeConditions(resource, acc);
    }
  }
  return acc;
};

/**
 * Returns true when included and excluded segment filters contain the same
 * attribute key + operator + value condition (e.g. VIP equals true in both).
 */
export const hasAudienceSegmentConflict = (
  includedFilters: TBaseFilters,
  excludedFilters: TBaseFilters
): boolean => {
  if (!includedFilters.length || !excludedFilters.length) {
    return false;
  }

  const included = collectAttributeConditions(includedFilters);
  const excluded = collectAttributeConditions(excludedFilters);

  return included.some((inc) =>
    excluded.some((exc) => exc.key === inc.key && exc.operator === inc.operator && exc.value === inc.value)
  );
};
