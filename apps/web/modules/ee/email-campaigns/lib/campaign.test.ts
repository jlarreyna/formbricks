import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { removeBackgroundJob, scheduleEmailCampaignDispatchJobAt } from "@formbricks/jobs";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getSurvey } from "@/lib/survey/service";
import {
  cancelEmailCampaign,
  createEmailCampaign,
  rescheduleEmailCampaign,
} from "@/modules/ee/email-campaigns/lib/campaign";
import { resolveContactIdsByEmail } from "@/modules/ee/email-campaigns/lib/contacts";
import { resolveCampaignHtmlTemplate } from "@/modules/ee/email-campaigns/lib/templates";

vi.mock("@formbricks/database", () => ({
  prisma: {
    emailCampaign: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    emailCampaignRecipient: {
      createManyAndReturn: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/jobs", () => ({
  enqueueEmailCampaignRecipientJob: vi.fn(),
  removeBackgroundJob: vi.fn(),
  scheduleEmailCampaignDispatchJobAt: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/modules/email", () => ({
  IS_SMTP_CONFIGURED: true,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/modules/ee/email-campaigns/lib/templates", () => ({
  resolveCampaignHtmlTemplate: vi.fn(),
}));

vi.mock("@/modules/ee/email-campaigns/lib/contacts", () => ({
  resolveContactIdsByEmail: vi.fn(),
}));

vi.mock("@/modules/ee/email-campaigns/lib/deliver", () => ({
  deliverEmailCampaignRecipientOrFail: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/contacts", () => ({
  getContact: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/contact-attributes", () => ({
  getContactAttributes: vi.fn(),
}));

const WORKSPACE_ID = "cm8cmp9hp000008jf7l570ml2";
const SURVEY_ID = "cm8ckvchx000008lb710n0gdn";
const CAMPAIGN_ID = "cm8cmpnjj000108jfdr9dfqe6";

const buildSurvey = (): TSurvey =>
  ({
    id: SURVEY_ID,
    name: "Test survey",
    workspaceId: WORKSPACE_ID,
    hiddenFields: { enabled: false, fieldIds: [] },
  }) as unknown as TSurvey;

const buildCampaignRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: CAMPAIGN_ID,
  name: "Test campaign",
  subject: "Hello",
  mode: "embed" as const,
  status: "processing" as const,
  source: "ui" as const,
  totalRecipients: 1,
  sentCount: 0,
  failedCount: 0,
  skippedCount: 0,
  scheduledAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("createEmailCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSurvey).mockResolvedValue(buildSurvey());
    vi.mocked(resolveCampaignHtmlTemplate).mockResolvedValue({ html: "<p>hi</p>", templateId: null });
    vi.mocked(resolveContactIdsByEmail).mockResolvedValue(new Map());
    vi.mocked(prisma.emailCampaignRecipient.createManyAndReturn).mockResolvedValue([
      { id: "recipient-1" },
    ] as any);
  });

  const baseInput = {
    workspaceId: WORKSPACE_ID,
    surveyId: SURVEY_ID,
    mode: "embed" as const,
    subject: "Hello",
    recipients: [{ email: "person@example.com" }],
    source: "ui" as const,
  };

  test("rejects a scheduledAt that is not far enough in the future", async () => {
    const result = await createEmailCampaign({
      ...baseInput,
      scheduledAt: new Date(Date.now() + 1_000),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("bad_request");
      expect(result.error.details?.[0]?.field).toBe("scheduledAt");
    }
    expect(prisma.emailCampaign.create).not.toHaveBeenCalled();
  });

  test("rejects a scheduledAt that is in the past", async () => {
    const result = await createEmailCampaign({
      ...baseInput,
      scheduledAt: new Date(Date.now() - 60_000),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.[0]?.field).toBe("scheduledAt");
    }
  });

  test("rejects scheduledAt combined with a synchronous transactional send", async () => {
    const result = await createEmailCampaign({
      ...baseInput,
      deliverSynchronously: true,
      scheduledAt: new Date(Date.now() + 10 * 60_000),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("bad_request");
      expect(result.error.details?.[0]?.field).toBe("scheduledAt");
    }
    expect(prisma.emailCampaign.create).not.toHaveBeenCalled();
  });

  test("creates a scheduled campaign, schedules the dispatch job, and does not enqueue recipients", async () => {
    const scheduledAt = new Date(Date.now() + 10 * 60_000);
    vi.mocked(prisma.emailCampaign.create).mockResolvedValue(
      buildCampaignRow({ status: "scheduled", scheduledAt }) as any
    );
    vi.mocked(scheduleEmailCampaignDispatchJobAt).mockResolvedValue({ id: "job-1" } as any);

    const result = await createEmailCampaign({ ...baseInput, scheduledAt });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("scheduled");
      expect(result.data.scheduledAt).toEqual(scheduledAt);
    }

    expect(prisma.emailCampaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "scheduled", scheduledAt }),
      })
    );
    expect(scheduleEmailCampaignDispatchJobAt).toHaveBeenCalledWith(
      { runAt: scheduledAt },
      { campaignId: CAMPAIGN_ID }
    );
    expect(prisma.emailCampaign.update).toHaveBeenCalledWith({
      where: { id: CAMPAIGN_ID },
      data: { dispatchJobId: "job-1" },
    });

    const { enqueueEmailCampaignRecipientJob } = await import("@formbricks/jobs");
    expect(enqueueEmailCampaignRecipientJob).not.toHaveBeenCalled();
  });

  test("sends immediately and enqueues recipients when no scheduledAt is provided", async () => {
    vi.mocked(prisma.emailCampaign.create).mockResolvedValue(buildCampaignRow() as any);

    const result = await createEmailCampaign(baseInput);

    expect(result.ok).toBe(true);
    expect(scheduleEmailCampaignDispatchJobAt).not.toHaveBeenCalled();

    const { enqueueEmailCampaignRecipientJob } = await import("@formbricks/jobs");
    expect(enqueueEmailCampaignRecipientJob).toHaveBeenCalledWith({
      campaignId: CAMPAIGN_ID,
      recipientId: "recipient-1",
    });
  });
});

