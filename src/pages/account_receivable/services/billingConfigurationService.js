import api from "../../../api/axiosInstance";
import { fetchActiveBillingConfigurations } from "./billingDataAcquisitionService";
import { getActiveBillingFrequencies, normalizeBillingFrequency } from "./billingFrequencyService";
import { getActivePaymentTerms, normalizePaymentTerm } from "./paymentTermsService";
import { getActiveTaxRegions, normalizeTaxRegion } from "./taxRegionService";

const BASE_URL = window.__APP_CONFIG__.AR_BASE_URL;

const BILLING_CONFIGURATIONS_URL = `${BASE_URL}/api/billing-configurations`;
const BILLING_RECURRING_URL = `${BASE_URL}/api/billing-recurring`;
const TM_RATE_CARDS_URL = `${BASE_URL}/api/billing-tm-rate-card`;
const BILLING_FIXED_PRICE_URL = `${BASE_URL}/api/billing-fixed-price`;

export const unwrapData = (response) => {
  const payload = response?.data;

  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.data?.data)) return payload.data.data;
    if (Array.isArray(payload.content)) return payload.content;
    if (Array.isArray(payload.content?.data)) return payload.content.data;
  }

  return payload?.data ?? payload ?? null;
};

export const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.data?.data)) return value.data.data;
    if (Array.isArray(value.content)) return value.content;
    if (Array.isArray(value.content?.data)) return value.content.data;
  }

  return [];
};

const labelize = (value) => {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const normalizeBillingTypeValue = (value) => {
  if (!value) return "";

  const normalized = String(value).trim().toUpperCase().replace(/\s+/g, "_");

  if (["TIME_MATERIAL", "TIMESHEET_BASED", "TIMESHEET", "TIME_AND_MATERIAL"].includes(normalized)) return "TIME_MATERIAL";
  if (["FIXED_PRICE", "FIXED"].includes(normalized)) return "FIXED_PRICE";
  if (["MILESTONE", "MILESTONE_BASED"].includes(normalized)) return "MILESTONE";
  if (["RECURRING", "RECURRING_BILLING", "SUBSCRIPTION", "SUBSCRIPTION_BASED"].includes(normalized)) return "RECURRING";

  return normalized;
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// The backend's BillingConfigurationResponseDto carries two independent
// statuses (see billingApprovalService.js, which is built the same way for
// the Checker's queue): approvalStatus (DRAFT / PENDING_APPROVAL / APPROVED /
// REJECTED) tracks the Maker-Checker workflow; billingStatus (INACTIVE /
// ACTIVE / EXPIRED) is derived by the backend from effectiveFrom/effectiveTo
// and is never set by the frontend. The old single "status" + "isActive"
// fields no longer exist on the response and must never be read.
const normalizeApprovalStatusValue = (value) => String(value || "").trim().toUpperCase() || "DRAFT";
const normalizeBillingStatusValue = (value) => String(value || "").trim().toUpperCase() || "INACTIVE";

const getConfigId = (config) =>
  config?.billingConfigurationId ||
  config?.configurationId ||
  config?.configId ||
  config?.id;

export const extractBillingConfigurationId = (value, depth = 3) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return String(value);

  const candidate = getConfigId(value);
  if (candidate || candidate === 0) return String(candidate);

  if (depth <= 0 || typeof value !== "object") return null;

  const nestedKeys = ["data", "response", "payload", "result", "body"];
  for (const key of nestedKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const nested = extractBillingConfigurationId(value[key], depth - 1);
      if (nested) return nested;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractBillingConfigurationId(item, depth - 1);
      if (nested) return nested;
    }
  }

  for (const key of Object.keys(value)) {
    if (typeof value[key] === "object") {
      const nested = extractBillingConfigurationId(value[key], depth - 1);
      if (nested) return nested;
    }
  }

  return null;
};

const getProjectInfo = (config) => config?.projectInfo || config?.project || {};

const getBillingConfig = (config) =>
  config?.billingConfig || config?.billingConfiguration || config?.billingDetails || {};

const getToolBilling = (config) => config?.toolBilling || config?.toolBillingConfig || {};

const getControls = (config = {}) => config.controls || config.financialControls || config;

const firstPresent = (...values) =>
  values.find((value) => value !== null && value !== undefined && value !== "");

const getObjectValue = (value, keys = []) => {
  if (!value || typeof value !== "object") return "";
  return firstPresent(...keys.map((key) => value[key])) || "";
};

const normalizePricingModelValue = (value) => {
  const rawValue =
    value && typeof value === "object"
      ? firstPresent(value.pricingModel, value.billingMode, value.code, value.value, value.name, value.label)
      : value;
  const normalized = normalizeBillingFrequencyValue(rawValue);

  if (["STANDARD", "STANDARD_RATE", "STANDARD_RATE_CARD"].includes(normalized)) return "STANDARD";
  if (["ROLE_BASED", "ROLE_BASED_RATES", "ROLE_BASED_RATE_CARD"].includes(normalized)) return "ROLE_BASED";

  return normalized;
};

const normalizeTmRateCard = (card = {}) => ({
  ...card,
  roleName:
    firstPresent(
      card.roleName,
      card.role,
      card.resourceRole,
      card.designation,
      card.name,
      card.label,
    ) || "",
  role:
    firstPresent(
      card.role,
      card.roleName,
      card.resourceRole,
      card.designation,
      card.name,
      card.label,
    ) || "",
  rate: firstPresent(card.rate, card.amount) || "",
  ratePeriod: normalizeBillingFrequencyValue(firstPresent(card.ratePeriod, card.period)) || "HOURLY",
  effectiveFrom: toLocalDateString(firstPresent(card.effectiveFrom, card.validFrom)) || "",
  effectiveTo: toLocalDateString(firstPresent(card.effectiveTo, card.validTo)) || "",
  rateCardId: firstPresent(card.rateCardId, card.tmRateCardId, card.id) || null,
});

const getTmRateCardId = (card = {}) => firstPresent(card.rateCardId, card.tmRateCardId, card.id) || null;

// The UI only ever works with "PMS" (Project Budget) / "MANUAL" for the contract
// value source badge and internal state — those labels stay unchanged. The backend
// ContractValueSource enum accepts only PMS_BUDGET / MANUAL, so requests must map
// "PMS" -> "PMS_BUDGET" (never send "PMS"), and responses must map it back.
const CONTRACT_VALUE_SOURCE_TO_API = { PMS: "PMS_BUDGET", MANUAL: "MANUAL" };
const CONTRACT_VALUE_SOURCE_FROM_API = { PMS_BUDGET: "PMS", MANUAL: "MANUAL" };

export const toApiContractValueSource = (value) => {
  if (!value) return null;
  return CONTRACT_VALUE_SOURCE_TO_API[value] || value;
};

const fromApiContractValueSource = (value) => {
  if (!value) return "";
  return CONTRACT_VALUE_SOURCE_FROM_API[value] || value;
};

const normalizeFixedPriceConfig = (record = {}) => ({
  fixedPriceConfigurationId: firstPresent(record.fixedPriceConfigurationId, record.id) || null,
  totalContractValue:
    firstPresent(record.totalContractValue, record.contractValue, record.manualContractValue, record.pmsBudget) ?? "",
  contractValueSource: fromApiContractValueSource(record.contractValueSource),
  pmsProjectBudget: firstPresent(record.pmsProjectBudget, record.pmsBudget) ?? "",
  // retentionPercentage is the canonical backend field name (RetentionPercentDto);
  // retentionPercent is only kept as a fallback for any older response shape.
  retentionPercent: firstPresent(record.retentionPercentage, record.retentionPercent) ?? "",
  advanceReceived: firstPresent(record.advanceReceived, record.advanceAmount) ?? "",
  effectiveFrom: toLocalDateString(firstPresent(record.effectiveFrom, record.validFrom)) || "",
  effectiveTo: toLocalDateString(firstPresent(record.effectiveTo, record.validTo)) || "",
  remarks: record.remarks || "",
  retentionAmount: firstPresent(record.retentionAmount, record.retentionAmt) ?? "",
  billableAmount: firstPresent(record.billableAmount, record.billableAmt) ?? "",
  // remainingReceivable is the canonical backend field name; remainingAmount/remainingAmt
  // are only kept as fallbacks for older response shapes.
  remainingAmount: firstPresent(record.remainingReceivable, record.remainingAmount, record.remainingAmt) ?? "",
});

