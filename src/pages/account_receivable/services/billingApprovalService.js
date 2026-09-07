// Finance Manager (Checker) approval workflow for Project Billing Configuration.
//
// This is a deliberately separate module from billingConfigurationService.js —
// the Maker (Finance Executive) wizard's create/draft/save logic there still
// reads the legacy "status" + "isActive" fields for its own list/detail views,
// and must stay untouched. The approval workflow below is built entirely on
// the new BillingConfigurationResponseDto's flat two-status model
// (approvalStatus / billingStatus) and never reads/writes status or isActive.
import api from "../../../api/axiosInstance";
import {
  asArray,
  extractBillingConfigurationId,
  getApiErrorMessage,
  rejectBillingConfiguration,
  unwrapData,
} from "./billingConfigurationService";

const BASE_URL = window.__APP_CONFIG__.AR_BASE_URL;
const BILLING_CONFIGURATIONS_URL = `${BASE_URL}/api/billing-configurations`;

const firstPresent = (...values) =>
  values.find((value) => value !== null && value !== undefined && value !== "");

// Title-cases a SCREAMING_SNAKE_CASE enum value for display — e.g.
// "PENDING_APPROVAL" -> "Pending Approval". Used for approvalStatus/billingStatus
// badges; the raw enum value is preserved separately for status comparisons.
export const formatApprovalStatusLabel = (value) => {
  if (!value) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

// Every billing type's commercial figures now come back nested under a
// dedicated key on the BillingConfigurationResponseDto — never at the top
// level, and never under the old "fixedPrice"/"recurring" nesting the Maker
// wizard's own draft-normalization uses (see billingConfigurationService.js —
// that shape is unrelated and must not be assumed here). Fixed Price and
// Recurring each carry a single details object; Time & Material and
// Milestone carry a list (one row per rate card / milestone).
const BILLING_TYPE_DETAILS_KEY = {
  FIXED_PRICE: "fixedPriceDetails",
  RECURRING: "recurringDetails",
  TIME_MATERIAL: "tmRateCards",
  MILESTONE: "milestoneSchedules",
};

const resolveBillingTypeDetailsKey = (record = {}) => {
  const type = String(record.billingTypeName || record.billingType || "").trim().toUpperCase();
  if (type.includes("FIXED")) return BILLING_TYPE_DETAILS_KEY.FIXED_PRICE;
  if (type.includes("RECURRING")) return BILLING_TYPE_DETAILS_KEY.RECURRING;
  if (type.includes("MILESTONE")) return BILLING_TYPE_DETAILS_KEY.MILESTONE;
  if (type.includes("TIME") || type.includes("MATERIAL") || type.includes("TIMESHEET")) return BILLING_TYPE_DETAILS_KEY.TIME_MATERIAL;
  return null;
};

// Picks the correct nested section for this record's billing type and
// normalizes it to a consistent { key, list, single } shape so callers never
// have to guess whether it's an object or an array — and never throw on a
// missing/null section (a draft with no commercial details saved yet, or a
// billing type not in the map above).
const resolveBillingDetails = (record = {}) => {
  const key = resolveBillingTypeDetailsKey(record);
  const raw = key ? record[key] : null;
  const list = Array.isArray(raw) ? raw : null;
  // Fixed Price/Recurring are single objects; Time & Material/Milestone are
  // lists — scalar reads below use the first (primary) row of a list.
  const single = list ? list[0] || null : raw && typeof raw === "object" ? raw : null;
  return { key, list, single: single || null };
};

// Maps the flat BillingConfigurationResponseDto (billingConfigurationId,
// clientName, projectName, ..., approvalStatus, billingStatus, ...) plus its
// billing-type-specific nested details section onto the shape the approvals
// list/review screen renders.
export const normalizeApprovalConfiguration = (record = {}) => {
  const approvalStatus = String(record.approvalStatus || "").trim().toUpperCase() || "DRAFT";
  const billingStatus = String(record.billingStatus || "").trim().toUpperCase() || "INACTIVE";
  const { key: billingDetailsKey, list: billingDetailsList, single: billingDetails } = resolveBillingDetails(record);

  return {
    ...record,
    billingConfigurationId: record.billingConfigurationId || record.id || "",
    clientId: record.clientId || "",
    clientName: record.clientName || "",
    projectId: record.projectId || "",
    projectName: record.projectName || "",
    projectCode: firstPresent(record.projectCode, record.projectcode) || "",
    billingTypeId: record.billingTypeId || "",
    billingTypeName: record.billingTypeName || record.billingType || "",
    billingFrequencyId: record.billingFrequencyId || "",
    billingFrequencyName: record.billingFrequencyName || record.billingFrequency || "",
    currencyId: record.currencyId || "",
    currencyCode: firstPresent(record.currencyCode, record.currency) || "",
    projectBudget: record.projectBudget ?? record.pmsProjectBudget ?? "",
    projectBudgetCurrency: record.projectBudgetCurrency || "",
    paymentTermId: record.paymentTermId || "",
    paymentTermCode: record.paymentTermCode || "",
    paymentTermName: record.paymentTermName || record.paymentTerms || "",
    taxRegionId: record.taxRegionId || "",
    taxRegionName: record.taxRegionName || record.taxRegion || "",
    taxRegionCode: record.taxRegionCode || "",
    pricingModel: record.pricingModel || record.billingMode || "",
    invoiceGenerationType:
      record.invoiceGenerationType ||
      (record.autoInvoiceGeneration === true ? "Automatic" : record.autoInvoiceGeneration === false ? "Manual" : ""),
    autoInvoiceGeneration: record.autoInvoiceGeneration,
    invoiceGenerationDay: record.invoiceGenerationDay,
    expenseBillingEligible: Boolean(record.expenseBillingEligible),
    rejectionReason: record.rejectionReason || "",
    // Raw nested sections, passed through as-is for any UI that needs the
    // full shape (e.g. every T&M rate card row, not just the primary one).
    fixedPriceDetails: record.fixedPriceDetails || null,
    recurringDetails: record.recurringDetails || null,
    tmRateCards: record.tmRateCards || null,
    milestoneSchedules: record.milestoneSchedules || null,
    // The details section for THIS record's billing type — Fixed Price and
    // Recurring resolve to fixedPriceDetails/recurringDetails, T&M and
    // Milestone resolve to the first row of tmRateCards/milestoneSchedules.
    // null when the type isn't recognized or the section wasn't returned.
    billingDetailsKey,
    billingDetailsList,
    billingDetails,
    effectiveFrom: firstPresent(billingDetails?.effectiveFrom, record.effectiveFrom, record.startDate) || "",
    effectiveTo: firstPresent(billingDetails?.effectiveTo, record.effectiveTo, record.endDate) || "",
    hourlyRate: record.hourlyRate ?? "",
    // contractValue/pmsProjectBudget/contractValueSource and every commercial
    // figure below are read from the resolved billingDetails section first —
    // that's the backend's source of truth — falling back to the legacy flat
    // fields only when billingDetails is null/missing (e.g. a draft that was
    // never saved with commercial details).
    contractValue: firstPresent(billingDetails?.contractValue, record.contractValue, record.totalContractValue),
    contractValueSource: firstPresent(billingDetails?.contractValueSource, record.contractValueSource),
    // PMS Project Budget: fixedPriceDetails.pmsProjectBudget first, falling
    // back to the top-level projectBudget when the details value is null.
    pmsProjectBudget: firstPresent(billingDetails?.pmsProjectBudget, record.projectBudget, record.pmsProjectBudget),
    // retentionPercentage is the canonical backend field name — check it first,
    // falling back to the legacy retentionPercent name for older responses.
    retentionPercent: firstPresent(
      billingDetails?.retentionPercentage,
      billingDetails?.retentionPercent,
      record.retentionPercentage,
      record.retentionPercent,
    ),
    retentionAmount: firstPresent(billingDetails?.retentionAmount, record.retentionAmount),
    billableAmount: firstPresent(billingDetails?.billableAmount, record.billableAmount),
    advanceReceived: firstPresent(billingDetails?.advanceReceived, record.advanceReceived),
    // remainingReceivable is the canonical backend field name — check it first,
    // falling back to the legacy remainingAmount name for older responses.
    remainingAmount: firstPresent(
      billingDetails?.remainingReceivable,
      billingDetails?.remainingAmount,
      record.remainingReceivable,
      record.remainingAmount,
    ),
    approvalStatus,
    billingStatus,
    createdAt: firstPresent(record.createdAt, record.createdDate) || "",
    updatedAt: record.updatedAt || "",
    versionNo: record.versionNo ?? "",
    createdBy: record.createdBy || "",
    submittedBy: firstPresent(record.submittedBy, record.createdBy) || "",
  };
};

// GET /api/billing-configurations/pending-approvals — the dedicated endpoint
// for the Finance Manager's queue. The approvalStatus filter is kept as a
// defensive guarantee (never trust the endpoint to be the only thing standing
// between a non-pending record and the Checker's screen) rather than as the
// primary filtering mechanism.
export const getPendingApprovalConfigurations = async () => {
  const response = await api.get(`${BILLING_CONFIGURATIONS_URL}/pending-approvals`);
  return asArray(unwrapData(response))
    .filter((record) => String(record?.approvalStatus || "").trim().toUpperCase() === "PENDING_APPROVAL")
    .map(normalizeApprovalConfiguration);
};

// GET /api/billing-configurations/{billingConfigurationId} — used to load the
// full configuration for the read-only Review screen.
export const getBillingConfigurationForApproval = async (billingConfigurationId) => {
  const id = extractBillingConfigurationId(billingConfigurationId);
  if (!id) {
    return Promise.reject(new Error("Missing billingConfigurationId — unable to resolve an id from the provided value."));
  }

  const response = await api.get(`${BILLING_CONFIGURATIONS_URL}/${id}`);
  return normalizeApprovalConfiguration(unwrapData(response));
};

// PUT /api/billing-configurations/{billingConfigurationId}/approve — no
// request body. The backend alone decides billingStatus (ACTIVE vs INACTIVE)
// based on the effective/project start date; the frontend never sets it.
// Deliberately NOT named approveBillingConfiguration — that name is already
// the Maker wizard's legacy compatibility shim for the old /activate endpoint
// (see billingConfigurationService.js), which this workflow must never call.
export const approveBillingConfigurationRequest = async (billingConfigurationId) => {
  const id = extractBillingConfigurationId(billingConfigurationId);
  if (!id) {
    return Promise.reject(new Error("Missing billingConfigurationId — unable to resolve an id from the provided value."));
  }

  const response = await api.put(`${BILLING_CONFIGURATIONS_URL}/${id}/approve`);
  return normalizeApprovalConfiguration(unwrapData(response) || {});
};

// PUT /api/billing-configurations/{billingConfigurationId}/reject with
// { rejectionReason } — reuses the existing rejectBillingConfiguration, which
// already implements this exact BillingConfigurationRejectRequestDto contract.
export const rejectBillingConfigurationRequest = async (billingConfigurationId, rejectionReason) => {
  const id = extractBillingConfigurationId(billingConfigurationId);
  if (!id) {
    return Promise.reject(new Error("Missing billingConfigurationId — unable to resolve an id from the provided value."));
  }

  const result = await rejectBillingConfiguration(id, rejectionReason);
  return normalizeApprovalConfiguration(result || {});
};

export { getApiErrorMessage };
