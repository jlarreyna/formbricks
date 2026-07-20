import { prisma } from "@formbricks/database";

const EMAIL_ATTRIBUTE_KEY = "email";

const getOrCreateEmailAttributeKey = async (workspaceId: string): Promise<string> => {
  const existing = await prisma.contactAttributeKey.findFirst({
    where: { workspaceId, key: EMAIL_ATTRIBUTE_KEY },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  // Defensive fallback: every workspace is seeded with the default "email" attribute key, but
  // older/self-hosted workspaces created before that seed existed may be missing it.
  const created = await prisma.contactAttributeKey.create({
    data: {
      workspaceId,
      key: EMAIL_ATTRIBUTE_KEY,
      name: "Email",
      type: "default",
      isUnique: true,
    },
    select: { id: true },
  });

  return created.id;
};

/**
 * Resolves a contactId for every given email within a workspace, creating a bare contact
 * (with only the "email" attribute) for any email that doesn't already have one.
 *
 * Returns a map of (lowercase) email -> contactId.
 */
export const resolveContactIdsByEmail = async (
  workspaceId: string,
  emails: string[]
): Promise<Map<string, string>> => {
  const uniqueEmails = [...new Set(emails.map((email) => email.trim().toLowerCase()))];
  if (uniqueEmails.length === 0) {
    return new Map();
  }

  const emailAttributeKeyId = await getOrCreateEmailAttributeKey(workspaceId);

  const existingContacts = await prisma.contact.findMany({
    where: {
      workspaceId,
      attributes: {
        some: {
          attributeKeyId: emailAttributeKeyId,
          value: { in: uniqueEmails },
        },
      },
    },
    select: {
      id: true,
      attributes: {
        where: { attributeKeyId: emailAttributeKeyId },
        select: { value: true },
      },
    },
  });

  const emailToContactId = new Map<string, string>();
  for (const contact of existingContacts) {
    const emailValue = contact.attributes[0]?.value;
    if (emailValue) {
      emailToContactId.set(emailValue.toLowerCase(), contact.id);
    }
  }

  const missingEmails = uniqueEmails.filter((email) => !emailToContactId.has(email));

  for (const email of missingEmails) {
    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        attributes: {
          create: [{ attributeKeyId: emailAttributeKeyId, value: email }],
        },
      },
      select: { id: true },
    });
    emailToContactId.set(email, contact.id);
  }

  return emailToContactId;
};