const normalizeBoolean = (value, fallback = false) => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toUpperCase();
  if (["TRUE", "YES", "Y", "1", "AUTOMATIC", "AUTO"].includes(normalized)) return true;
  if (["FALSE", "NO", "N", "0", "MANUAL"].includes(normalized)) return false;
  return fallback;
};

const parseProjectDuration = (value) => {
  if (!value || typeof value !== "string") return { startDate: "", endDate: "" };

  const normalizedValue = value.trim();
  if (!normalizedValue) return { startDate: "", endDate: "" };

  const parts = normalizedValue
    .split(/\s+to\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      startDate: parts[0],
      endDate: parts[1],
    };
  }

  return { startDate: "", endDate: "" };
};

export const normalizeBillingConfiguration = (config = {}) => {
  const projectInfo = getProjectInfo(config);
  const billingConfig = getBillingConfig(config);
  const toolBilling = getToolBilling(config);
  const controls = getControls(config);
  const setupMode = config.setupMode || projectInfo.setupMode || (config.source === "Standalone" ? "STANDALONE" : "EXISTING");
  const approvalStatus = normalizeApprovalStatusValue(config.approvalStatus);
  const billingStatus = normalizeBillingStatusValue(config.billingStatus);
  const billingTypeObject =
    config.billingType && typeof config.billingType === "object"
      ? config.billingType
      : billingConfig.billingType && typeof billingConfig.billingType === "object"
      ? billingConfig.billingType
      : null;
  const billingTypeName = firstPresent(
    config.billingTypeLabel,
    config.billingTypeName,
    billingConfig.billingTypeLabel,
    billingConfig.billingTypeName,
    getObjectValue(billingTypeObject, ["billingTypeName", "name", "label", "displayName"]),
    typeof config.billingType === "string" ? config.billingType : "",
    typeof billingConfig.billingType === "string" ? billingConfig.billingType : "",
  );
  const billingFrequencyObject =
    config.billingFrequency && typeof config.billingFrequency === "object"
      ? config.billingFrequency
      : billingConfig.billingFrequency && typeof billingConfig.billingFrequency === "object"
      ? billingConfig.billingFrequency
      : null;
  const billingFrequencyName = firstPresent(
    config.billingFrequencyName,
    billingConfig.billingFrequencyName,
    getObjectValue(billingFrequencyObject, ["billingFrequencyName", "name", "label", "displayName"]),
    typeof config.billingFrequency === "string" ? config.billingFrequency : "",
    typeof billingConfig.billingFrequency === "string" ? billingConfig.billingFrequency : "",
  );

  return {
    ...config,
    id: getConfigId(config),
    billingConfigurationId: getConfigId(config),
    projectCode: config.projectCode || projectInfo.projectCode || projectInfo.code || "",
    projectName: config.projectName || projectInfo.projectName || projectInfo.name || "",
    projectId: config.projectId || projectInfo.projectId || projectInfo.id || "",
    clientId:
      config.clientId ||
      projectInfo.clientId ||
      projectInfo.client?.clientId ||
      projectInfo.client?.id ||
      "",
    client:
      config.client ||
      config.clientName ||
      projectInfo.clientName ||
      projectInfo.client?.clientName ||
      projectInfo.client?.name ||
      "",
    billingType: billingTypeName || "",
    billingTypeName: billingTypeName || "",
    billingFrequency: billingFrequencyName || "",
    billingFrequencyName: billingFrequencyName || "",
    source: config.source || (setupMode === "STANDALONE" ? "Standalone" : "Enterprise"),
    setupMode,
    approvalStatus,
    approvalStatusLabel: labelize(approvalStatus),
    billingStatus,
    billingStatusLabel: labelize(billingStatus),
    toolBillingEnabled:
      config.toolBillingEnabled ??
      toolBilling.enableToolBilling ??
      toolBilling.enabled ??
      false,
    lastUpdated: formatDate(config.lastUpdated || config.updatedAt || config.modifiedAt || config.createdAt),
    updatedBy: config.updatedBy || config.modifiedBy || config.createdBy || "",
    currentStep: config.currentStep || (approvalStatus === "DRAFT" ? 1 : 6),
  };
};

export const normalizeClient = (client = {}) => {
  const id = client.clientId || client.id || client.value;
  const name = client.clientName || client.name || client.label || client.companyName || "";

  return {
    ...client,
    id,
    clientId: id,
    clientName: name,
    value: id,
    label: name,
  };
};

export const normalizeBillingFrequencyValue = (value) => {
  if (!value) return "";
  return String(value).trim().toUpperCase().replace(/[-\s]+/g, "_");
};

// Billing Type list/active normalization and fetching now live in
// billingTypeService.js (single source of truth for the real
// BillingTypeResponseDto shape) — re-exported below for existing consumers.

// Billing Frequency is dynamic (durationValue + durationUnit is the source of
// truth, never a hardcoded MONTHLY/QUARTERLY/ANNUALLY check) — this only ever
// generates a *fallback* label. Whenever the backend already supplies a
// billingFrequencyName ("Monthly", "Quarterly", ...), that name wins.
const MONTH_FREQUENCY_LABELS = { 1: "Monthly", 3: "Quarterly", 6: "Half-Yearly", 12: "Annual" };

export const formatBillingFrequencyLabel = ({ durationValue, durationUnit, billingFrequencyName } = {}) => {
  if (billingFrequencyName) return billingFrequencyName;

  const count = Number(durationValue);
  const unit = String(durationUnit || "").trim().toUpperCase();
  if (!count || count <= 0 || !unit) return "";

  if (unit === "MONTHS") {
    if (MONTH_FREQUENCY_LABELS[count]) return MONTH_FREQUENCY_LABELS[count];
    if (count % 6 === 0) {
      const years = count / 12;
      return `Every ${years} Year${years === 1 ? "" : "s"}`;
    }
    return `Every ${count} Month${count === 1 ? "" : "s"}`;
  }

  if (unit === "YEARS") return count === 1 ? "Annual" : `Every ${count} Years`;
  if (unit === "DAYS") return `Every ${count} Day${count === 1 ? "" : "s"}`;

  return `Every ${count} ${labelize(unit)}`;
};

// Billing Frequency / Payment Term / Tax Region list & active-list
// normalization and fetching now live in their own dedicated services
// (billingFrequencyService.js, paymentTermsService.js, taxRegionService.js —
// single source of truth for each real DTO shape), imported above and
// re-exported below for existing consumers (BillingControlsStep.jsx,
// BillingConfigurationStep.jsx, normalizeControls/normalizeWizardDetail
// in this file).

const normalizeControls = (controls = {}) => {
  const paymentTerm = controls.paymentTerm && typeof controls.paymentTerm === "object" ? controls.paymentTerm : null;
  const taxRegion = controls.taxRegion && typeof controls.taxRegion === "object" ? controls.taxRegion : null;
  const normalizedPaymentTerm = paymentTerm ? normalizePaymentTerm(paymentTerm) : {};
  const normalizedTaxRegion = taxRegion ? normalizeTaxRegion(taxRegion) : {};
  const paymentTermName =
    controls.paymentTermName ||
    controls.payment_term_name ||
    controls.paymentTerms ||
    normalizedPaymentTerm.paymentTermName ||
    "";
  const taxRegionName =
    controls.taxRegionName ||
    controls.tax_region_name ||
    normalizedTaxRegion.taxRegionName ||
    "";

  return {
    ...controls,
    paymentTermId:
      controls.paymentTermId ||
      controls.payment_term_id ||
      normalizedPaymentTerm.paymentTermId ||
      "",
    paymentTermName,
    paymentTerms: controls.paymentTerms || normalizeBillingFrequencyValue(paymentTermName),
    taxRegionId:
      controls.taxRegionId ||
      controls.tax_region_id ||
      normalizedTaxRegion.taxRegionId ||
      "",
    taxRegionName,
  };
};

