import { EyeIcon, GaugeIcon, MessageSquareTextIcon, SlidersHorizontalIcon, TagIcon } from "lucide-react";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getDisplaysByContactId } from "@/lib/display/service";
import { getResponsesByContactId } from "@/lib/response/service";
import { formatDate } from "@/lib/time";
import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { getContactAttributesWithKeyInfo } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { formatAttributeValue } from "@/modules/ee/contacts/lib/format-attribute-value";
import { getContactAttributeDataTypeIcon } from "@/modules/ee/contacts/utils";
import { Badge } from "@/modules/ui/components/badge";
import { IdBadge } from "@/modules/ui/components/id-badge";

const getFatigueScoreBadgeType = (fatigueScore: number): "success" | "warning" | "error" => {
  if (fatigueScore >= 70) return "error";
  if (fatigueScore >= 40) return "warning";
  return "success";
};

export const AttributesSection = async ({ contactId }: { contactId: string }) => {
  const t = await getTranslate();
  const [locale, contact, attributesWithKeyInfo] = await Promise.all([
    getLocale(),
    getContact(contactId),
    getContactAttributesWithKeyInfo(contactId),
  ]);

  if (!contact) {
    throw new ResourceNotFoundError(t("common.contact"), contactId);
  }

  const [responses, displays] = await Promise.all([
    getResponsesByContactId(contactId),
    getDisplaysByContactId(contactId),
  ]);
  const numberOfResponses = responses?.length || 0;
  const numberOfDisplays = displays?.length || 0;

  const systemAttributes = attributesWithKeyInfo
    .filter((attr) => attr.type === "default")
    .sort((a, b) => (a.name || a.key).localeCompare(b.name || b.key));

  const customAttributes = attributesWithKeyInfo
    .filter((attr) => attr.type === "custom")
    .sort((a, b) => (a.name || a.key).localeCompare(b.name || b.key));

  const renderAttributeValue = (attr: (typeof attributesWithKeyInfo)[number]) => {
    if (!attr.value) {
      return <span className="text-slate-300">{t("workspace.contacts.not_provided")}</span>;
    }

    // Special handling for userId to show IdBadge
    if (attr.key === "userId") {
      return <IdBadge id={attr.value} />;
    }

    return formatAttributeValue(attr.value, attr.dataType, locale);
  };

  const renderAttributeList = (attrs: typeof attributesWithKeyInfo) => (
    <dl className="divide-y divide-slate-100">
      {attrs.map((attr) => (
        <div key={attr.key} className="flex items-start justify-between gap-4 px-5 py-3">
          <dt className="flex items-center gap-2 text-sm text-slate-500">
            <span className="text-slate-400">{getContactAttributeDataTypeIcon(attr.dataType)}</span>
            <span>{attr.name || attr.key}</span>
          </dt>
          <dd className="ph-no-capture max-w-[60%] text-right text-sm font-medium break-words text-slate-800">
            {renderAttributeValue(attr)}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <dl>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-sm text-slate-500">{t("common.id")}</dt>
            <dd className="ph-no-capture">
              <IdBadge id={contact.id} copyDisabled={false} />
            </dd>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <dt className="text-sm text-slate-500">{t("common.created_at")}</dt>
            <dd className="text-sm font-medium text-slate-800">{formatDate(contact.createdAt, locale)}</dd>
          </div>
        </dl>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <dt className="flex items-center gap-2 text-sm text-slate-500">
            <GaugeIcon className="size-4 text-slate-400" />
            <span>{t("workspace.contacts.fatigue_score")}</span>
          </dt>
          <dd>
            <Badge
              type={getFatigueScoreBadgeType(contact.fatigueScore)}
              size="tiny"
              text={`${Math.round(contact.fatigueScore)} / 100`}
            />
          </dd>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-3">
            <MessageSquareTextIcon className="size-4 text-slate-400" />
            <span className="text-lg font-semibold text-slate-800">{numberOfResponses}</span>
            <span className="text-xs text-slate-500">{t("common.responses")}</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-3">
            <EyeIcon className="size-4 text-slate-400" />
            <span className="text-lg font-semibold text-slate-800">{numberOfDisplays}</span>
            <span className="text-xs text-slate-500">{t("workspace.contacts.displays")}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
        <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
          <TagIcon className="size-4 text-slate-400" />
          {t("workspace.contacts.system_attributes")}
        </h2>
        {renderAttributeList(systemAttributes)}
      </div>

      {customAttributes.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            <SlidersHorizontalIcon className="size-4 text-slate-400" />
            {t("workspace.contacts.custom_attributes")}
          </h2>
          {renderAttributeList(customAttributes)}
        </div>
      )}
    </div>
  );
};
