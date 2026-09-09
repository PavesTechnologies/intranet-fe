import api from "../../../api/axiosInstance";

const AR_BASE_URL = window.__APP_CONFIG__?.AR_BASE_URL || import.meta.env?.VITE_AR_API_BASE_URL || "http://localhost:8080";

const unwrapData = (response) => {
  const payload = response?.data;
  if (payload && typeof payload === "object") {
    if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
      return payload.data;
    }
  }
  return payload?.data ?? payload ?? null;
};

export const getTaxCalculationErrorMessage = (error, fallback = "Tax calculation could not be completed. Please try again.") => {
  const status = error?.response?.status;
  const detail =
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.response?.data?.error ||
    error?.message ||
    "";

  if (status === 404) {
    return "Billing snapshot could not be found.";
  }
  if (status === 400 || status === 422) {
    if (detail.toLowerCase().includes("not ready")) {
      return "Tax calculation cannot be started because this billing snapshot is not ready for tax calculation.";
    }
    if (detail.toLowerCase().includes("region")) {
      return "Tax calculation cannot proceed because no tax region is configured for this billing snapshot.";
    }
    if (detail.toLowerCase().includes("active tax configuration") || detail.toLowerCase().includes("config")) {
      return "No active tax configuration is available for the selected tax region and billing period.";
    }
    if (detail.toLowerCase().includes("already") || detail.toLowerCase().includes("completed")) {
      return "Tax calculation has already been completed for this billing snapshot.";
    }
  }
  if (status === 409) {
    return "Tax calculation has already been completed for this billing snapshot.";
  }
  if (status === 403) {
    return "You do not have permission to execute tax calculation.";
  }

  return detail || fallback;
};

/**
 * @typedef {Object} TaxCalculationComponent
 * @property {string} id
 * @property {string} taxTypeId
 * @property {string} taxTypeCode
 * @property {string} taxTypeName
 * @property {number|null} appliedRate
 * @property {number} taxAmount
 * @property {string} applicabilityType
 */

/**
 * Normalizes a single tax component returned by the backend tax engine.
 * The backend is the source of truth for which components exist, their
 * rate, amount and applicability — this only guards against missing
 * fields, it never derives or recalculates a value.
 * @returns {TaxCalculationComponent}
 */
const normalizeTaxComponent = (component = {}, index = 0) => {
  const source = component && typeof component === "object" ? component : {};
  return {
    id:
      source.taxCalculationComponentId ||
      source.tax_calculation_component_id ||
      source.id ||
      `${source.taxTypeCode || source.taxTypeId || "component"}-${index}`,
    taxTypeId: source.taxTypeId || source.tax_type_id || "",
    taxTypeCode: source.taxTypeCode || source.tax_type_code || "",
    taxTypeName: source.taxTypeName || source.tax_type_name || "",
    appliedRate:
      source.appliedRate !== undefined && source.appliedRate !== null
        ? Number(source.appliedRate)
        : null,
    taxAmount: source.taxAmount !== undefined && source.taxAmount !== null ? Number(source.taxAmount) : 0,
    applicabilityType: source.applicabilityType || source.applicability_type || "",
  };
};

/**
 * Normalizes backend TaxCalculation response. Component composition
 * (which tax types apply, how many, their rates and amounts) is entirely
 * driven by `item.components` as returned by the backend — nothing here
 * assumes a specific tax regime, count, or set of tax type codes.
 */
export const normalizeTaxCalculation = (item = {}) => {
  if (!item || typeof item !== "object") return null;

  const rawComponents = Array.isArray(item.components) ? item.components : [];

  return {
    ...item,
    taxCalculationId: item.taxCalculationId || item.tax_calculation_id || item.id || "",
    billingSnapshotId: item.billingSnapshotId || item.billing_snapshot_id || item.snapshotId || "",
    snapshotNumber: item.snapshotNumber || item.snapshot_number || "",
    taxRegionId: item.taxRegionId || item.tax_region_id || "",
    taxRegionCode: item.taxRegionCode || item.tax_region_code || "",
    taxConfigurationId: item.taxConfigurationId || item.tax_configuration_id || "",
    taxRateConfigurationId: item.taxRateConfigurationId || item.tax_rate_configuration_id || "",
    taxableAmount: item.taxableAmount !== undefined && item.taxableAmount !== null ? Number(item.taxableAmount) : null,
    components: rawComponents.map(normalizeTaxComponent),
    totalTaxAmount: item.totalTaxAmount !== undefined && item.totalTaxAmount !== null ? Number(item.totalTaxAmount) : null,
    grandTotal: item.grandTotal !== undefined && item.grandTotal !== null ? Number(item.grandTotal) : null,
    status:
      (item.snapshotStatus || "").toUpperCase() === "TAX_COMPLETED" ||
      (item.status || "").toUpperCase() === "CALCULATED" ||
      (item.status || "").toUpperCase() === "TAX_COMPLETED" ||
      (item.status || "").toUpperCase() === "COMPLETED"
        ? "TAX_COMPLETED"
        : item.status || "TAX_COMPLETED",
    calculationStatus: item.status || "CALCULATED",
    calculatedAt: item.calculatedAt || item.calculated_at || "",
  };
};

/**
 * POST /api/v1/billing-snapshots/{snapshotId}/tax-calculation
 * Calculates tax on backend and saves result. No request body.
 */
export const calculateTax = async (snapshotId) => {
  if (!snapshotId) {
    throw new Error("Billing snapshot ID is required for tax calculation.");
  }
  const url = `${AR_BASE_URL}/api/v1/billing-snapshots/${snapshotId}/tax-calculation`;
  const response = await api.post(url);
  return normalizeTaxCalculation(unwrapData(response));
};

/**
 * GET /api/v1/billing-snapshots/{snapshotId}/tax-calculation
 * Retrieves saved TaxCalculation result from backend.
 */
export const getTaxCalculation = async (snapshotId) => {
  if (!snapshotId) {
    throw new Error("Billing snapshot ID is required.");
  }
  const url = `${AR_BASE_URL}/api/v1/billing-snapshots/${snapshotId}/tax-calculation`;
  const response = await api.get(url);
  return normalizeTaxCalculation(unwrapData(response));
};