const normalizeWizardDetail = (config = {}, normalized = normalizeBillingConfiguration(config)) => {
  const rawProjectInfo = getProjectInfo(config);
  const rawBillingConfig = getBillingConfig(config);
  const rawControls = getControls(config);
  const billingTypeObject =
    config.billingType && typeof config.billingType === "object"
      ? config.billingType
      : rawBillingConfig.billingType && typeof rawBillingConfig.billingType === "object"
      ? rawBillingConfig.billingType
      : null;
  const billingFrequencyObject =
    config.billingFrequency && typeof config.billingFrequency === "object"
      ? config.billingFrequency
      : rawBillingConfig.billingFrequency && typeof rawBillingConfig.billingFrequency === "object"
      ? rawBillingConfig.billingFrequency
      : null;
  const paymentTermObject =
    rawControls.paymentTerm && typeof rawControls.paymentTerm === "object"
      ? rawControls.paymentTerm
      : config.paymentTerm && typeof config.paymentTerm === "object"
      ? config.paymentTerm
      : null;
  const taxRegionObject =
    rawControls.taxRegion && typeof rawControls.taxRegion === "object"
      ? rawControls.taxRegion
      : config.taxRegion && typeof config.taxRegion === "object"
      ? config.taxRegion
      : null;

  const billingTypeId = firstPresent(
    rawBillingConfig.billingTypeId,
    config.billingTypeId,
    getObjectValue(billingTypeObject, ["billingTypeId", "id", "typeId"]),
  );
  const billingTypeValue = normalizeBillingTypeValue(
    firstPresent(
      rawBillingConfig.billingTypeCode,
      config.billingTypeCode,
      rawBillingConfig.billingTypeValue,
      getObjectValue(billingTypeObject, [
        "billingTypeCode",
        "code",
        "value",
        "typeCode",
        "type",
        "billingTypeValue",
        "billingTypeName",
        "name",
        "label",
      ]),
      typeof rawBillingConfig.billingType === "string" ? rawBillingConfig.billingType : "",
      typeof config.billingType === "string" ? config.billingType : "",
      config.billingTypeName,
      rawBillingConfig.billingTypeName,
      normalized.billingType,
    ),
  );
  const billingTypeLabel =
    firstPresent(
      config.billingTypeLabel,
      config.billingTypeName,
      rawBillingConfig.billingTypeLabel,
      rawBillingConfig.billingTypeName,
      getObjectValue(billingTypeObject, ["billingTypeName", "name", "label", "displayName"]),
      normalized.billingType,
    ) || "";
  const billingTypeName = billingTypeLabel;

  const billingFrequencyId = firstPresent(
    rawBillingConfig.billingFrequencyId,
    config.billingFrequencyId,
    getObjectValue(billingFrequencyObject, ["billingFrequencyId", "id"]),
  );
  // billingFrequency has no separate code of its own here — the frequency
  // picker's onChange (BillingConfigurationStep.jsx) sets it to the exact
  // same billingFrequencyId UUID it stores (normalizeBillingFrequency's
  // `value: id`), not a MONTHLY/QUARTERLY-style code. The backend's flat
  // config response only carries billingFrequencyId/billingFrequencyName, so
  // none of the code-ish candidates below are ever actually present on a
  // loaded draft — falling back to billingFrequencyId keeps this field in
  // sync with what the button selection and schedule lookup already use.
  const billingFrequencyValue =
    normalizeBillingFrequencyValue(
      firstPresent(
        rawBillingConfig.billingFrequencyCode,
        config.billingFrequencyCode,
        rawBillingConfig.billingFrequencyValue,
        getObjectValue(billingFrequencyObject, ["billingFrequencyName", "name", "label", "code", "value"]),
        typeof rawBillingConfig.billingFrequency === "string" ? rawBillingConfig.billingFrequency : "",
        typeof config.billingFrequency === "string" ? config.billingFrequency : "",
      ),
    ) || billingFrequencyId || "";
  const billingFrequencyName =
    firstPresent(
      config.billingFrequencyName,
      rawBillingConfig.billingFrequencyName,
      getObjectValue(billingFrequencyObject, ["billingFrequencyName", "name", "label", "displayName"]),
      typeof rawBillingConfig.billingFrequency === "string" ? rawBillingConfig.billingFrequency : "",
      typeof config.billingFrequency === "string" ? config.billingFrequency : "",
    ) || "";
  const pricingModel = normalizePricingModelValue(
    firstPresent(
      rawBillingConfig.billingMode,
      rawBillingConfig.pricingModel,
      rawBillingConfig.selectedPricingModel,
      rawBillingConfig.rateModel,
      config.pricingModel,
      config.billingMode,
      config.selectedPricingModel,
      config.rateModel,
    ),
  );
  // The GET .../{id} response is a flat BillingConfigurationResponseDto — the
  // currency lives at the top level as projectBudgetCurrency/currencyCode, not
  // nested under a projectInfo/billingConfig object (those only exist once this
  // function's own output round-trips back through here) — config.currency
  // itself is frequently null on that DTO. Without these two fallbacks, a
  // freshly created/viewed configuration would show no currency at all even
  // though projectBudgetCurrency was populated by the backend.
  const currency = normalizeCurrencyCode(
    rawProjectInfo.projectBudgetCurrency,
    rawProjectInfo.currency,
    config.currency,
    rawBillingConfig.currency,
    config.projectBudgetCurrency,
    config.currencyCode,
  );
  const effectiveFrom = toLocalDateString(
    firstPresent(rawBillingConfig.effectiveFrom, config.effectiveFrom, rawProjectInfo.startDate),
  );
  const effectiveTo = toLocalDateString(
    firstPresent(rawBillingConfig.effectiveTo, config.effectiveTo, rawProjectInfo.endDate),
  );
  const normalizedPaymentTerm = paymentTermObject ? normalizePaymentTerm(paymentTermObject) : {};
  const normalizedTaxRegion = taxRegionObject ? normalizeTaxRegion(taxRegionObject) : {};
  const invoiceGenerationType = normalizeBillingFrequencyValue(
    firstPresent(rawControls.invoiceGenerationType, config.invoiceGenerationType),
  ) || (normalizeBoolean(firstPresent(rawControls.autoInvoiceGeneration, config.autoInvoiceGeneration), false) ? "AUTOMATIC" : "MANUAL");
  const autoInvoiceGeneration = normalizeBoolean(
    firstPresent(rawControls.autoInvoiceGeneration, config.autoInvoiceGeneration, invoiceGenerationType),
    invoiceGenerationType === "AUTOMATIC",
  );

  return {
    ...config,
    billingConfigurationId: normalized.billingConfigurationId,
    setupMode: normalized.setupMode,
    projectInfo: {
      ...rawProjectInfo,
      projectSource: normalized.setupMode === "STANDALONE" ? "STANDALONE" : "ENTERPRISE",
      clientId: firstPresent(rawProjectInfo.clientId, config.clientId, rawProjectInfo.client?.clientId, rawProjectInfo.client?.id) || "",
      clientName: firstPresent(
        rawProjectInfo.clientName,
        config.clientName,
        config.client,
        rawProjectInfo.client?.clientName,
        rawProjectInfo.client?.name,
        normalized.client,
      ) || "",
      projectId: firstPresent(rawProjectInfo.projectId, config.projectId, rawProjectInfo.id) || "",
      projectName: firstPresent(rawProjectInfo.projectName, config.projectName, rawProjectInfo.name, normalized.projectName) || "",
      projectCode: firstPresent(rawProjectInfo.projectCode, config.projectCode, rawProjectInfo.code, normalized.projectCode) || "",
      projectBudget: firstPresent(rawProjectInfo.projectBudget, config.projectBudget, rawProjectInfo.budget, rawProjectInfo.budgetAmount) || "",
      projectBudgetCurrency: currency,
      currency,
      startDate: toLocalDateString(firstPresent(rawProjectInfo.startDate, rawProjectInfo.projectStartDate, config.effectiveFrom, config.startDate)) || effectiveFrom,
      endDate: toLocalDateString(firstPresent(rawProjectInfo.endDate, rawProjectInfo.projectEndDate, config.effectiveTo, config.endDate)) || effectiveTo,
    },
    billingConfig: {
      ...rawBillingConfig,
      billingConfigurationId: normalized.billingConfigurationId,
      id: normalized.billingConfigurationId,
      billingType: billingTypeValue,
      billingTypeId: billingTypeId || "",
      billingTypeLabel,
      billingTypeName,
      billingFrequency: billingFrequencyValue,
      billingFrequencyId: billingFrequencyId || "",
      billingFrequencyLabel: billingFrequencyName,
      billingFrequencyName,
      billingMode: pricingModel,
      pricingModel,
      currency,
      effectiveFrom,
      effectiveTo,
      timeAndMaterial: {
        ...(rawBillingConfig.timeAndMaterial || {}),
        rate:
          firstPresent(
            rawBillingConfig.timeAndMaterial?.rate,
            rawBillingConfig.rate,
            config.rate,
          ) || "",
        ratePeriod:
          normalizeBillingFrequencyValue(
            firstPresent(
              rawBillingConfig.timeAndMaterial?.ratePeriod,
              rawBillingConfig.ratePeriod,
              config.ratePeriod,
            ),
          ) || "HOURLY",
        roles: (rawBillingConfig.timeAndMaterial?.roles || rawBillingConfig.roles || rawBillingConfig.rateCards || []).map(normalizeTmRateCard),
      },
      fixedPrice: {
        ...(rawBillingConfig.fixedPrice || {}),
        fixedPriceConfigurationId:
          firstPresent(rawBillingConfig.fixedPrice?.fixedPriceConfigurationId, rawBillingConfig.fixedPriceConfigurationId) || null,
        totalContractValue:
          firstPresent(
            rawBillingConfig.fixedPrice?.totalContractValue,
            rawBillingConfig.totalContractValue,
            config.totalContractValue,
            config.contractValue,
          ) || "",
        advanceReceived:
          firstPresent(rawBillingConfig.fixedPrice?.advanceReceived, rawBillingConfig.advanceReceived, config.advanceReceived) || "",
        // retentionPercentage is the canonical backend field name — it was missing
        // here entirely, so editing an existing Fixed Price config silently dropped
        // the retention value (fell through to "" even though the API returned it).
        retentionPercent:
          firstPresent(
            rawBillingConfig.fixedPrice?.retentionPercentage,
            rawBillingConfig.fixedPrice?.retentionPercent,
            rawBillingConfig.retentionPercentage,
            rawBillingConfig.retentionPercent,
            config.retentionPercentage,
            config.retentionPercent,
          ) ?? "",
        effectiveFrom: toLocalDateString(firstPresent(rawBillingConfig.fixedPrice?.effectiveFrom, rawBillingConfig.fixedPriceEffectiveFrom)) || "",
        effectiveTo: toLocalDateString(firstPresent(rawBillingConfig.fixedPrice?.effectiveTo, rawBillingConfig.fixedPriceEffectiveTo)) || "",
        remarks: firstPresent(rawBillingConfig.fixedPrice?.remarks, rawBillingConfig.fixedPriceRemarks) || "",
        pmsProjectBudget: firstPresent(rawBillingConfig.fixedPrice?.pmsProjectBudget) ?? "",
        retentionAmount: firstPresent(rawBillingConfig.fixedPrice?.retentionAmount) ?? "",
        billableAmount: firstPresent(rawBillingConfig.fixedPrice?.billableAmount) ?? "",
        // Backend field is "remainingReceivable", not "remainingAmount" — without this
        // fallback, editing an existing Fixed Price config always showed a blank
        // Remaining Receivable even though the API returned the correct value.
        remainingAmount:
          firstPresent(rawBillingConfig.fixedPrice?.remainingReceivable, rawBillingConfig.fixedPrice?.remainingAmount) ?? "",
      },
      milestones: rawBillingConfig.milestones || config.milestones || [],
      milestoneSettings: rawBillingConfig.milestoneSettings || config.milestoneSettings || {},
      monthlyRetainer: rawBillingConfig.monthlyRetainer || {},
      recurring: rawBillingConfig.recurring || {},
    },
    controls: normalizeControls({
      ...rawControls,
      paymentTermId:
        firstPresent(rawControls.paymentTermId, config.paymentTermId, normalizedPaymentTerm.paymentTermId) || "",
      paymentTermName:
        firstPresent(rawControls.paymentTermName, config.paymentTermName, normalizedPaymentTerm.paymentTermName) || "",
      taxRegionId:
        firstPresent(rawControls.taxRegionId, config.taxRegionId, normalizedTaxRegion.taxRegionId) || "",
      taxRegionName:
        firstPresent(rawControls.taxRegionName, config.taxRegionName, normalizedTaxRegion.taxRegionName) || "",
      invoiceGenerationType,
      autoInvoiceGeneration,
      invoiceGenerationDay:
        firstPresent(rawControls.invoiceGenerationDay, config.invoiceGenerationDay, config.generationDay) || "",
      expenseBillingEligible: normalizeBoolean(
        firstPresent(rawControls.expenseBillingEligible, config.expenseBillingEligible),
        false,
      ),
    }),
  };
};

