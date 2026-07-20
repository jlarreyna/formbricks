import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { type TAuditLogEvent } from "@/modules/ee/audit-logs/types/audit-log";

/**
 * Persists an audit event to Postgres. Fail-soft: never throws to callers.
 */
export const persistAuditLogEvent = async (event: TAuditLogEvent): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: event.organizationId,
        actorId: event.actor.id,
        actorType: event.actor.type,
        action: event.action,
        targetId: event.target.id ?? null,
        targetType: event.target.type,
        status: event.status,
        ipAddress: event.ipAddress ?? null,
        apiUrl: event.apiUrl ?? null,
        eventId: event.eventId ?? null,
        changes: event.changes === undefined ? Prisma.JsonNull : (event.changes as Prisma.InputJsonValue),
        createdAt: new Date(event.timestamp),
      },
    });
  } catch (error) {
    logger.error(error, "Failed to persist audit event to database");
  }
};
