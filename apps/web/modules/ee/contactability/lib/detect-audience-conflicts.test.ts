import { describe, expect, test } from "vitest";
import type { TBaseFilters } from "@formbricks/types/segment";
import { hasAudienceSegmentConflict } from "./detect-audience-conflicts";

const vipFilter = (id: string): TBaseFilters => [
  {
    id,
    connector: null,
    resource: {
      id: `${id}_attr`,
      root: { type: "attribute", contactAttributeKey: "vip" },
      qualifier: { operator: "equals" },
      value: "true",
    },
  },
];

describe("hasAudienceSegmentConflict", () => {
  test("detects identical VIP condition in included and excluded segments", () => {
    expect(hasAudienceSegmentConflict(vipFilter("inc"), vipFilter("exc"))).toBe(true);
  });

  test("returns false when filters do not overlap", () => {
    const included: TBaseFilters = vipFilter("inc");
    const excluded: TBaseFilters = [
      {
        id: "exc",
        connector: null,
        resource: {
          id: "exc_attr",
          root: { type: "attribute", contactAttributeKey: "country" },
          qualifier: { operator: "equals" },
          value: "US",
        },
      },
    ];
    expect(hasAudienceSegmentConflict(included, excluded)).toBe(false);
  });

  test("returns false when either side is empty", () => {
    expect(hasAudienceSegmentConflict(vipFilter("inc"), [])).toBe(false);
    expect(hasAudienceSegmentConflict([], vipFilter("exc"))).toBe(false);
  });
});
