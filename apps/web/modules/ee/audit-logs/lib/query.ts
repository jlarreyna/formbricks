import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";

export const ACCESS_ACTIONS = [
  "signedIn",
  "authenticationSucceeded",
  "authenticationAttempted",
  "userSignedOut",
  "twoFactorVerified",
  "twoFactorAttempted",
  "twoFactorRequired",
  "passwordVerified",
  "emailVerified",
] as const;

export const MODIFICATION_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "merged",
  "createdFromCSV",
  "copiedToOtherWorkspace",
  "bulkCreated",
  "createdUpdated",
] as const;

export type TAuditLogListFilters = {
  organizationId: string;
  actorId?: string;
  action?: string;
  targetType?: string;
  actions?: string[];
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
};

export type TAuditLogListItem = {
  id: string;
  createdAt: Date;
  actorId: string;
  actorType: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetId: string | null;
  targetType: string;
  status: string;
  ipAddress: string | null;
  apiUrl: string | null;
  changes: Prisma.JsonValue | null;
};

export type TMemberLastLogin = {
  userId: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: Date | null;
};

export type TMemberLastLoginFilters = {
  organizationId: string;
  userId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
};

export type TPaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const normalizePagination = (page?: number, limit?: number) => {
  const pageSize = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const currentPage = Math.max(page ?? 1, 1);
  return {
    page: currentPage,
    pageSize,
    skip: (currentPage - 1) * pageSize,
  };
};

const buildAuditLogWhere = (filters: TAuditLogListFilters): Prisma.AuditLogWhereInput => ({
  organizationId: filters.organizationId,
  ...(filters.actorId ? { actorId: filters.actorId } : {}),
  ...(filters.action ? { action: filters.action } : {}),
  ...(filters.targetType ? { targetType: filters.targetType } : {}),
  ...(filters.actions?.length ? { action: { in: filters.actions } } : {}),
  ...(filters.from || filters.to
    ? {
        createdAt: {
          ...(filters.from ? { gte: filters.from } : {}),
          ...(filters.to ? { lte: filters.to } : {}),
        },
      }
    : {}),
});

export const getAuditLogs = async (
  filters: TAuditLogListFilters
): Promise<TPaginatedResult<TAuditLogListItem>> => {
  const { page, pageSize, skip } = normalizePagination(filters.page, filters.limit);
  const where = buildAuditLogWhere(filters);

  try {
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
      }),
    ]);

    const actorIds = [...new Set(rows.filter((row) => row.actorType === "user").map((row) => row.actorId))];
    const users =
      actorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userById = new Map(users.map((user) => [user.id, user]));

    const data: TAuditLogListItem[] = rows.map((row) => {
      const user = row.actorType === "user" ? userById.get(row.actorId) : undefined;
      return {
        id: row.id,
        createdAt: row.createdAt,
        actorId: row.actorId,
        actorType: row.actorType,
        actorName: user?.name ?? null,
        actorEmail: user?.email ?? null,
        action: row.action,
        targetId: row.targetId,
        targetType: row.targetType,
        status: row.status,
        ipAddress: row.ipAddress,
        apiUrl: row.apiUrl,
        changes: row.changes,
      };
    });

    return {
      data,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getOrganizationMembersLastLogin = async (
  filters: TMemberLastLoginFilters
): Promise<TPaginatedResult<TMemberLastLogin>> => {
  const { page, pageSize, skip } = normalizePagination(filters.page, filters.limit);

  const where: Prisma.MembershipWhereInput = {
    organizationId: filters.organizationId,
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.from || filters.to
      ? {
          user: {
            lastLoginAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          },
        }
      : {}),
  };

  try {
    const [total, memberships] = await Promise.all([
      prisma.membership.count({ where }),
      prisma.membership.findMany({
        where,
        select: {
          role: true,
          userId: true,
          user: {
            select: {
              name: true,
              email: true,
              lastLoginAt: true,
            },
          },
        },
        orderBy: {
          user: {
            lastLoginAt: "desc",
          },
        },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data: memberships.map((membership) => ({
        userId: membership.userId,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
        lastLoginAt: membership.user.lastLoginAt,
      })),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export type TAuditMemberOption = {
  userId: string;
  name: string;
  email: string;
};

/** Lightweight member list for the filter dropdown (not the data grid). */
export const getOrganizationAuditMemberOptions = async (
  organizationId: string
): Promise<TAuditMemberOption[]> => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { organizationId },
      select: {
        userId: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
      take: 500,
    });

    return memberships.map((membership) => ({
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
    }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getAuditLogsForExport = async (
  filters: Omit<TAuditLogListFilters, "page" | "limit">
): Promise<TAuditLogListItem[]> => {
  const all: TAuditLogListItem[] = [];
  let page = 1;

  // Cap export batches to avoid unbounded memory use.
  for (let i = 0; i < 40; i++) {
    const result = await getAuditLogs({
      ...filters,
      page,
      limit: 250,
    });
    all.push(...result.data);
    if (page >= result.pageCount) break;
    page += 1;
  }

  return all;
};