export const normalizeProject = (project = {}) => {
  const id = project.projectId || project.id || project.value;
  const projectDuration = project.projectDuration || project.duration || "";
  const parsedDuration = parseProjectDuration(projectDuration);
  const currencyObject = project.currency && typeof project.currency === "object" ? project.currency : null;
  const currencyCode =
    project.currencyCode ||
    project.currency_code ||
    currencyObject?.currencyCode ||
    currencyObject?.currency_code ||
    currencyObject?.code ||
    (typeof project.currency === "string" ? project.currency : "") ||
    project.budgetCurrency ||
    "";
  const projectBudgetCurrency = project.projectBudgetCurrency || currencyCode || "";
  const projectBudget = project.projectBudget ?? project.budget ?? project.budgetAmount ?? "";

  return {
    ...project,
    id,
    projectId: id,
    clientId: project.clientId || project.client?.clientId || project.client?.id,
    clientName: project.clientName || project.client?.clientName || project.client?.name || "",
    projectName: project.projectName || project.name || project.label || "",
    projectCode: project.projectCode || project.code || project.projectKey || "",
    contractNumber: project.contractNumber || project.contractReference || "",
    currency: currencyCode || projectBudgetCurrency || "",
    billingType: project.billingType || "",
    billingMode: project.billingMode || "",
    billingFrequency: project.billingFrequency || "",
    projectDuration,
    projectBudget,
    projectBudgetCurrency,
    // Normalized to a plain yyyy-mm-dd (never a raw datetime/timestamp string) —
    // every date-range check downstream (Recurring's Billing Start/End Date
    // validation, Fixed Price's Effective From/To) does lexical string
    // comparison against these, so a stray time component here would make an
    // exact boundary date (e.g. the project's own start date) look "outside
    // the project duration" even though it isn't.
    startDate: toLocalDateString(project.startDate || project.projectStartDate || parsedDuration.startDate) || "",
    endDate: toLocalDateString(project.endDate || project.projectEndDate || parsedDuration.endDate) || "",
  };
};

export const getApiErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  const rawMsg =
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.response?.data?.error ||
    error?.message ||
    "";

  if (typeof rawMsg === "string" && rawMsg.includes("paymentTerm") && rawMsg.includes("is null")) {
    return "Backend error: A billing configuration record in database has a null Payment Term reference. Please assign payment terms in backend or re-save billing setup.";
  }

  return rawMsg || fallback;
};

// Returns every configuration the Finance Executive (Maker) can see —
// Draft, Pending Approval, Approved, and Rejected alike — so they can track
// a submission through the whole approval workflow from their own Overview,
// not just the ones already approved. (Previously this filtered out anything
// that wasn't Draft or Approved+isActive; the old "isActive" gate no longer
// applies since billingStatus is now a computed, date-derived field rather
// than a manual visibility flag.)
export const getBillingConfigurations = async () => {
  try {
    const response = await api.get(BILLING_CONFIGURATIONS_URL);
    return asArray(unwrapData(response)).map(normalizeBillingConfiguration);
  } catch (error) {
    console.warn("[billingConfigurationService] GET /api/billing-configurations failed, attempting active fallback:", error);
    try {
      const activeConfigs = await fetchActiveBillingConfigurations();
      if (Array.isArray(activeConfigs) && activeConfigs.length > 0) {
        return activeConfigs.map((cfg) => normalizeBillingConfiguration(cfg));
      }
    } catch (fallbackErr) {
      console.warn("[billingConfigurationService] Active configurations fallback failed:", fallbackErr);
    }
    throw error;
  }
};

