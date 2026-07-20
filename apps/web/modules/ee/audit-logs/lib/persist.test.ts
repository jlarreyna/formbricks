import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { persistAuditLogEvent } from "./persist";

const createMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock("@formbricks/database", () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: (...args: unknown[]) => loggerErrorMock(...args),
  },
}));

describe("persistAuditLogEvent", () => {
  beforeEach(() => {
    createMock.mockReset().mockResolvedValue({});
    loggerErrorMock.mockReset();
  });

  test("writes the audit event to the database", async () => {
    await persistAuditLogEvent({
      actor: { id: "user-1", type: "user" },
      action: "created",
      target: { id: "survey-1", type: "survey" },
      status: "success",
      timestamp: "2026-07-17T12:00:00.000Z",
      organizationId: "org-1",
      ipAddress: "127.0.0.1",
      changes: { name: "Survey" },
    });

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        actorId: "user-1",
        actorType: "user",
        action: "created",
        targetId: "survey-1",
        targetType: "survey",
        status: "success",
        ipAddress: "127.0.0.1",
        changes: { name: "Survey" },
      }),
    });
  });

  test("stores JsonNull when changes are undefined", async () => {
    await persistAuditLogEvent({
      actor: { id: "user-1", type: "user" },
      action: "signedIn",
      target: { id: "user-1", type: "user" },
      status: "success",
      timestamp: "2026-07-17T12:00:00.000Z",
      organizationId: "org-1",
    });

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changes: Prisma.JsonNull,
      }),
    });
  });

  test("does not throw when persistence fails", async () => {
    const error = new Error("db down");
    createMock.mockRejectedValueOnce(error);

    await expect(
      persistAuditLogEvent({
        actor: { id: "user-1", type: "user" },
        action: "created",
        target: { id: "survey-1", type: "survey" },
        status: "success",
        timestamp: "2026-07-17T12:00:00.000Z",
        organizationId: "org-1",
      })
    ).resolves.toBeUndefined();

    expect(loggerErrorMock).toHaveBeenCalledWith(error, "Failed to persist audit event to database");
  });
});
