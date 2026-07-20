import { parse } from "csv-parse/sync";
import { z } from "zod";
import { TEmailCampaignRecipientInput } from "@formbricks/types/email-campaigns";

const ZEmailCampaignCsvEmail = z.email();

export interface TEmailCampaignCsvParseResult {
  recipients: TEmailCampaignRecipientInput[];
  /** 1-based row numbers (excluding the header row) that were skipped, with the reason why. */
  skippedRows: { row: number; reason: string }[];
  /** Column headers discovered in the CSV (excluding the email column). */
  variableColumns: string[];
}

const EMAIL_COLUMN_ALIASES = new Set(["email", "e-mail", "email address", "correo", "correo electronico"]);

const normalizeColumnName = (column: string): string => column.trim().toLowerCase();

/**
 * Parses a recipients CSV for a bulk email campaign.
 *
 * The only required column is "email" (case-insensitive). All other columns are captured as
 * per-recipient `variables`. Columns whose name matches one of the survey's hidden field ids
 * (case-insensitive) are also copied into `hiddenFields` for the survey URL.
 */
export const parseEmailCampaignCsv = (
  csv: string,
  allowedHiddenFieldIds: string[]
): TEmailCampaignCsvParseResult => {
  const records = parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: [",", ";", "\t"],
  }) as Record<string, string>[];

  const hiddenFieldIdByNormalizedName = new Map(
    allowedHiddenFieldIds.map((fieldId) => [normalizeColumnName(fieldId), fieldId])
  );

  const recipients: TEmailCampaignRecipientInput[] = [];
  const skippedRows: { row: number; reason: string }[] = [];
  const variableColumns = new Set<string>();

  records.forEach((record, index) => {
    const rowNumber = index + 1;
    let email: string | undefined;
    const variables: Record<string, string> = {};
    const hiddenFields: Record<string, string> = {};

    for (const [column, rawValue] of Object.entries(record)) {
      const value = rawValue?.trim() ?? "";
      const normalizedColumn = normalizeColumnName(column);

      if (EMAIL_COLUMN_ALIASES.has(normalizedColumn)) {
        email = value;
        continue;
      }

      variableColumns.add(column);
      if (value) {
        variables[column] = value;
      }

      const hiddenFieldId = hiddenFieldIdByNormalizedName.get(normalizedColumn);
      if (hiddenFieldId && value) {
        hiddenFields[hiddenFieldId] = value;
      }
    }

    if (!email) {
      skippedRows.push({ row: rowNumber, reason: "missing_email" });
      return;
    }

    const parsedEmail = ZEmailCampaignCsvEmail.safeParse(email);
    if (!parsedEmail.success) {
      skippedRows.push({ row: rowNumber, reason: "invalid_email" });
      return;
    }

    recipients.push({
      email: parsedEmail.data,
      variables: Object.keys(variables).length > 0 ? variables : undefined,
      hiddenFields: Object.keys(hiddenFields).length > 0 ? hiddenFields : undefined,
    });
  });

  return { recipients, skippedRows, variableColumns: [...variableColumns] };
};
