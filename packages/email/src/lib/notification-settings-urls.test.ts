import { describe, expect, test } from "vitest";
import { getAccountNotificationSettingsUrl } from "./notification-settings-urls";

describe("getAccountNotificationSettingsUrl", () => {
  test("builds alert unsubscribe URL under account settings", () => {
    expect(getAccountNotificationSettingsUrl("https://app.example.com", "alert", "survey_123")).toBe(
      "https://app.example.com/account/settings/notifications?type=alert&elementId=survey_123"
    );
  });

  test("builds organization unsubscribe URL under account settings", () => {
    expect(
      getAccountNotificationSettingsUrl("https://app.example.com/", "unsubscribedOrganizationIds", "org_456")
    ).toBe(
      "https://app.example.com/account/settings/notifications?type=unsubscribedOrganizationIds&elementId=org_456"
    );
  });

  test("does not use the legacy workspace notifications path", () => {
    const url = getAccountNotificationSettingsUrl("https://app.example.com", "alert", "survey_123");
    expect(url).not.toContain("/workspaces/");
    expect(url).not.toMatch(/\/workspaces\/[^/]+\/settings\/notifications/);
  });
});