export const getBillingConfigurationById = async (billingConfigurationId) => {
  const response = await api.get(`${BILLING_CONFIGURATIONS_URL}/${billingConfigurationId}`);
  const config = unwrapData(response);
  const normalized = normalizeBillingConfiguration(config);
  const detail = normalizeWizardDetail(config, normalized);
  const configId = detail.billingConfigurationId || normalized.billingConfigurationId || billingConfigurationId;

  if (detail.billingConfig?.billingType === "FIXED_PRICE" && configId) {
    try {
      const fixedPriceRecord = await getFixedPriceByBillingConfiguration(configId);
      if (fixedPriceRecord) {
        detail.billingConfig.fixedPrice = {
          ...detail.billingConfig.fixedPrice,
          ...normalizeFixedPriceConfig(fixedPriceRecord),
        };
      }
    } catch (error) {
      console.warn("Unable to load fixed price configuration", error);
    }
  }

  if (detail.billingConfig?.billingType === "RECURRING" && configId) {
    try {
      const recurringRecord = await getBillingRecurringByBillingConfigurationId(configId);
      if (recurringRecord) {
        detail.billingConfig.recurring = {
          ...detail.billingConfig.recurring,
          ...normalizeRecurringConfig(recurringRecord),
        };
      }
    } catch (error) {
      console.warn("Unable to load recurring billing configuration", error);
    }
  }

  if (["STANDARD", "ROLE_BASED"].includes(detail.billingConfig?.pricingModel) && configId) {
    const rateCards = await getTmRateCardsByBillingConfiguration(configId);
    const normalizedRateCards = rateCards.map(normalizeTmRateCard);

    if (detail.billingConfig.pricingModel === "STANDARD") {
      const standardRate = normalizedRateCards.find((card) => !card.roleName) || normalizedRateCards[0];
      if (standardRate) {
        detail.billingConfig.timeAndMaterial = {
          ...(detail.billingConfig.timeAndMaterial || {}),
          rate: standardRate.rate,
          ratePeriod: standardRate.ratePeriod,
          effectiveFrom: standardRate.effectiveFrom,
          effectiveTo: standardRate.effectiveTo,
          rateCardId: standardRate.rateCardId,
          roles: [],
        };
      }
    } else {
      detail.billingConfig.timeAndMaterial = {
        ...(detail.billingConfig.timeAndMaterial || {}),
        roles: normalizedRateCards.filter((card) => card.roleName),
      };
    }
  }

  return {
    summary: normalized,
    detail,
  };
};

export const getApprovedConfigurationByProject = async (projectId) => {
  const response = await api.get(`${BILLING_CONFIGURATIONS_URL}/project/${projectId}`);
  return normalizeBillingConfiguration(unwrapData(response));
};

// Creating the parent Billing Configuration always goes through the /draft
// endpoint — the backend only ever creates configurations in Draft status.
// Updating an existing one splits by intent: a Save Draft is a PUT to
// /api/billing-configurations/{id}/draft (see updateBillingConfigurationDraft),
// while persisting a non-draft record's own fields is a PUT to
// /api/billing-configurations/{id} (see updateBillingConfiguration) — never a
// second POST. Neither of these ever changes approvalStatus — see
// submitBillingConfigurationForApproval below for the DRAFT -> PENDING_APPROVAL
// transition, which is the only thing that does.
export const createBillingConfiguration = async (payload) => {
  // [2] Immediately before POST /api/billing-configurations/draft.
  console.log("[billingConfigurationService] POST .../draft payload:", payload);
  const response = await api.post(`${BILLING_CONFIGURATIONS_URL}/draft`, payload);
  // [3] Complete draft API response.
  console.log("[billingConfigurationService] POST .../draft response:", response?.data);
  return unwrapData(response);
};

export const updateBillingConfiguration = async (billingConfigurationId, payload) => {
  const response = await api.put(`${BILLING_CONFIGURATIONS_URL}/${billingConfigurationId}`, payload);
  return unwrapData(response);
};

// Used to persist a Save Draft update on an existing billing configuration —
// persisting a non-draft record's own fields still goes through
// updateBillingConfiguration's plain PUT (see saveBillingConfiguration/
// saveBillingConfigurationRecord).
export const updateBillingConfigurationDraft = async (billingConfigurationId, payload) => {
  const response = await api.put(`${BILLING_CONFIGURATIONS_URL}/${billingConfigurationId}/draft`, payload);
  return unwrapData(response);
};

// PUT /api/billing-configurations/{id}/submit — the only action that moves a
// configuration from DRAFT to PENDING_APPROVAL. This is the Maker's "Submit
// for Approval" step; it never activates anything and never touches
// billingStatus. Approve/Reject (PENDING_APPROVAL -> APPROVED/REJECTED) are
// Finance Manager (Checker) actions and live in billingApprovalService.js —
// this Maker-side service must never call /approve, /reject, or the removed
// /activate endpoint.
export const submitBillingConfigurationForApproval = async (billingConfigurationId) => {
  const id = extractBillingConfigurationId(billingConfigurationId);
  if (!id) {
    return Promise.reject(new Error("Missing billingConfigurationId — unable to resolve an id from the provided value."));
  }

  const response = await api.put(`${BILLING_CONFIGURATIONS_URL}/${id}/submit`);
  return unwrapData(response);
};

export const rejectBillingConfiguration = async (billingConfigurationId, rejectionReason) => {
  const response = await api.put(`${BILLING_CONFIGURATIONS_URL}/${billingConfigurationId}/reject`, {
    rejectionReason,
  });
  return unwrapData(response);
};

// Deactivation is date-independent — it does not delete the record or touch
// approvalStatus, it just forces billingStatus back to INACTIVE (e.g. to stop
// billing on a still-approved, still-in-effective-period configuration).
export const deactivateBillingConfiguration = async (billingConfigurationId) => {
  const response = await api.patch(`${BILLING_CONFIGURATIONS_URL}/${billingConfigurationId}/deactivate`);
  return unwrapData(response);
};

export const deleteBillingConfiguration = async (billingConfigurationId) => {
  const response = await api.delete(`${BILLING_CONFIGURATIONS_URL}/${billingConfigurationId}`);
  return unwrapData(response);
};

export const getBillingConfigurationClients = async () => {
  const response = await api.get(`${BILLING_CONFIGURATIONS_URL}/clients`);
  return asArray(unwrapData(response)).map(normalizeClient);
};

export { getActiveBillingTypes, normalizeBillingType } from "./billingTypeService";
export { getActiveBillingFrequencies, normalizeBillingFrequency };
export { getActivePaymentTerms, normalizePaymentTerm };
export { getActiveTaxRegions, normalizeTaxRegion };

// A billing configuration only gets a recurring configuration record once one
// has been saved — selecting Recurring on a brand-new (or not-yet-saved)
// configuration means the backend has nothing to return yet, and answers with
// a 404 / "Recurring Configuration not found" rather than an empty body. That
// is an expected "nothing saved yet" signal, not a real failure, so callers
// must treat it as such (return null/[] silently) instead of surfacing it as
// an error toast and blocking the UI.
const isRecurringNotFoundError = (error) => {
  if (error?.response?.status === 404) return true;
  const message = String(
    error?.response?.data?.message || error?.response?.data?.detail || error?.response?.data?.error || "",
  );
  return /not found/i.test(message);
};

export const getBillingRecurringById = async (recurringConfigurationId) => {
  if (!recurringConfigurationId) return null;
  try {
    const response = await api.get(`${BILLING_RECURRING_URL}/${recurringConfigurationId}`);
    return unwrapData(response);
  } catch (error) {
    if (isRecurringNotFoundError(error)) return null;
    throw error;
  }
};

// GET .../billing-configuration/{billingConfigurationId} returns a list
// ("success": true, "data": [...]) even though only one recurring record is
// ever expected per billing configuration — same shape as
// getFixedPriceByBillingConfiguration above. Assuming a single-object
// response here silently discarded every array reply as an empty-looking
// record (normalizeRecurringConfig read undefined off the array itself),
// which is why Continue Draft never prefilled contract value/source or dates.
export const getBillingRecurringByBillingConfigurationId = async (billingConfigurationId) => {
  if (!billingConfigurationId) return null;
  try {
    const response = await api.get(`${BILLING_RECURRING_URL}/billing-configuration/${billingConfigurationId}`);
    const payload = unwrapData(response);
    const records = asArray(payload);

    if (records.length > 0) return records[0];

    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  } catch (error) {
    if (isRecurringNotFoundError(error)) return null;
    throw error;
  }
};

export const createBillingRecurring = async (billingConfigurationId, payload) => {
  const response = await api.post(`${BILLING_RECURRING_URL}/${billingConfigurationId}`, payload);
  return unwrapData(response);
};

export const updateBillingRecurring = async (recurringConfigurationId, payload) => {
  const response = await api.put(`${BILLING_RECURRING_URL}/${recurringConfigurationId}`, payload);
  return unwrapData(response);
};

export const deleteBillingRecurring = async (recurringConfigurationId) => {
  if (!recurringConfigurationId) throw new Error("Missing recurringConfigurationId");
  const response = await api.delete(`${BILLING_RECURRING_URL}/${recurringConfigurationId}`);
  return unwrapData(response);
};

