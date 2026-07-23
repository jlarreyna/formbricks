"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZContactabilityRules } from "@formbricks/types/contactability";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getWorkspace } from "@/lib/workspace/service";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { updateWorkspace } from "@/modules/workspaces/settings/lib/workspace";

const ZUpdateContactabilityRulesAction = z.object({
  workspaceId: ZId,
  data: ZContactabilityRules,
  recontactDays: z.number().int().min(0).max(365),
});

export const updateContactabilityRulesAction = authenticatedActionClient
  .inputSchema(ZUpdateContactabilityRulesAction)
  .action(
    withAuditLogging("updated", "workspace", async ({ ctx, parsedInput }) => {
      const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            workspaceId: parsedInput.workspaceId,
            minPermission: "manage",
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = parsedInput.workspaceId;
      const oldObject = await getWorkspace(parsedInput.workspaceId);
      const result = await updateWorkspace(parsedInput.workspaceId, {
        contactabilityRules: parsedInput.data,
        recontactDays: parsedInput.recontactDays,
      });
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = result;

      return result;
    })
  );
