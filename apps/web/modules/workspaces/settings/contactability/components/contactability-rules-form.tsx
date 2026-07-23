"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ClockIcon, GaugeIcon, RepeatIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_CONTACTABILITY_RULES,
  type TContactabilityRules,
  type TCooldownUnit,
  ZContactabilityRules,
  cooldownToDays,
} from "@formbricks/types/contactability";
import { TWorkspace } from "@formbricks/types/workspace";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { parseContactabilityRules } from "@/modules/ee/contactability/lib/resolve-config";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Slider } from "@/modules/ui/components/slider";
import { updateContactabilityRulesAction } from "../actions";
import { RuleCard } from "./rule-card";

interface ContactabilityRulesFormProps {
  workspace: TWorkspace;
  isReadOnly: boolean;
}

const COOLDOWN_UNITS: TCooldownUnit[] = ["hours", "days", "weeks", "months"];

export const ContactabilityRulesForm = ({
  workspace,
  isReadOnly,
}: Readonly<ContactabilityRulesFormProps>) => {
  const { t } = useTranslation();
  const router = useRouter();

  const defaultValues = parseContactabilityRules(workspace.contactabilityRules, workspace.recontactDays);

  const form = useForm<TContactabilityRules>({
    defaultValues,
    resolver: zodResolver(ZContactabilityRules),
    mode: "onChange",
  });

  const { isDirty, isSubmitting } = form.formState;
  const fatigueMax = form.watch("fatigueScore.maxScore");

  const onSubmit: SubmitHandler<TContactabilityRules> = async (data) => {
    try {
      const recontactDays = data.cooldown.enabled
        ? Math.min(365, cooldownToDays(data.cooldown.period, data.cooldown.unit))
        : 0;

      const response = await updateContactabilityRulesAction({
        workspaceId: workspace.id,
        data,
        recontactDays,
      });

      if (response?.data) {
        toast.success(t("workspace.contactability.updated_successfully"));
        form.reset(data);
        router.refresh();
      } else {
        toast.error(getFormattedErrorMessage(response));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.something_went_wrong"));
    }
  };

  return (
    <FormProvider {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <RuleCard
          title={t("workspace.contactability.cooldown.title")}
          description={t("workspace.contactability.cooldown.description")}
          icon={<ClockIcon className="size-4" />}
          enabled={form.watch("cooldown.enabled")}
          onEnabledChange={(enabled) => form.setValue("cooldown.enabled", enabled, { shouldDirty: true })}
          disabled={isReadOnly}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="cooldown.period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("workspace.contactability.cooldown.period")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      disabled={isReadOnly || !form.watch("cooldown.enabled")}
                      {...field}
                      onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 0)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cooldown.unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("workspace.contactability.cooldown.unit")}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isReadOnly || !form.watch("cooldown.enabled")}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COOLDOWN_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {t(`workspace.contactability.cooldown.units.${unit}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
          <FormDescription className="mt-3">{t("workspace.contactability.cooldown.helper")}</FormDescription>
        </RuleCard>

        <RuleCard
          title={t("workspace.contactability.frequency.title")}
          description={t("workspace.contactability.frequency.description")}
          icon={<RepeatIcon className="size-4" />}
          enabled={form.watch("frequencyLimits.enabled")}
          onEnabledChange={(enabled) =>
            form.setValue("frequencyLimits.enabled", enabled, { shouldDirty: true })
          }
          disabled={isReadOnly}>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["perDay", "per_day"],
                ["perWeek", "per_week"],
                ["perMonth", "per_month"],
                ["perYear", "per_year"],
              ] as const
            ).map(([fieldName, labelKey]) => (
              <FormField
                key={fieldName}
                control={form.control}
                name={`frequencyLimits.${fieldName}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(`workspace.contactability.frequency.${labelKey}`)}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder={t("workspace.contactability.frequency.unlimited")}
                        disabled={isReadOnly || !form.watch("frequencyLimits.enabled")}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value === "" ? null : Number.parseInt(value, 10) || 0);
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
          </div>
          <FormDescription className="mt-3">{t("workspace.contactability.frequency.helper")}</FormDescription>
        </RuleCard>

        <RuleCard
          title={t("workspace.contactability.fatigue.title")}
          description={t("workspace.contactability.fatigue.description")}
          icon={<GaugeIcon className="size-4" />}
          enabled={form.watch("fatigueScore.enabled")}
          onEnabledChange={(enabled) => form.setValue("fatigueScore.enabled", enabled, { shouldDirty: true })}
          disabled={isReadOnly}>
          <FormField
            control={form.control}
            name="fatigueScore.maxScore"
            render={({ field }) => (
              <FormItem>
                <div className="mb-3 flex items-center justify-between">
                  <FormLabel>{t("workspace.contactability.fatigue.max_score")}</FormLabel>
                  <span className="text-sm font-medium text-slate-700">{fatigueMax}</span>
                </div>
                <FormControl>
                  <Slider
                    value={[field.value ?? DEFAULT_CONTACTABILITY_RULES.fatigueScore.maxScore]}
                    min={0}
                    max={100}
                    step={1}
                    disabled={isReadOnly || !form.watch("fatigueScore.enabled")}
                    onValueChange={(value) => field.onChange(value[0])}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Alert variant="info" className="mt-4">
            <AlertDescription>{t("workspace.contactability.fatigue.helper")}</AlertDescription>
          </Alert>
        </RuleCard>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            size="sm"
            loading={isSubmitting}
            disabled={isSubmitting || !isDirty || isReadOnly}>
            {t("common.save")}
          </Button>
        </div>

        {isReadOnly && (
          <Alert variant="warning">
            <AlertDescription>
              {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
            </AlertDescription>
          </Alert>
        )}
      </form>
    </FormProvider>
  );
};