// The backend-generated BillingSchedule is the sole source of truth for
// recurring billing periods and amounts — the frontend never computes these
// itself (see normalizeBillingSchedulePeriod below).
export const getBillingRecurringSchedule = async (recurringConfigurationId) => {
  if (!recurringConfigurationId) return [];
  try {
    const response = await api.get(`${BILLING_RECURRING_URL}/${recurringConfigurationId}/schedule`);
    return asArray(unwrapData(response)).map(normalizeBillingSchedulePeriod);
  } catch (error) {
    if (isRecurringNotFoundError(error)) return [];
    throw error;
  }
};

export const getBillingRecurringScheduleByBillingConfigurationId = async (billingConfigurationId) => {
  if (!billingConfigurationId) return [];
  try {
    const response = await api.get(
      `${BILLING_RECURRING_URL}/billing-configuration/${billingConfigurationId}/schedule`,
    );
    return asArray(unwrapData(response)).map(normalizeBillingSchedulePeriod);
  } catch (error) {
    if (isRecurringNotFoundError(error)) return [];
    throw error;
  }
};

// Maps a BillingSchedule API record onto the shape the "Billing Schedule
// (Preview)" table renders — a straight relabeling, nothing computed.
export const normalizeBillingSchedulePeriod = (record = {}) => ({
  periodNumber: firstPresent(record.periodNumber, record.index) ?? "",
  periodStartDate: toLocalDateString(firstPresent(record.periodStartDate, record.startDate)) || "",
  periodEndDate: toLocalDateString(firstPresent(record.periodEndDate, record.endDate)) || "",
  billingAmount: firstPresent(record.billingAmount, record.amount) ?? "",
  scheduleType: record.scheduleType || "",
  isPartialPeriod: Boolean(firstPresent(record.isPartialPeriod, record.partialPeriod, false)),
  periodStatus: record.periodStatus || "",
  isInvoiced: Boolean(firstPresent(record.isInvoiced, record.invoiced, false)),
  invoiceDate: toLocalDateString(record.invoiceDate) || "",
  remarks: record.remarks || "",
});

// Maps a BillingRecurringConfiguration API record (GET /api/billing-recurring/...)
// onto the wizard's internal Recurring Billing form-state shape (mirrors
// normalizeFixedPriceConfig above). The normal Recurring flow has no
// subscription/renewal concept — only the contract value, billing frequency,
// and effective dates that describe the recurring schedule — so those fields
// are never read into wizard state here.
//
// Field names mirror the backend's RecurringBillingRequestDto exactly
// (recurringConfigurationId/recurringStartDate/recurringEndDate) — the legacy
// subscriptionConfigurationId/subscriptionStartDate/subscriptionEndDate names
// are kept only as a fallback in case a record hasn't been migrated yet.
export const normalizeRecurringConfig = (record = {}) => ({
  recurringConfigurationId:
    firstPresent(record.recurringConfigurationId, record.subscriptionConfigurationId, record.id) || null,
  contractValueSource: record.contractValueSource || "",
  contractValue: firstPresent(record.contractValue, record.pmsProjectBudget) ?? "",
  pmsProjectBudget: firstPresent(record.pmsProjectBudget) ?? "",
  recurringStartDate:
    toLocalDateString(firstPresent(record.recurringStartDate, record.subscriptionStartDate, record.startDate)) || "",
  recurringEndDate:
    toLocalDateString(firstPresent(record.recurringEndDate, record.subscriptionEndDate, record.endDate)) || "",
  remarks: record.remarks || "",
});

export const getBillingConfigurationProjectsByClient = async (clientId) => {
  const response = await api.get(`${BILLING_CONFIGURATIONS_URL}/projects/${clientId}`);
  return asArray(unwrapData(response)).map(normalizeProject);
};

// --- Time & Material Rate Card APIs ---
export const getTmRateCardsByBillingConfiguration = async (billingConfigurationId) => {
  if (!billingConfigurationId) return [];
  const response = await api.get(`${TM_RATE_CARDS_URL}/${billingConfigurationId}/tm-rate-cards`);
  return asArray(unwrapData(response));
};

export const getTmRateCardById = async (rateCardId) => {
  if (!rateCardId) return null;
  const response = await api.get(`${TM_RATE_CARDS_URL}/tm-rate-cards/${rateCardId}`);
  return unwrapData(response);
};

export const createTmRateCard = async (billingConfigurationId, payload) => {
  if (!billingConfigurationId) throw new Error("Missing billingConfigurationId");
  const response = await api.post(`${TM_RATE_CARDS_URL}/${billingConfigurationId}/tm-rate-cards`, payload);
  return unwrapData(response);
};

export const updateTmRateCard = async (rateCardId, payload) => {
  if (!rateCardId) throw new Error("Missing rateCardId");
  const response = await api.put(`${TM_RATE_CARDS_URL}/tm-rate-cards/${rateCardId}`, payload);
  return unwrapData(response);
};

export const saveTmRateCard = async (billingConfigurationId, payload) => {
  if (!billingConfigurationId) throw new Error("Missing billingConfigurationId");
  const response = await api.post(`${TM_RATE_CARDS_URL}/${billingConfigurationId}/tm-rate-cards/save`, payload);
  return unwrapData(response);
};

export const deleteTmRateCard = async (rateCardId) => {
  if (!rateCardId) throw new Error("Missing rateCardId");
  const response = await api.delete(`${TM_RATE_CARDS_URL}/tm-rate-cards/${rateCardId}`);
  return unwrapData(response);
};

// --- Fixed Price Configuration APIs ---
// GET .../{billingConfigurationId}/fixed-price returns a list ("Fixed Price
// configurations fetched successfully.", data: [...]) even though only one
// active record is ever expected per billing configuration — a single-object
// response was assumed here, so every array reply was discarded as null. That
// silently hid the existing fixedPriceConfigurationId from callers (the wizard's
// edit-draft load and the Fixed Price form's own fetch), which made Save fall
// back to creating a duplicate record and made View Details show nothing.
export const getFixedPriceByBillingConfiguration = async (billingConfigurationId) => {
  if (!billingConfigurationId) return null;
  const response = await api.get(`${BILLING_FIXED_PRICE_URL}/${billingConfigurationId}/fixed-price`);
  const payload = unwrapData(response);
  const records = asArray(payload);

  if (records.length > 0) {
    return records.find((record) => record?.isActive !== false) || records[0];
  }

  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
};

export const getFixedPriceById = async (fixedPriceConfigurationId) => {
  if (!fixedPriceConfigurationId) return null;
  const response = await api.get(`${BILLING_FIXED_PRICE_URL}/fixed-price/${fixedPriceConfigurationId}`);
  return unwrapData(response);
};

export const createFixedPriceConfiguration = async (billingConfigurationId, payload) => {
  if (!billingConfigurationId) throw new Error("Missing billingConfigurationId");
  // [7] Immediately before POST /api/billing-fixed-price/{billingConfigurationId}/fixed-price.
  console.log("[billingConfigurationService] POST .../fixed-price:", billingConfigurationId, payload);
  const response = await api.post(`${BILLING_FIXED_PRICE_URL}/${billingConfigurationId}/fixed-price`, payload);
  return unwrapData(response);
};

export const updateFixedPriceConfiguration = async (fixedPriceConfigurationId, payload) => {
  if (!fixedPriceConfigurationId) throw new Error("Missing fixedPriceConfigurationId");
  const response = await api.put(`${BILLING_FIXED_PRICE_URL}/fixed-price/${fixedPriceConfigurationId}`, payload);
  return unwrapData(response);
};

export const deleteFixedPriceConfiguration = async (fixedPriceConfigurationId) => {
  if (!fixedPriceConfigurationId) throw new Error("Missing fixedPriceConfigurationId");
  const response = await api.delete(`${BILLING_FIXED_PRICE_URL}/fixed-price/${fixedPriceConfigurationId}`);
  return unwrapData(response);
};

