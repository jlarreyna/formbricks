import { describe, expect, test } from "vitest";
import {
  getOrganizationSurveyIds,
  toggleOrganizationAutoSubscribe,
  toggleSurveyAlert,
} from "./notification-settings";

describe("toggleOrganizationAutoSubscribe", () => {
  test("unsubscribing adds org id and disables alerts for that org's surveys only", () => {
    const result = toggleOrganizationAutoSubscribe(
      {
        alert: {
          "survey-org-a-1": true,
          "survey-org-a-2": true,
          "survey-org-b-1": true,
        },
        unsubscribedOrganizationIds: [],
      },
      "org-a",
      ["survey-org-a-1", "survey-org-a-2"]
    );

    expect(result.unsubscribedOrganizationIds).toEqual(["org-a"]);
    expect(result.alert).toEqual({
      "survey-org-a-1": false,
      "survey-org-a-2": false,
      "survey-org-b-1": true,
    });
  });

  test("re-subscribing removes org id without re-enabling alerts", () => {
    const result = toggleOrganizationAutoSubscribe(
      {
        alert: {
          "survey-org-a-1": false,
          "survey-org-a-2": false,
        },
        unsubscribedOrganizationIds: ["org-a"],
      },
      "org-a",
      ["survey-org-a-1", "survey-org-a-2"]
    );

    expect(result.unsubscribedOrganizationIds).toEqual([]);
    expect(result.alert).toEqual({
      "survey-org-a-1": false,
      "survey-org-a-2": false,
    });
  });
});

describe("toggleSurveyAlert", () => {
  test("toggles a single survey alert", () => {
    expect(
      toggleSurveyAlert(
        {
          alert: { "survey-1": true },
          unsubscribedOrganizationIds: [],
        },
        "survey-1"
      ).alert["survey-1"]
    ).toBe(false);

    expect(
      toggleSurveyAlert(
        {
          alert: { "survey-1": false },
          unsubscribedOrganizationIds: [],
        },
        "survey-1"
      ).alert["survey-1"]
    ).toBe(true);
  });
});

describe("getOrganizationSurveyIds", () => {
  test("returns survey ids for the matching organization only", () => {
    const memberships = [
      {
        organization: {
          id: "org-a",
          workspaces: [{ surveys: [{ id: "s1" }, { id: "s2" }] }, { surveys: [{ id: "s3" }] }],
        },
      },
      {
        organization: {
          id: "org-b",
          workspaces: [{ surveys: [{ id: "s4" }] }],
        },
      },
    ];

    expect(getOrganizationSurveyIds(memberships, "org-a")).toEqual(["s1", "s2", "s3"]);
    expect(getOrganizationSurveyIds(memberships, "org-missing")).toEqual([]);
  });
});
