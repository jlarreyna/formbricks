"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon, UsersIcon } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import type { TBaseFilters, TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { hasAudienceSegmentConflict } from "@/modules/ee/contactability/lib/detect-audience-conflicts";
import { parseSurveyAudienceFilters } from "@/modules/ee/contactability/lib/resolve-config";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { AudienceSegmentSection } from "./audience-segment-section";

interface AudienceCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  contactAttributeKeys: TContactAttributeKey[];
  segments: TSegment[];
}

const createEphemeralSegment = (workspaceId: string, title: string, filters: TBaseFilters): TSegment => ({
  id: `audience_${title.toLowerCase().replace(/\s+/g, "_")}`,
  createdAt: new Date(),
  updatedAt: new Date(),
  title,
  description: null,
  isPrivate: true,
  filters,
  workspaceId,
  surveys: [],
});

export const AudienceCard = ({
  localSurvey,
  setLocalSurvey,
  contactAttributeKeys,
  segments,
}: Readonly<AudienceCardProps>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  // Parsed once on mount to seed local state. Deliberately NOT re-derived from `localSurvey`
  // on every change: re-validating the whole audience config against the zod schema on each
  // keystroke/click would silently fall back to the (disabled) defaults for any edit that is
  // momentarily in a shape the schema doesn't recognize, which visually collapses this section.
  // `enabled` and the segments below are kept as independent local state instead, and are the
  // single source of truth that gets written back into `localSurvey.audienceFilters`.
  const [initialAudienceFilters] = useState(() => parseSurveyAudienceFilters(localSurvey.audienceFilters));

  const [includedEnabled, setIncludedEnabled] = useState(initialAudienceFilters.includedSegments.enabled);
  const [excludedEnabled, setExcludedEnabled] = useState(initialAudienceFilters.excludedSegments.enabled);

  const [includedSegment, setIncludedSegment] = useState<TSegment | null>(() =>
    createEphemeralSegment(
      localSurvey.workspaceId,
      "Included",
      initialAudienceFilters.includedSegments.filters
    )
  );
  const [excludedSegment, setExcludedSegment] = useState<TSegment | null>(() =>
    createEphemeralSegment(
      localSurvey.workspaceId,
      "Excluded",
      initialAudienceFilters.excludedSegments.filters
    )
  );

  useEffect(() => {
    setLocalSurvey((prev) => ({
      ...prev,
      audienceFilters: {
        includedSegments: {
          enabled: includedEnabled,
          filters: includedSegment?.filters ?? [],
        },
        excludedSegments: {
          enabled: excludedEnabled,
          filters: excludedSegment?.filters ?? [],
        },
      },
    }));
  }, [includedEnabled, excludedEnabled, includedSegment?.filters, excludedSegment?.filters, setLocalSurvey]);

  const conflict = hasAudienceSegmentConflict(includedSegment?.filters ?? [], excludedSegment?.filters ?? []);

  const delayEnabled = localSurvey.delay !== 0;

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white"
      )}>
      <Collapsible.CollapsibleTrigger
        asChild
        className="w-full cursor-pointer rounded-t-lg hover:bg-slate-50">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pr-5 pl-2">
            <CheckIcon
              strokeWidth={3}
              className="size-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <UsersIcon className="size-4 text-slate-600" />
              <p className="font-semibold text-slate-800">{t("workspace.surveys.edit.audience.title")}</p>
            </div>
            <p className="mt-1 text-sm text-slate-500">{t("workspace.surveys.edit.audience.description")}</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent className="px-4 pb-4">
        <div className="space-y-6 pt-2">
          {conflict && (
            <Alert variant="warning">
              <AlertTitle>{t("workspace.surveys.edit.audience.conflict_title")}</AlertTitle>
              <AlertDescription>{t("workspace.surveys.edit.audience.conflict_description")}</AlertDescription>
            </Alert>
          )}

          <AudienceSegmentSection
            title={t("workspace.surveys.edit.audience.included_segments")}
            description={t("workspace.surveys.edit.audience.included_segments_description")}
            enabled={includedEnabled}
            onEnabledChange={setIncludedEnabled}
            segment={includedSegment}
            setSegment={setIncludedSegment}
            contactAttributeKeys={contactAttributeKeys}
            segments={segments}
          />

          <AudienceSegmentSection
            title={t("workspace.surveys.edit.audience.excluded_segments")}
            description={t("workspace.surveys.edit.audience.excluded_segments_description")}
            enabled={excludedEnabled}
            onEnabledChange={setExcludedEnabled}
            segment={excludedSegment}
            setSegment={setExcludedSegment}
            contactAttributeKeys={contactAttributeKeys}
            segments={segments}
          />

          <section className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div>
              <Label htmlFor="survey-priority" className="text-sm font-medium text-slate-800">
                {t("workspace.surveys.edit.audience.priority")}
              </Label>
              <p className="mt-1 text-xs text-slate-500">
                {t("workspace.surveys.edit.audience.priority_description")}
              </p>
            </div>
            <Input
              id="survey-priority"
              type="number"
              value={localSurvey.priority ?? 0}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10);
                setLocalSurvey((prev) => ({
                  ...prev,
                  priority: Number.isNaN(value) ? 0 : value,
                }));
              }}
              className="max-w-xs"
            />
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-medium text-slate-800">
                  {t("workspace.surveys.edit.audience.delay")}
                </Label>
                <p className="mt-1 text-xs text-slate-500">
                  {t("workspace.surveys.edit.audience.delay_description")}
                </p>
              </div>
              <Switch
                checked={delayEnabled}
                onCheckedChange={(checked) => {
                  setLocalSurvey((prev) => ({
                    ...prev,
                    delay: checked ? (prev.delay > 0 ? prev.delay : 5) : 0,
                  }));
                }}
              />
            </div>
            {delayEnabled && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={localSurvey.delay}
                  onChange={(e) => {
                    const value = Number.parseInt(e.target.value, 10);
                    setLocalSurvey((prev) => ({
                      ...prev,
                      delay: Number.isNaN(value) ? 0 : value,
                    }));
                  }}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-slate-500">
                  {t("workspace.surveys.edit.audience.delay_seconds")}
                </span>
              </div>
            )}
          </section>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