// Builds the POST/PUT /api/billing-recurring request body — field names match
// the backend's RecurringBillingRequestDto exactly (recurringName/
// recurringStartDate/recurringEndDate, not the legacy subscription* names).
//
// billingFrequencyId is a required field on RecurringBillingRequestDto itself
// (backend: "Billing Frequency is required for recurring billing.") — the
// caller must pass the UUID of the Billing Frequency Master record the user
// selected (Monthly/Quarterly/Half-Yearly/Annual/custom), never a hardcoded
// value. It is also separately required on the parent BillingConfiguration
// record (see REQUIRED_BILLING_CONFIGURATION_FIELDS), but that does not make
// it optional here — both records need it.
//
// The normal Recurring Billing flow has no subscription/renewal concept — it
// is fully described by contract value/source, billing frequency, and
// effective dates, so recurringName and every renewal field are sent as null
// (optional/unset) rather than a value nothing in the UI ever collects.
export const buildRecurringRequestPayload = (recurring = {}, billingFrequencyId) => {
  const isPmsBudgetSource = recurring.contractValueSource === "PMS_BUDGET";

  return {
    contractValueSource: recurring.contractValueSource || null,
    contractValue: isBlank(recurring.contractValue) ? null : Number(recurring.contractValue),
    pmsProjectBudget: isPmsBudgetSource && !isBlank(recurring.pmsProjectBudget) ? Number(recurring.pmsProjectBudget) : null,
    billingFrequencyId: billingFrequencyId || null,
    recurringName: null,
    recurringStartDate: toLocalDateString(recurring.recurringStartDate) || "",
    recurringEndDate: toLocalDateString(recurring.recurringEndDate) || "",
    renewalType: null,
    renewalDurationType: null,
    renewalDurationValue: null,
    renewalDurationUnit: null,
    renewalPricingType: null,
    renewalContractValue: null,
    renewalBillingFrequencyId: null,
    renewalEffectiveFrom: null,
    remarks: recurring.remarks || "",
  };
};

const buildFixedPriceRequestPayload = (fixedPrice = {}) => ({
  // The backend field is "contractValue", not "totalContractValue" (that's only the
  // internal wizard state/form field name) — sending the wrong key left the backend
  // reading contractValue as null and rejecting with "Contract Value is required."
  contractValue: isBlank(fixedPrice.totalContractValue) ? null : Number(fixedPrice.totalContractValue),
  // contractValueSource is an optional enum — map the UI's "PMS"/"MANUAL" to the
  // backend's PMS_BUDGET/MANUAL values, sending null (not "" and not "PMS") when unset.
  contractValueSource: toApiContractValueSource(fixedPrice.contractValueSource),
  // Backend field is "retentionPercentage" (RetentionPercentDto), not
  // "retentionPercent" — that's only the internal form/state field name.
  retentionPercentage: isBlank(fixedPrice.retentionPercent) ? null : Number(fixedPrice.retentionPercent),
  advanceReceived: isBlank(fixedPrice.advanceReceived) ? null : Number(fixedPrice.advanceReceived),
  effectiveFrom: toLocalDateString(fixedPrice.effectiveFrom) || "",
  effectiveTo: toLocalDateString(fixedPrice.effectiveTo) || "",
  remarks: fixedPrice.remarks || "",
});

const REQUIRED_BILLING_CONFIGURATION_FIELDS = [
  "clientId",
  "projectId",
  "billingTypeId",
  "billingFrequencyId",
  "paymentTermId",
  "currency",
  "taxRegionId",
  "invoiceGenerationType",
  "pricingModel",
  "expenseBillingEligible",
  "effectiveFrom",
];

const isBlank = (value) => value === null || value === undefined || value === "";

