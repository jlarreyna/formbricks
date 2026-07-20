import { describe, expect, test } from "vitest";
import { parseEmailCampaignCsv } from "./csv";

describe("parseEmailCampaignCsv", () => {
  test("parses recipients with a plain email column", () => {
    const csv = "email\nalice@example.com\nbob@example.com";

    const result = parseEmailCampaignCsv(csv, []);

    expect(result.recipients).toEqual([
      { email: "alice@example.com", hiddenFields: undefined, variables: undefined },
      { email: "bob@example.com", hiddenFields: undefined, variables: undefined },
    ]);
    expect(result.skippedRows).toEqual([]);
    expect(result.variableColumns).toEqual([]);
  });

  test("captures all columns as variables and mirrors hidden field ids", () => {
    const csv = "email,userId,plan\nalice@example.com,123,pro";

    const result = parseEmailCampaignCsv(csv, ["userId"]);

    expect(result.recipients).toEqual([
      {
        email: "alice@example.com",
        variables: { userId: "123", plan: "pro" },
        hiddenFields: { userId: "123" },
      },
    ]);
    expect(result.variableColumns).toEqual(["userId", "plan"]);
  });

  test("matches the email column case-insensitively and via known aliases", () => {
    const csv = "E-Mail\nalice@example.com";

    const result = parseEmailCampaignCsv(csv, []);

    expect(result.recipients).toEqual([
      { email: "alice@example.com", hiddenFields: undefined, variables: undefined },
    ]);
  });

  test("skips rows missing an email value", () => {
    const csv = "email,userId\n,123\nbob@example.com,456";

    const result = parseEmailCampaignCsv(csv, ["userId"]);

    expect(result.recipients).toEqual([
      {
        email: "bob@example.com",
        variables: { userId: "456" },
        hiddenFields: { userId: "456" },
      },
    ]);
    expect(result.skippedRows).toEqual([{ row: 1, reason: "missing_email" }]);
  });

  test("skips rows with an invalid email value", () => {
    const csv = "email\nnot-an-email\nbob@example.com";

    const result = parseEmailCampaignCsv(csv, []);

    expect(result.recipients).toEqual([
      { email: "bob@example.com", hiddenFields: undefined, variables: undefined },
    ]);
    expect(result.skippedRows).toEqual([{ row: 1, reason: "invalid_email" }]);
  });

  test("is case-insensitive when matching hidden field id columns", () => {
    const csv = "email,UserId\nalice@example.com,123";

    const result = parseEmailCampaignCsv(csv, ["userId"]);

    expect(result.recipients).toEqual([
      {
        email: "alice@example.com",
        variables: { UserId: "123" },
        hiddenFields: { userId: "123" },
      },
    ]);
  });
});