describe("cancelEmailCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns not_found when the campaign does not exist", async () => {
    vi.mocked(prisma.emailCampaign.findFirst).mockResolvedValue(null as any);

    const result = await cancelEmailCampaign(CAMPAIGN_ID, WORKSPACE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("not_found");
    }
  });

  test("rejects canceling a campaign that is not scheduled", async () => {
    vi.mocked(prisma.emailCampaign.findFirst).mockResolvedValue({
      id: CAMPAIGN_ID,
      status: "processing",
      dispatchJobId: null,
    } as any);

    const result = await cancelEmailCampaign(CAMPAIGN_ID, WORKSPACE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("bad_request");
    }
    expect(removeBackgroundJob).not.toHaveBeenCalled();
    expect(prisma.emailCampaign.update).not.toHaveBeenCalled();
  });

  test("removes the dispatch job and marks a scheduled campaign as canceled", async () => {
    vi.mocked(prisma.emailCampaign.findFirst).mockResolvedValue({
      id: CAMPAIGN_ID,
      status: "scheduled",
      dispatchJobId: "job-1",
    } as any);
    vi.mocked(prisma.emailCampaign.update).mockResolvedValue({
      ...buildCampaignRow({ status: "canceled" }),
      survey: { id: SURVEY_ID, name: "Test survey" },
    } as any);

    const result = await cancelEmailCampaign(CAMPAIGN_ID, WORKSPACE_ID);

    expect(removeBackgroundJob).toHaveBeenCalledWith("job-1");
    expect(prisma.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CAMPAIGN_ID },
        data: { status: "canceled", dispatchJobId: null },
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("canceled");
    }
  });
});

describe("rescheduleEmailCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects a new scheduledAt that is not in the future", async () => {
    const result = await rescheduleEmailCampaign(CAMPAIGN_ID, WORKSPACE_ID, new Date(Date.now() - 1_000));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.[0]?.field).toBe("scheduledAt");
    }
    expect(prisma.emailCampaign.findFirst).not.toHaveBeenCalled();
  });

  test("returns not_found when the campaign does not exist", async () => {
    vi.mocked(prisma.emailCampaign.findFirst).mockResolvedValue(null as any);

    const result = await rescheduleEmailCampaign(
      CAMPAIGN_ID,
      WORKSPACE_ID,
      new Date(Date.now() + 10 * 60_000)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("not_found");
    }
  });

  test("rejects rescheduling a campaign that is not scheduled", async () => {
    vi.mocked(prisma.emailCampaign.findFirst).mockResolvedValue({
      id: CAMPAIGN_ID,
      status: "completed",
      dispatchJobId: null,
    } as any);

    const result = await rescheduleEmailCampaign(
      CAMPAIGN_ID,
      WORKSPACE_ID,
      new Date(Date.now() + 10 * 60_000)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("bad_request");
    }
    expect(scheduleEmailCampaignDispatchJobAt).not.toHaveBeenCalled();
  });

  test("removes the old dispatch job and schedules a new one for a scheduled campaign", async () => {
    const newScheduledAt = new Date(Date.now() + 20 * 60_000);
    vi.mocked(prisma.emailCampaign.findFirst).mockResolvedValue({
      id: CAMPAIGN_ID,
      status: "scheduled",
      dispatchJobId: "old-job",
    } as any);
    vi.mocked(scheduleEmailCampaignDispatchJobAt).mockResolvedValue({ id: "new-job" } as any);
    vi.mocked(prisma.emailCampaign.update).mockResolvedValue({
      ...buildCampaignRow({ status: "scheduled", scheduledAt: newScheduledAt }),
      survey: { id: SURVEY_ID, name: "Test survey" },
    } as any);

    const result = await rescheduleEmailCampaign(CAMPAIGN_ID, WORKSPACE_ID, newScheduledAt);

    expect(removeBackgroundJob).toHaveBeenCalledWith("old-job");
    expect(scheduleEmailCampaignDispatchJobAt).toHaveBeenCalledWith(
      { runAt: newScheduledAt },
      { campaignId: CAMPAIGN_ID }
    );
    expect(prisma.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CAMPAIGN_ID },
        data: { scheduledAt: newScheduledAt, dispatchJobId: "new-job" },
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.scheduledAt).toEqual(newScheduledAt);
    }
  });
});
