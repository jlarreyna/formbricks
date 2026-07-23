"use client";

import { type Dispatch, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import type { TBaseFilter, TSegment } from "@formbricks/types/segment";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { AddFilterModal } from "@/modules/ee/contacts/segments/components/add-filter-modal";
import { SegmentEditor } from "@/modules/ee/contacts/segments/components/segment-editor";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface AudienceSegmentSectionProps {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  segment: TSegment | null;
  setSegment: Dispatch<SetStateAction<TSegment | null>>;
  contactAttributeKeys: TContactAttributeKey[];
  segments: TSegment[];
}

export const AudienceSegmentSection = ({
  title,
  description,
  enabled,
  onEnabledChange,
  segment,
  setSegment,
  contactAttributeKeys,
  segments,
}: Readonly<AudienceSegmentSectionProps>) => {
  const { t } = useTranslation();
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);

  const handleAddFilterInGroup = (filter: TBaseFilter) => {
    const updatedSegment = structuredClone(segment);
    if (!updatedSegment) {
      return;
    }

    if (updatedSegment.filters.length === 0) {
      updatedSegment.filters.push({
        ...filter,
        connector: null,
      });
    } else {
      updatedSegment.filters.push(filter);
    }

    setSegment(updatedSegment);
  };

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-medium text-slate-800">{title}</Label>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && segment && (
        <div className="rounded-md border border-slate-100 bg-slate-50/50 p-3">
          {Boolean(segment.filters.length) && (
            <SegmentEditor
              group={segment.filters}
              segment={segment}
              segments={segments}
              contactAttributeKeys={contactAttributeKeys}
              setSegment={setSegment}
            />
          )}
          <div className={segment.filters.length ? "mt-3" : ""}>
            <Button onClick={() => setAddFilterModalOpen(true)} size="sm" variant="secondary">
              {t("common.add_filter")}
            </Button>
          </div>
          <AddFilterModal
            contactAttributeKeys={contactAttributeKeys}
            onAddFilter={handleAddFilterInGroup}
            open={addFilterModalOpen}
            segments={segments}
            setOpen={setAddFilterModalOpen}
          />
        </div>
      )}
    </section>
  );
};
