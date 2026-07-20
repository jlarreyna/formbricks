"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, HashIcon, PlusIcon, TagIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createContactAction } from "@/modules/ee/contacts/actions";
import { AttributeFieldRow } from "@/modules/ee/contacts/components/attribute-field-row";
import { translateAttributeMessage } from "@/modules/ee/contacts/lib/attribute-messages";
import {
  TEditContactAttributesForm,
  createEditContactAttributesSchema,
} from "@/modules/ee/contacts/types/contact";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { FormError, FormProvider } from "@/modules/ui/components/form";

interface CreateContactButtonProps {
  workspaceId: string;
  contactAttributeKeys: TContactAttributeKey[];
}

// Prefill with an empty "email" row so the dialog isn't blank on open - email/userId is required
// by createEditContactAttributesSchema, and email is the most common contact identifier.
const defaultValues: TEditContactAttributesForm = {
  attributes: [{ key: "email", value: "" }],
};

// No attribute is "already saved" for a brand-new contact, so nothing should be locked.
const NO_SAVED_ATTRIBUTE_KEYS = new Set<string>();

const dataTypeIcons = {
  date: CalendarIcon,
  number: HashIcon,
  string: TagIcon,
} as const;

export const CreateContactButton = ({ workspaceId, contactAttributeKeys }: CreateContactButtonProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const dynamicSchema = useMemo(
    () => createEditContactAttributesSchema(contactAttributeKeys, t),
    [contactAttributeKeys, t]
  );

  const form = useForm<TEditContactAttributesForm>({
    resolver: zodResolver(dynamicSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attributes",
  });

  const watchedAttributes = form.watch("attributes");

  const allKeyOptions = contactAttributeKeys.map((attrKey) => ({
    icon: dataTypeIcons[attrKey.dataType] ?? TagIcon,
    label: attrKey.name ?? attrKey.key,
    value: attrKey.key,
  }));

  const getAvailableOptions = (currentIndex: number) => {
    const selectedKeys = new Set(
      watchedAttributes
        .map((attr, index) => (index !== currentIndex && attr.key ? String(attr.key) : null))
        .filter((key): key is string => key !== null && key !== "")
    );

    return allKeyOptions.filter((option) => !selectedKeys.has(option.value));
  };

  const resetForm = () => {
    form.reset(defaultValues);
  };

  const onSubmit = async (data: TEditContactAttributesForm) => {
    try {
      // HTML inputs always return strings, so number attributes need to be converted back.
      const attributes = data.attributes.reduce(
        (acc, { key, value }) => {
          const attrKey = contactAttributeKeys.find((ak) => ak.key === key);
          const dataType = attrKey?.dataType || "string";

          if (dataType === "number" && value !== "") {
            acc[key] = Number(value);
          } else {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, string | number>
      );

      const result = await createContactAction({ workspaceId, attributes });

      if (result?.data && "contact" in result.data) {
        toast.success(t("workspace.contacts.create_contact_success"));
        resetForm();
        setOpen(false);
        router.refresh();
        return;
      }

      if (result?.data && "messages" in result.data && result.data.messages) {
        result.data.messages.forEach((msg) => {
          toast.error(translateAttributeMessage(msg, t));
        });
        return;
      }

      toast.error(getFormattedErrorMessage(result));
    } catch (error) {
      toast.error(t("common.something_went_wrong"));
      console.error(error);
    }
  };

  const handleAddAttribute = () => {
    append({ key: "", value: "" });
  };

  const handleRemoveAttribute = (index: number) => {
    remove(index);
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {t("workspace.contacts.create_contact")}
        <UserPlusIcon />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          setOpen(newOpen);
          if (!newOpen) {
            resetForm();
          }
        }}>
        <DialogContent width="default" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{t("workspace.contacts.create_contact")}</DialogTitle>
            <DialogDescription>{t("workspace.contacts.create_contact_description")}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {fields.length > 0 && (
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <AttributeFieldRow
                        key={field.id}
                        index={index}
                        fieldId={field.id}
                        form={form}
                        attributeKeys={contactAttributeKeys}
                        watchedAttributes={watchedAttributes}
                        allKeyOptions={allKeyOptions}
                        getAvailableOptions={getAvailableOptions}
                        savedAttributeKeys={NO_SAVED_ATTRIBUTE_KEYS}
                        onRemove={handleRemoveAttribute}
                        t={t}
                      />
                    ))}
                  </div>
                )}

                {watchedAttributes.length < contactAttributeKeys.length && (
                  <Button type="button" variant="secondary" onClick={handleAddAttribute} className="w-fit">
                    <PlusIcon className="mr-2 size-4" />
                    {t("workspace.contacts.add_attribute")}
                  </Button>
                )}

                {form.formState.errors.attributes?.root && (
                  <FormError>{form.formState.errors.attributes.root.message}</FormError>
                )}

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" loading={form.formState.isSubmitting}>
                    {t("common.create")}
                  </Button>
                </DialogFooter>
              </form>
            </FormProvider>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
