import { describe, expect, test } from "vitest";
import { buildLegacyNotificationsRedirect } from "./legacy-notifications-redirect";

describe("buildLegacyNotificationsRedirect", () => {
  test("preserves alert unsubscribe query params", () => {
    expect(
      buildLegacyNotificationsRedirect({
        type: "alert",
        elementId: "survey_123",
      })
    ).toBe("/account/settings/notifications?type=alert&elementId=survey_123");
  });

  test("preserves organization unsubscribe query params", () => {
    expect(
      buildLegacyNotificationsRedirect({
        type: "unsubscribedOrganizationIds",
        elementId: "org_456",
      })
    ).toBe("/account/settings/notifications?type=unsubscribedOrganizationIds&elementId=org_456");
  });

  test("redirects without query when none provided", () => {
    expect(buildLegacyNotificationsRedirect({})).toBe("/account/settings/notifications");
  });
});
