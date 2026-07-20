import { getOrganizationAuditPath, getOrganizationBillingPath } from "@/modules/settings/lib/routes";

// Thin alias kept for existing callers; the billing-fallback URL is owned by getOrganizationBillingPath
// so the two cannot drift apart.
export const getBillingFallbackPath = (organizationId: string, isFormbricksCloud: boolean): string =>
  getOrganizationBillingPath(organizationId, isFormbricksCloud);

export const getAuditorFallbackPath = (organizationId: string): string =>
  getOrganizationAuditPath(organizationId);
