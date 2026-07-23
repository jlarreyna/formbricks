import "server-only";
import type { TContactabilityDecision } from "@formbricks/types/contactability";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TWorkspace } from "@formbricks/types/workspace";
import { createDefaultContactabilityEngine } from "./engine";
import {
  loadCompetingSurveyPriorities,
  loadContactForContactability,
  loadContactInvitationHistory,
} from "./load-history";
import { resolveContactabilityConfig } from "./resolve-config";

export const evaluateContactabilityForSend = async ({
  workspace,
  survey,
  contactId,
  now = new Date(),
  includeCompetingSurveys = false,
}: {
  workspace: TWorkspace;
  survey: Pick<TSurvey, "id" | "priority" | "audienceFilters">;
  contactId: string;
  now?: Date;
  includeCompetingSurveys?: boolean;
}): Promise<TContactabilityDecision> => {
  const contact = await loadContactForContactability(contactId);
  if (!contact) {
    return {
      allowed: false,
      reason: "Contact not found",
      matchedRules: [],
    };
  }

  const [invitationHistory, competingSurveys] = await Promise.all([
    loadContactInvitationHistory(contactId, workspace.id, now),
    includeCompetingSurveys
      ? loadCompetingSurveyPriorities(workspace.id, survey.id)
      : Promise.resolve([] as Array<{ surveyId: string; priority: number }>),
  ]);

  const rules = resolveContactabilityConfig({
    workspaceRules: workspace.contactabilityRules,
    recontactDays: workspace.recontactDays,
    audienceFilters: survey.audienceFilters,
    priority: survey.priority ?? 0,
  });

  const engine = createDefaultContactabilityEngine();

  return engine.evaluate({
    survey: { id: survey.id, priority: survey.priority ?? 0 },
    contact: {
      id: contact.id,
      fatigueScore: contact.fatigueScore,
      userId: contact.userId,
    },
    attributes: contact.attributes,
    invitationHistory,
    competingSurveys: [{ surveyId: survey.id, priority: survey.priority ?? 0 }, ...competingSurveys],
    now,
    rules,
  });
};
