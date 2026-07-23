"use client";

import { Maximize2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/modules/ui/components/dialog";
import { Label } from "@/modules/ui/components/label";

interface EmailTemplatePreviewProps {
  previewHtml: string;
}

export const EmailTemplatePreview = ({ previewHtml }: Readonly<EmailTemplatePreviewProps>) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{t("workspace.email_campaigns.preview_label")}</Label>
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={t("workspace.email_campaigns.preview_expand")}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50">
              <Maximize2Icon className="size-3.5" />
              {t("workspace.email_campaigns.preview_expand")}
            </button>
          </DialogTrigger>
          <DialogContent width="wide">
            <DialogHeader>
              <DialogTitle>{t("workspace.email_campaigns.preview_label")}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div
                className="max-h-[70dvh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </DialogBody>
          </DialogContent>
        </Dialog>
      </div>
      <div
        className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />
    </div>
  );
};
