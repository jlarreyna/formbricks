import "server-only";
import { prisma } from "@formbricks/database";
import type { TContactabilityInvitation } from "@formbricks/types/contactability";
import { getContactAttributes } from "@/modules/ee/contacts/lib/contact-attributes";

const LOOKBACK_DAYS = 400;

export const loadContactInvitationHistory = async (
  contactId: string,
  workspaceId: string,
  now: Date = new Date()
): Promise<TContactabilityInvitation[]> => {
  const lookback = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const recipients = await prisma.emailCampaignRecipient.findMany({
    where: {
      contactId,
      status: "sent",
      sentAt: { gte: lookback },
      campaign: { workspaceId },
    },
    select: {
      sentAt: true,
      campaign: { select: { surveyId: true } },
    },
    orderBy: { sentAt: "desc" },
  });

  return recipients
    .filter((recipient): recipient is typeof recipient & { sentAt: Date } => recipient.sentAt !== null)
    .map((recipient) => ({
      surveyId: recipient.campaign.surveyId,
      sentAt: recipient.sentAt,
    }));
};

export const loadContactForContactability = async (contactId: string) => {
  const [contact, attributes] = await Promise.all([
    prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        fatigueScore: true,
        attributes: {
          where: { attributeKey: { key: "userId" } },
          select: { value: true },
          take: 1,
        },
      },
    }),
    getContactAttributes(contactId),
  ]);

  if (!contact) {
    return null;
  }

  return {
    id: contact.id,
    fatigueScore: contact.fatigueScore,
    userId: contact.attributes[0]?.value,
    attributes,
  };
};

export const loadCompetingSurveyPriorities = async (
  workspaceId: string,
  surveyId: string
): Promise<Array<{ surveyId: string; priority: number }>> => {
  const surveys = await prisma.survey.findMany({
    where: {
      workspaceId,
      status: "inProgress",
      id: { not: surveyId },
    },
    select: { id: true, priority: true },
  });

  return surveys.map((survey) => ({ surveyId: survey.id, priority: survey.priority }));
};
