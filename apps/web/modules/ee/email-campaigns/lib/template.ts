export const DEFAULT_EMAIL_CAMPAIGN_TEMPLATE = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#ffffff;">
    <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hello,</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">We would love your feedback.</p>
    <div style="margin:24px 0;">{{survey}}</div>
    <p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#64748b;">
      Or open the survey here:
      <a href="{{survey_link}}" style="color:#0f172a;">{{survey_link}}</a>
    </p>
  </body>
</html>`;

const TEMPLATE_PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

const HTML_ESCAPE_LOOKUP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_LOOKUP[char] ?? char);

export interface TInterpolateTemplateInput {
  /** Scalar values (CSV columns, email, survey_link). Escaped before insertion. */
  scalars: Record<string, string>;
  /** Raw HTML fragments that must not be escaped (e.g. {{survey}}). */
  raw?: Record<string, string>;
}

/**
 * Replaces `{{key}}` placeholders in a template string.
 * Unknown keys become empty strings. Scalar values are HTML-escaped; raw values are injected as-is.
 */
export const interpolateTemplate = (
  template: string,
  { scalars, raw = {} }: TInterpolateTemplateInput
): string =>
  template.replace(TEMPLATE_PLACEHOLDER_REGEX, (_match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      return raw[key] ?? "";
    }
    if (Object.prototype.hasOwnProperty.call(scalars, key)) {
      return escapeHtml(scalars[key] ?? "");
    }
    return "";
  });