const MONTH_INDEX_BY_SHORT_NAME = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const toLocalDateString = (value) => {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Jackson serializes java.time.LocalDate/LocalDateTime as a plain
  // [year, month, day, ...] array rather than an ISO string unless
  // WRITE_DATES_AS_TIMESTAMPS is disabled — seen live on effectiveFrom/
  // effectiveTo and recurringStartDate/recurringEndDate. Java's month here
  // is already 1-indexed, so it's used as-is (unlike JS Date.getMonth()).
  if (Array.isArray(value)) {
    const [year, month, day] = value;
    if (!year || !month || !day) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const rawValue = String(value).trim();
  if (!rawValue) return "";

  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const displayMatch = rawValue.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,})[-\s/](\d{4})$/);
  if (displayMatch) {
    const [, dayPart, monthPart, yearPart] = displayMatch;
    const monthIndex = MONTH_INDEX_BY_SHORT_NAME[monthPart.slice(0, 3).toLowerCase()];
    if (monthIndex !== undefined) {
      return `${yearPart}-${String(monthIndex + 1).padStart(2, "0")}-${String(Number(dayPart)).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeCurrencyCode = (...values) => {
  for (const value of values) {
    if (!value) continue;

    const code =
      typeof value === "object"
        ? value.projectBudgetCurrency || value.currencyCode || value.currency_code || value.code || value.value
        : value;
    const normalized = String(code || "").trim().toUpperCase();
    if (normalized) return normalized;
  }

  return "";
};

// Builds the plain BillingConfigurationRequestDto body — no status-transition
// fields belong here. Draft creation, Save Draft, the final "Create Billing
// Setup" save, TM rate-card saves, and Fixed Price saves all call this
// identically; the DRAFT -> PENDING_APPROVAL transition is a separate call to
// submitBillingConfigurationForApproval (PUT .../submit), never a flag on this
// payload.
export const buildBillingConfigurationRequestPayload = (wizardPayload = {}) => {
  const projectInfo = wizardPayload.projectInfo || {};
  const billingConfig = wizardPayload.billingConfig || {};
  const controls = wizardPayload.controls || {};
  const currency = normalizeCurrencyCode(
    projectInfo.projectBudgetCurrency,
    projectInfo.currency,
    billingConfig.currency,
    wizardPayload.currency,
  );
  // CurrencyMaster.currencyId is a UUID on the backend — this must be the real id
  // resolved against the currency master list (see NewConfigurationWizard's
  // currency-master effect, which stamps it onto projectInfo.currencyId), never a
  // fabricated number. If it isn't resolved yet, omit it rather than guess.
  const currencyId =
    wizardPayload.currencyId || projectInfo.currencyId || billingConfig.currencyId || null;

  const effectiveFrom = toLocalDateString(
    billingConfig.effectiveFrom ||
      wizardPayload.effectiveFrom ||
      projectInfo.startDate,
  );
  const effectiveTo = toLocalDateString(
    billingConfig.effectiveTo ||
      wizardPayload.effectiveTo ||
      projectInfo.endDate,
  );

  // pricingModel on /api/billing-configurations maps to the backend PricingModel
  // enum (STANDARD / ROLE_BASED), which is only meaningful for Time & Material
  // billing. Fixed Price (and every other billing type) must never send it —
  // Recurring's own mode is a separate concept (recurringMode) submitted to the
  // billing-recurring endpoint via buildRecurringRequestPayload, not this field.
  const billingType = billingConfig.billingType || wizardPayload.billingType || "";
  const pricingModel =
    billingType === "TIME_MATERIAL"
      ? billingConfig.billingMode || billingConfig.pricingModel || wizardPayload.pricingModel || ""
      : "";

  const requestPayload = {
    clientId: projectInfo.clientId || wizardPayload.clientId || "",
    projectId: projectInfo.projectId || wizardPayload.projectId || "",
    projectCode: projectInfo.projectCode || wizardPayload.projectCode || "",
    billingTypeId: billingConfig.billingTypeId || wizardPayload.billingTypeId || "",
    billingFrequencyId: billingConfig.billingFrequencyId || wizardPayload.billingFrequencyId || "",
    paymentTermId: controls.paymentTermId || wizardPayload.paymentTermId || "",
    currency,
    currencyId,
    currencyCode: currency,
    taxRegionId: controls.taxRegionId || wizardPayload.taxRegionId || "",
    invoiceGenerationType:
      controls.invoiceGenerationType ||
      wizardPayload.invoiceGenerationType ||
      (controls.autoInvoiceGeneration === true ? "AUTOMATIC" : "MANUAL"),
    pricingModel: pricingModel || null,
    expenseBillingEligible:
      controls.expenseBillingEligible ?? wizardPayload.expenseBillingEligible ?? false,
    effectiveFrom,
  };

  if (effectiveTo) {
    requestPayload.effectiveTo = effectiveTo;
  }

  return requestPayload;
};

// eslint-disable-next-line no-unused-vars
const assertBillingConfigurationPayload = (_payload) => {
  // Validation temporarily disabled
};

// Creates the parent billing configuration only, without saveBillingConfiguration's
// full-draft side effects (e.g. saveTmRateCards, which bulk-syncs and deletes any TM
// rate cards absent from the current wizard state). Used when a rate-card save needs
// a billingConfigurationId to exist but must not touch other rate card rows.
export const ensureBillingConfigurationDraft = async (payload) => {
  const requestPayload = buildBillingConfigurationRequestPayload(payload);
  assertBillingConfigurationPayload(requestPayload);
  const configResponse = await createBillingConfiguration(requestPayload);
  const extractedId = extractBillingConfigurationId(configResponse);
  // [4] Extracted billingConfigurationId from the (already unwrapped) ApiResponse data.
  console.log("[billingConfigurationService] extracted billingConfigurationId:", extractedId);
  return extractedId;
};

const buildTmRateCardRequestPayload = (card = {}, pricingModel, billingConfigurationId) => ({
  billingConfigurationId,
  roleName: pricingModel === "ROLE_BASED" ? String(card.roleName || card.role || "").trim() : null,
  rate: card.rate ?? "",
  ratePeriod: normalizeBillingFrequencyValue(card.ratePeriod) || "HOURLY",
  effectiveFrom: toLocalDateString(card.effectiveFrom) || "",
  effectiveTo: toLocalDateString(card.effectiveTo) || "",
  remarks: "",
});

const buildTmRateCardRequests = (payload = {}, billingConfigurationId) => {
  const billingConfig = payload.billingConfig || {};
  const pricingModel = normalizePricingModelValue(billingConfig.billingMode || billingConfig.pricingModel);
  const timeAndMaterial = billingConfig.timeAndMaterial || {};

  if (billingConfig.billingType !== "TIME_MATERIAL" || !["STANDARD", "ROLE_BASED"].includes(pricingModel)) {
    return [];
  }

  if (pricingModel === "STANDARD") {
    return [
      {
        rateCardId: timeAndMaterial.rateCardId || null,
        payload: buildTmRateCardRequestPayload(timeAndMaterial, pricingModel, billingConfigurationId),
      },
    ];
  }

  const seenRoleNames = new Set();
  return (timeAndMaterial.roles || []).map((card) => {
    const roleName = String(card.roleName || card.role || "").trim();
    if (!roleName) throw new Error("Role name is required for role-based TM rate cards.");

    const uniqueKey = roleName.toLowerCase();
    if (seenRoleNames.has(uniqueKey)) {
      throw new Error(`Duplicate role name in TM rate cards: ${roleName}`);
    }
    seenRoleNames.add(uniqueKey);

    return {
      rateCardId: card.rateCardId || card.tmRateCardId || card.id || null,
      roleName,
      payload: buildTmRateCardRequestPayload({ ...card, roleName }, pricingModel, billingConfigurationId),
    };
  });
};

const saveTmRateCards = async (payload, billingConfigurationId) => {
  const requests = buildTmRateCardRequests(payload, billingConfigurationId);
  if (requests.length === 0) return;

  const billingConfig = payload.billingConfig || {};
  const pricingModel = normalizePricingModelValue(billingConfig.billingMode || billingConfig.pricingModel);
  const existingCards = (await getTmRateCardsByBillingConfiguration(billingConfigurationId)).map(normalizeTmRateCard);
  const touchedIds = new Set();

  for (const request of requests) {
    const matchingExisting =
      existingCards.find((card) => request.rateCardId && String(card.rateCardId) === String(request.rateCardId)) ||
      (pricingModel === "STANDARD"
        ? existingCards[0]
        : existingCards.find((card) => card.roleName.toLowerCase() === request.roleName.toLowerCase()));

    const saved = matchingExisting?.rateCardId
      ? await updateTmRateCard(matchingExisting.rateCardId, request.payload)
      : await createTmRateCard(billingConfigurationId, request.payload);
    const savedId = getTmRateCardId(saved) || matchingExisting?.rateCardId;
    if (savedId) touchedIds.add(String(savedId));
  }

  await Promise.all(
    existingCards
      .filter((card) => card.rateCardId && !touchedIds.has(String(card.rateCardId)))
      .map((card) => deleteTmRateCard(card.rateCardId)),
  );
};

// options.isDraftSave (default true) picks which endpoint persists the
// record: true -> PUT .../draft (Save Draft, still a work-in-progress DRAFT
// record), false -> plain PUT .../{id} (persisting a record that is being
// finalized or that is already past DRAFT). This never changes approvalStatus
// itself — call submitBillingConfigurationForApproval separately for that.
export const saveBillingConfiguration = async (payload, billingConfigurationId, options = {}) => {
  const requestPayload = buildBillingConfigurationRequestPayload(payload);
  assertBillingConfigurationPayload(requestPayload);

  const configResponse = billingConfigurationId
    ? options.isDraftSave === false
      ? await updateBillingConfiguration(billingConfigurationId, requestPayload)
      : await updateBillingConfigurationDraft(billingConfigurationId, requestPayload)
    : await createBillingConfiguration(requestPayload);

  const configId =
    extractBillingConfigurationId(billingConfigurationId) ||
    extractBillingConfigurationId(configResponse);
  const billingType = payload?.billingConfig?.billingType || configResponse?.billingType || "";

  if (configId && billingType === "TIME_MATERIAL") {
    await saveTmRateCards(payload, configId);
  }

  if (configId && billingType === "RECURRING") {
    try {
      const existingRecurring = await getBillingRecurringByBillingConfigurationId(configId);
      const recurringPayload = buildRecurringRequestPayload(
        payload?.billingConfig?.recurring,
        payload?.billingConfig?.billingFrequencyId,
      );
      if (existingRecurring) {
        await updateBillingRecurring(
          existingRecurring.recurringConfigurationId || existingRecurring.subscriptionConfigurationId || existingRecurring.id,
          recurringPayload,
        );
      } else {
        await createBillingRecurring(configId, recurringPayload);
      }
    } catch (error) {
      console.warn("Unable to save recurring billing configuration", error);
    }
  }

  if (configId && billingType === "FIXED_PRICE") {
    try {
      const existingFixedPrice = await getFixedPriceByBillingConfiguration(configId);
      const fixedPricePayload = buildFixedPriceRequestPayload(payload?.billingConfig?.fixedPrice);
      if (existingFixedPrice) {
        const existingId = existingFixedPrice.fixedPriceConfigurationId || existingFixedPrice.id;
        await updateFixedPriceConfiguration(existingId, fixedPricePayload);
      } else {
        await createFixedPriceConfiguration(configId, fixedPricePayload);
      }
    } catch (error) {
      console.warn("Unable to save fixed price configuration", error);
    }
  }

  return configResponse;
};

// Persists only the Billing Configuration record itself (POST when creating, PUT
// when updating) — no Fixed Price / TM rate card / subscription side effects and
// no submit/approve call. Fixed Price details are saved independently and
// immediately by the "Save Fixed Price Details" button (see
// FixedPriceForm.saveFixedPriceConfig), so the Fixed Price create flow's final
// submit only needs to persist this record (the caller submits for approval
// separately — see submitBillingConfigurationForApproval). See
// saveBillingConfiguration above for what options.isDraftSave selects.
export const saveBillingConfigurationRecord = async (wizardPayload, billingConfigurationId, options = {}) => {
  const requestPayload = buildBillingConfigurationRequestPayload(wizardPayload);
  const configResponse = billingConfigurationId
    ? options.isDraftSave === false
      ? await updateBillingConfiguration(billingConfigurationId, requestPayload)
      : await updateBillingConfigurationDraft(billingConfigurationId, requestPayload)
    : await createBillingConfiguration(requestPayload);

  const configId =
    extractBillingConfigurationId(billingConfigurationId) ||
    extractBillingConfigurationId(configResponse);

  return { configResponse, configId };
};

export const getBillingConfigurationStats = async () => {
  const configurations = await getBillingConfigurations();

  return {
    total: configurations.length,
    active: configurations.filter(
      (config) => config.billingStatus === "ACTIVE",
    ).length,
    inactive: configurations.filter(
      (config) => config.billingStatus === "INACTIVE",
    ).length,
    approved: configurations.filter((config) => config.approvalStatus === "APPROVED").length,
    draft: configurations.filter((config) => config.approvalStatus === "DRAFT").length,
    pending: configurations.filter((config) => config.approvalStatus === "PENDING_APPROVAL").length,
    rejected: configurations.filter((config) => config.approvalStatus === "REJECTED").length,
    integrated: configurations.filter((config) => config.setupMode === "EXISTING").length,
    manual: configurations.filter((config) => config.setupMode === "STANDALONE").length,
    toolBillingEnabled: configurations.filter((config) => config.toolBillingEnabled).length,
  };
};

export const getBillingConfigurationActivity = async () => {
  const configurations = await getBillingConfigurations();

  return configurations
    .filter((config) => config.lastUpdated)
    .slice(0, 6)
    .map((config) => ({
      configId: config.id,
      action: `${config.approvalStatusLabel} Configuration`,
      user: config.updatedBy || "System",
      time: config.lastUpdated,
    }));
};
