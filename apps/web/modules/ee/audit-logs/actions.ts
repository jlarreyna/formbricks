"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { AUDIT_LOG_DB_ENABLED } from "@/lib/constants";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { convertToCsv, convertToXlsxBuffer } from "@/lib/utils/file-conversion";
import {
  ACCESS_ACTIONS,
  MODIFICATION_ACTIONS,
  getAuditLogs,
  getAuditLogsForExport,
  getOrganizationMembersLastLogin,
} from "@/modules/ee/audit-logs/lib/query";

const AUDIT_VIEWER_ROLES = ["owner", "manager", "auditor"] as const;

const ZAuditListFilters = z.object({
  organizationId: ZId,
  actorId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  section: z.enum(["all", "access", "activities", "modifications"]).optional(),
});

const assertAuditAccess = async (userId: string, organizationId: string) => {
  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      {
        type: "organization",
        roles: [...AUDIT_VIEWER_ROLES],
      },
    ],
  });
};

const sectionActions = (section?: "all" | "access" | "activities" | "modifications") => {
  if (section === "access") return [...ACCESS_ACTIONS];
  if (section === "modifications") return [...MODIFICATION_ACTIONS];
  // "all" and "activities" return every action; activities is the full activity stream.
  return undefined;
};

export const getAuditLogsAction = authenticatedActionClient
  .inputSchema(ZAuditListFilters)
  .action(async ({ ctx, parsedInput }) => {
    await assertAuditAccess(ctx.user.id, parsedInput.organizationId);

    if (!AUDIT_LOG_DB_ENABLED) {
      return {
        data: [],
        total: 0,
        page: 1,
        pageSize: parsedInput.limit ?? 25,
        pageCount: 1,
        dbEnabled: false as const,
      };
    }

    const result = await getAuditLogs({
      organizationId: parsedInput.organizationId,
      actorId: parsedInput.actorId,
      action: parsedInput.action,
      targetType: parsedInput.targetType,
      actions: sectionActions(parsedInput.section),
      from: parsedInput.from ? new Date(parsedInput.from) : undefined,
      to: parsedInput.to ? new Date(parsedInput.to) : undefined,
      page: parsedInput.page,
      limit: parsedInput.limit,
    });

    return {
      data: result.data.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        changes: row.changes ? JSON.stringify(row.changes) : null,
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pageCount: result.pageCount,
      dbEnabled: true as const,
    };
  });

const ZGetMembersLastLogin = z.object({
  organizationId: ZId,
  userId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const getMembersLastLoginAction = authenticatedActionClient
  .inputSchema(ZGetMembersLastLogin)
  .action(async ({ ctx, parsedInput }) => {
    await assertAuditAccess(ctx.user.id, parsedInput.organizationId);

    const result = await getOrganizationMembersLastLogin({
      organizationId: parsedInput.organizationId,
      userId: parsedInput.userId,
      from: parsedInput.from ? new Date(parsedInput.from) : undefined,
      to: parsedInput.to ? new Date(parsedInput.to) : undefined,
      page: parsedInput.page,
      limit: parsedInput.limit,
    });

    return {
      data: result.data.map((member) => ({
        ...member,
        lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pageCount: result.pageCount,
    };
  });

const ZExportAuditLogs = z.object({
  organizationId: ZId,
  format: z.enum(["csv", "xlsx"]),
  section: z.enum(["access", "activities", "modifications", "all"]).default("all"),
  actorId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const exportAuditLogsAction = authenticatedActionClient
  .inputSchema(ZExportAuditLogs)
  .action(async ({ ctx, parsedInput }) => {
    await assertAuditAccess(ctx.user.id, parsedInput.organizationId);

    if (!AUDIT_LOG_DB_ENABLED) {
      throw new Error("Database audit logging is not enabled");
    }

    const rows = await getAuditLogsForExport({
      organizationId: parsedInput.organizationId,
      actorId: parsedInput.actorId,
      actions:
        parsedInput.section === "all"
          ? undefined
          : sectionActions(parsedInput.section === "access" ? "access" : parsedInput.section),
      from: parsedInput.from ? new Date(parsedInput.from) : undefined,
      to: parsedInput.to ? new Date(parsedInput.to) : undefined,
    });

    const fields = [
      "timestamp",
      "actorId",
      "actorType",
      "actorName",
      "actorEmail",
      "action",
      "targetType",
      "targetId",
      "status",
      "ipAddress",
      "apiUrl",
      "changes",
    ];

    const jsonData = rows.map((row) => ({
      timestamp: row.createdAt.toISOString(),
      actorId: row.actorId,
      actorType: row.actorType,
      actorName: row.actorName ?? "",
      actorEmail: row.actorEmail ?? "",
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId ?? "",
      status: row.status,
      ipAddress: row.ipAddress ?? "",
      apiUrl: row.apiUrl ?? "",
      changes: row.changes ? JSON.stringify(row.changes) : "",
    }));

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (parsedInput.format === "csv") {
      const file = await convertToCsv(fields, jsonData);
      return {
        fileName: `audit-logs-${parsedInput.section}-${stamp}.csv`,
        mimeType: "text/csv",
        content: file,
      };
    }

    const buffer = convertToXlsxBuffer(fields, jsonData);
    return {
      fileName: `audit-logs-${parsedInput.section}-${stamp}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: Buffer.from(buffer).toString("base64"),
      encoding: "base64" as const,
    };
  });
