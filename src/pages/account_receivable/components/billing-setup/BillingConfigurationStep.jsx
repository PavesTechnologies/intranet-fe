import { useEffect, useRef, useState } from "react";
import { Check, Plus, Pencil, Trash2, Loader2, Landmark } from "lucide-react";

import FormInput from "../../../../components/forms/FormInput";
import FormSelect from "../../../../components/forms/FormSelect";
import FormDatePicker from "../../../../components/forms/FormDatePicker";
import FormTextArea from "../../../../components/forms/FormTextArea";
import Button from "../../../../components/Button/Button";
import ARTable from "../common/ARTable";
import Modal from "../../../../components/Modal/modal";
import ConfirmationModal from "../../../../components/confirmation_modal/ConfirmationModal";
import StatusBadge from "../../../../components/status/statusbadge";
import { Fonts } from "../../../../components/Fonts/Fonts";
import { showStatusToast } from "../../../../components/toastfy/toast";
import RadioCardGroup from "../common/RadioCardGroup";
import ToggleSwitch from "../common/ToggleSwitch";
import {
  MILESTONE_STATUS_OPTIONS,
  CURRENCY_OPTIONS,
  CONTRACT_VALUE_SOURCE_OPTIONS,
} from "../../data/wizardOptions";
import { formatCurrency, formatDisplayDate } from "../../utils/format";
import { getBillingTypeDisplayName } from "../../utils/billingType";
import { getRecurringDateErrors, hasRecurringDateErrors, toDateOnly } from "../../utils/recurringBillingSchedule";
import {
  getActiveBillingTypes,
  getActiveBillingFrequencies,
  getTmRateCardsByBillingConfiguration,
  saveTmRateCard,
  deleteTmRateCard,
  getApiErrorMessage,
  getFixedPriceByBillingConfiguration,
  createFixedPriceConfiguration,
  updateFixedPriceConfiguration,
  deleteFixedPriceConfiguration,
  toApiContractValueSource,
  formatBillingFrequencyLabel,
  getBillingRecurringByBillingConfigurationId,
  createBillingRecurring,
  updateBillingRecurring,
  deleteBillingRecurring,
  normalizeRecurringConfig,
  buildRecurringRequestPayload,
  getBillingRecurringSchedule,
  getBillingRecurringScheduleByBillingConfigurationId,
} from "../../services/billingConfigurationService";

let milestoneSeq = 0;
function nextMilestoneId() {
  milestoneSeq += 1;
  return `MS-NEW-${milestoneSeq}`;
}

// Recurring billing has no Pricing Model concept anymore — the Billing
// Frequency (durationValue + durationUnit) alone determines the recurring
// period, so RECURRING intentionally returns no options here (see
// RecurringBillingForm).
function getPricingModelOptions(billingType) {
  switch (billingType) {
    case "TIME_MATERIAL":
      return [
        { value: "STANDARD", label: "Standard Rate", description: "One hourly rate applies to all approved billable hours." },
        { value: "ROLE_BASED", label: "Role-Based Rates", description: "Different hourly rates are maintained for each project role." },
      ];
    default:
      return [];
  }
}

// Half-Yearly is offered for Recurring and Fixed Price (see
// getBillingFrequencyOptions); display order is fixed regardless of backend order.
const BILLING_FREQUENCY_ORDER = [
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUALLY",
];
// Fixed Price is the only billing type that can be settled as a single lump sum,
// so One-Time is offered there and nowhere else.
const FIXED_PRICE_FREQUENCY_ORDER = [
  "ONE_TIME",
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUALLY",
];
const BILLING_TYPE_ORDER = [
  "TIME_MATERIAL",
  "MILESTONE",
  "FIXED_PRICE",
  "RECURRING",
];

function sortByOrder(options, order, key = "value") {
  const getKey = typeof key === "function" ? key : (item) => item[key];
  return [...options].sort((a, b) => {
    const aIndex = order.indexOf(getKey(a));
    const bIndex = order.indexOf(getKey(b));
    return (
      (aIndex === -1 ? order.length : aIndex) -
      (bIndex === -1 ? order.length : bIndex)
    );
  });
}

// Billing Frequency options come back from the master-data API with `value`
// set to the record's database UUID (see normalizeBillingFrequency), not a
// semantic code — sorting/filtering against BILLING_FREQUENCY_ORDER (or the
// "ONE_TIME"/"HALF_YEARLY" literals below) by `.value` would never match
// anything. Derive a stable code from the display label instead
// ("Bi-Weekly" -> "BI_WEEKLY") so both the fixed display order and the
// One-Time/Half-Yearly exclusions actually take effect.
const frequencyCode = (option) =>
  String(option?.label || option?.billingFrequencyName || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

function getBillingFrequencyOptions(billingType, frequencies = []) {
  if (billingType === "RECURRING") {
    // Recurring supports every active cadence the backend returns (Monthly,
    // Quarterly, Half-Yearly, Annual, or any future frequency) — only
    // One-Time is excluded, since that's a single lump sum with no recurring
    // schedule and only ever applies to Fixed Price.
    return sortByOrder(
      frequencies.filter((option) => frequencyCode(option) !== "ONE_TIME"),
      BILLING_FREQUENCY_ORDER,
      frequencyCode,
    );
  }

  if (billingType === "FIXED_PRICE") {
    return sortByOrder(frequencies, FIXED_PRICE_FREQUENCY_ORDER, frequencyCode);
  }

  // One-Time and Half-Yearly only make sense against Fixed Price/Recurring, so
  // every other billing type (T&M, Milestone) never offers them, even if master
  // data does.
  return sortByOrder(
    frequencies.filter(
      (option) => !["ONE_TIME", "HALF_YEARLY"].includes(frequencyCode(option)),
    ),
    BILLING_FREQUENCY_ORDER,
    frequencyCode,
  );
}

const RATE_PERIOD_OPTIONS = [
  { value: "HOURLY", label: "Hourly" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
];

// Effective From/To only ever apply to recurring billing frequencies — a
// One-Time configuration is settled as a single lump sum with no schedule, so
// it carries no date range at all (see FixedPriceForm/TimeAndMaterialForm).
const isOneTimeFrequency = (billingFrequency) => billingFrequency === "ONE_TIME";

// Dates are plain yyyy-mm-dd strings (native <input type="date"> values, and
// project startDate/endDate are normalized to the same format), so lexical
// comparison is equivalent to chronological comparison — no Date parsing needed.
function getEffectiveDateErrors({ effectiveFrom, effectiveTo, projectStartDate, projectEndDate }) {
  const errors = { effectiveFrom: "", effectiveTo: "" };

  if (effectiveFrom && projectStartDate && effectiveFrom < projectStartDate) {
    errors.effectiveFrom = `Effective From cannot be before the project start date (${projectStartDate}).`;
  } else if (effectiveFrom && projectEndDate && effectiveFrom > projectEndDate) {
    errors.effectiveFrom = `Effective From cannot be after the project end date (${projectEndDate}).`;
  }

  if (effectiveTo && projectEndDate && effectiveTo > projectEndDate) {
    errors.effectiveTo = `Effective To cannot be after the project end date (${projectEndDate}).`;
  } else if (effectiveTo && projectStartDate && effectiveTo < projectStartDate) {
    errors.effectiveTo = `Effective To cannot be before the project start date (${projectStartDate}).`;
  }

  if (!errors.effectiveTo && effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
    errors.effectiveTo = "Effective To must be on or after Effective From.";
  }

  return errors;
}

const hasEffectiveDateErrors = (errors) => Boolean(errors?.effectiveFrom || errors?.effectiveTo);

const EMPTY_RATE_CARD = {
  role: "",
  roleName: "",
  rate: "",
  ratePeriod: "HOURLY",
  effectiveFrom: "",
  effectiveTo: "",
  rateCardId: null,
  isSaved: false,
};

const mapRateCard = (card = {}, includeRole = true) => ({
  ...(includeRole
    ? { role: card.roleName || card.role || card.name || "" }
    : {}),
  roleName: card.roleName || card.role || card.name || "",
  rate: card.rate ?? card.amount ?? "",
  ratePeriod: card.ratePeriod || card.period || "HOURLY",
  effectiveFrom: card.effectiveFrom || card.validFrom || "",
  effectiveTo: card.effectiveTo || card.validTo || "",
  rateCardId: card.id || card.rateCardId || card.tmRateCardId || null,
  isSaved: Boolean(card.id || card.rateCardId || card.tmRateCardId),
});

function normalizeBillingType(type) {
  const name = String(type?.billingTypeName || "").trim();

  let value = "";

  switch (name.toLowerCase()) {
    case "fixed price":
      value = "FIXED_PRICE";
      break;

    case "timesheet based":
    case "time and material":
    case "time & material":
      value = "TIME_MATERIAL";
      break;

    case "milestone based":
      value = "MILESTONE";
      break;

    case "subscription":
    case "recurring":
      value = "RECURRING";
      break;

    default:
      value = "";
  }

  return {
    ...type,
    value,
    label: value === "RECURRING" ? "Recurring" : getBillingTypeDisplayName(name),
    billingTypeId: type.billingTypeId,
  };
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function PillSelectGroup({ name, options, value, onChange, disabled = false }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = String(value) === String(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange?.(option.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A0082]/30 ${
              isSelected
                ? "border-[#0A0082] bg-[#0A0082]/5 text-[#0A0082]"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PmsSyncedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
      Synced from PMS
    </span>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-center min-h-[72px]">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-base font-bold text-slate-900 mt-1">
        {value || "—"}
      </span>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return <FormInput label={label} value={value || "—"} disabled onChange={() => { }} />;
}

function BillingSummaryHeader({ projectInfo }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        label="Billing Type"
        value={BILLING_TYPE_LABELS[projectInfo.billingType] || projectInfo.billingType}
      />
      <SummaryCard
        label="Billing Mode"
        value={BILLING_MODE_LABELS[projectInfo.billingMode] || projectInfo.billingMode}
      />
      <SummaryCard label="Billing Frequency" value={frequencyLabel(projectInfo.billingFrequency)} />
      <SummaryCard label="Currency" value={projectInfo.currency} />
    </div>
  );
}

function TimeAndMaterialForm({
  value = {},
  onChange,
  billingMode,
  currency,
  isExisting,
  billingConfigurationId,
  ensureBillingConfigurationId,
  billingConfigurationPayload,
  billingFrequency,
  projectStartDate,
  projectEndDate,
}) {
  const update = (patch) => onChange({ ...value, ...patch });
  const isOneTime = isOneTimeFrequency(billingFrequency);
  const standardRate = {
    ...EMPTY_RATE_CARD,
    rate: value.rate || "",
    ratePeriod: value.ratePeriod || "HOURLY",
    effectiveFrom: value.effectiveFrom || "",
    effectiveTo: value.effectiveTo || "",
    rateCardId: value.rateCardId || null,
    isSaved: Boolean(value.rateCardId),
  };
  // Effective From/To on Timesheet-based (Time & Material) rates are never
  // bound to the project's own start/end date — that constraint only applies
  // to Recurring billing (see RecurringBillingForm). projectStartDate/
  // projectEndDate are intentionally omitted here so getEffectiveDateErrors
  // only enforces From <= To, not the project date range.
  const standardDateErrors = isOneTime
    ? { effectiveFrom: "", effectiveTo: "" }
    : getEffectiveDateErrors({
        effectiveFrom: standardRate.effectiveFrom,
        effectiveTo: standardRate.effectiveTo,
      });

  const [rows, setRows] = useState(() =>
    (value.roles || []).map((r) => mapRateCard(r)),
  );
  const [loadingRows, setLoadingRows] = useState(false);
  // Tracks which pricing modes have already been hydrated from the server for this
  // billing configuration, so a later Save Draft (which assigns billingConfigurationId
  // for the first time) doesn't re-fetch and clobber rows the user is mid-editing.
  const loadedModesRef = useRef(new Set());

  const syncParent = (nextRows) => {
    setRows(nextRows);
    onChange({
      ...value,
      roles: nextRows.map(
        ({
          role,
          roleName,
          rate,
          ratePeriod,
          effectiveFrom,
          effectiveTo,
          rateCardId,
        }) => ({
          role,
          roleName: roleName || role,
          rate,
          ratePeriod,
          effectiveFrom,
          effectiveTo,
          rateCardId,
        }),
      ),
    });
  };

  const handleRoleChange = (index, field, val) => {
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      [field]: val,
      ...(field === "role" ? { roleName: val } : {}),
    };
    syncParent(updated);
  };

  const addRole = () => {
    const updated = [...rows, { ...EMPTY_RATE_CARD }];
    syncParent(updated);
  };

  const removeRole = async (index) => {
    const target = rows[index];
    if (!target?.rateCardId) {
      syncParent(rows.filter((_, i) => i !== index));
      return;
    }

    try {
      const confirmed = window.confirm(
        "Remove this rate card? This cannot be undone.",
      );
      if (!confirmed) return;
      const deletingRows = [...rows];
      deletingRows[index] = { ...deletingRows[index], deleting: true };
      setRows(deletingRows);

      await deleteTmRateCard(target.rateCardId);
      showStatusToast("Rate card removed", "success");
      syncParent(rows.filter((_, i) => i !== index));
    } catch (error) {
      showStatusToast(
        getApiErrorMessage(error, "Unable to remove rate card"),
        "error",
      );
      setRows((prev) =>
        prev.map((r, i) => (i === index ? { ...r, deleting: false } : r)),
      );
    }
  };

  // A One-Time frequency has no schedule, so any previously entered effective
  // dates are stale the moment the frequency switches to it — clear them from
  // state (not just the hidden UI) so a stale date never reaches the payload.
  useEffect(() => {
    if (!isOneTime) return;
    if (standardRate.effectiveFrom || standardRate.effectiveTo) {
      update({ effectiveFrom: "", effectiveTo: "" });
    }
    if (rows.some((row) => row.effectiveFrom || row.effectiveTo)) {
      syncParent(rows.map((row) => ({ ...row, effectiveFrom: "", effectiveTo: "" })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOneTime]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!["STANDARD", "ROLE_BASED"].includes(billingMode)) return;
      if (!billingConfigurationId) return;
      if (loadedModesRef.current.has(billingMode)) return;
      loadedModesRef.current.add(billingMode);

      setLoadingRows(true);
      try {
        const cards = await getTmRateCardsByBillingConfiguration(
          billingConfigurationId,
        );
        if (!mounted) return;
        const mapped = (cards || []).map((card) => mapRateCard(card));

        if (billingMode === "STANDARD") {
          const commonRate = mapped.find((card) => !card.role) || mapped[0];
          if (commonRate) {
            update(mapRateCard(commonRate, false));
          }
          return;
        }

        const roleRates = mapped.filter((card) => card.role);
        syncParent(roleRates.length > 0 ? roleRates : rows);
      } catch (error) {
        showStatusToast(
          getApiErrorMessage(error, "Unable to load rate cards."),
          "error",
        );
      } finally {
        if (mounted) setLoadingRows(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [billingMode, billingConfigurationId]);

  const buildTmRateCardPayload = (row, billingConfigurationId) => {
    const payload = {
      rateCardId: row.rateCardId || null,
      billingConfigurationId,
      roleName:
        billingMode === "ROLE_BASED"
          ? String(row.roleName || row.role || "").trim()
          : null,
      rate: row.rate || "",
      ratePeriod: row.ratePeriod || "HOURLY",
      effectiveFrom: row.effectiveFrom || "",
      effectiveTo: row.effectiveTo || "",
      remarks: "",
    };
    return payload;
  };

  const saveStandardRate = async () => {
    if (!isOneTime && hasEffectiveDateErrors(standardDateErrors)) {
      showStatusToast("Please fix the highlighted Effective From/To errors before saving.", "error");
      return;
    }

    update({ ...standardRate, saving: true });

    let resolvedConfigId = billingConfigurationId;
    try {
      if (!resolvedConfigId) {
        resolvedConfigId = await ensureBillingConfigurationId?.(
          billingConfigurationPayload,
        );
      }
      if (!resolvedConfigId) {
        showStatusToast(
          "Unable to save rate card: billing configuration id is missing.",
          "error",
        );
        update({ ...standardRate, saving: false });
        return;
      }

      const payload = buildTmRateCardPayload(standardRate, resolvedConfigId);
      const saved = await saveTmRateCard(resolvedConfigId, payload);

      update(mapRateCard(saved, false));
      showStatusToast("Rate card saved", "success");
    } catch (error) {
      showStatusToast(
        getApiErrorMessage(error, "Unable to save rate card."),
        "error",
      );
      update({ ...standardRate, saving: false });
    }
  };

  const saveRow = async (index) => {
    const row = rows[index];
    if (!row) return;

    const roleName = String(row.roleName || row.role || "").trim();
    if (!roleName) {
      showStatusToast(
        "Role name is required for role-based rate cards.",
        "error",
      );
      return;
    }
    const duplicateRole = rows.some(
      (item, itemIndex) =>
        itemIndex !== index &&
        String(item.roleName || item.role || "")
          .trim()
          .toLowerCase() === roleName.toLowerCase(),
    );
    if (duplicateRole) {
      showStatusToast(
        "Role names must be unique for role-based rate cards.",
        "error",
      );
      return;
    }
    if (
      !isOneTime &&
      hasEffectiveDateErrors(
        getEffectiveDateErrors({
          effectiveFrom: row.effectiveFrom,
          effectiveTo: row.effectiveTo,
        }),
      )
    ) {
      showStatusToast("Please fix the highlighted Effective From/To errors before saving.", "error");
      return;
    }

    const updating = [...rows];
    updating[index] = { ...updating[index], saving: true };
    setRows(updating);

    try {
      let resolvedConfigId = billingConfigurationId;
      if (!resolvedConfigId) {
        resolvedConfigId = await ensureBillingConfigurationId?.(
          billingConfigurationPayload,
        );
      }
      if (!resolvedConfigId) {
        showStatusToast(
          "Unable to save rate card: billing configuration id is missing.",
          "error",
        );
        setRows((prev) =>
          prev.map((r, i) => (i === index ? { ...r, saving: false } : r)),
        );
        return;
      }

      const payload = buildTmRateCardPayload(
        { ...row, roleName },
        resolvedConfigId,
      );
      const saved = await saveTmRateCard(resolvedConfigId, payload);

      const mapped = {
        ...mapRateCard(saved),
        role: saved.roleName || saved.role || saved.name || row.role,
        roleName,
      };

      const newRows = [...rows];
      newRows[index] = mapped;
      syncParent(newRows);
      showStatusToast("Rate card saved", "success");
    } catch (error) {
      showStatusToast(
        getApiErrorMessage(error, "Unable to save rate card."),
        "error",
      );
      setRows((prev) =>
        prev.map((r, i) => (i === index ? { ...r, saving: false } : r)),
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 p-4">
        {billingMode === "STANDARD" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput
              label={`Rate (${currency}) *`}
              name="rate"
              type="number"
              value={standardRate.rate}
              onChange={(event) => update({ rate: event.target.value })}
              placeholder={`e.g. 1800 (${currency})`}
              disabled={isExisting}
            />
            <FormSelect
              label="Rate Period *"
              name="ratePeriod"
              value={standardRate.ratePeriod}
              onChange={(event) => update({ ratePeriod: event.target.value })}
              options={RATE_PERIOD_OPTIONS}
            />
            {!isOneTime && (
              <>
                <FormDatePicker
                  label="Effective From"
                  name="effectiveFrom"
                  value={standardRate.effectiveFrom}
                  onChange={(event) =>
                    update({ effectiveFrom: event.target.value })
                  }
                  error={standardDateErrors.effectiveFrom}
                />
                <FormDatePicker
                  label="Effective To"
                  name="effectiveTo"
                  value={standardRate.effectiveTo}
                  onChange={(event) => update({ effectiveTo: event.target.value })}
                  error={standardDateErrors.effectiveTo}
                />
              </>
            )}
            {!isExisting && (
              <div className="md:col-span-2">
                <Button
                  variant="outline"
                  size="small"
                  onClick={saveStandardRate}
                  loading={Boolean(standardRate.saving)}
                  loadingText="Saving..."
                >
                  <Check className="h-4 w-4" /> Save Rate Card
                </Button>
              </div>
            )}
          </div>
        )}

        {billingMode === "ROLE_BASED" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">
                Role-Based Rates
              </h4>
              {!isExisting && (
                <Button variant="outline" size="small" onClick={addRole}>
                  <Plus className="h-3.5 w-3.5" /> Add Role
                </Button>
              )}
            </div>

            {loadingRows ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : null}

            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-500">
                No roles added yet.
              </p>
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Role</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Rate ({currency})</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Rate Period</th>
                      {!isOneTime && (
                        <>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">Effective From</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">Effective To</th>
                        </>
                      )}
                      {!isExisting && (
                        <th className="px-4 py-3 text-center w-24 font-semibold text-slate-600">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map((item, index) => {
                      const roleDateErrors = isOneTime
                        ? { effectiveFrom: "", effectiveTo: "" }
                        : getEffectiveDateErrors({
                            effectiveFrom: item.effectiveFrom,
                            effectiveTo: item.effectiveTo,
                          });
                      return (
                      <tr
                        key={index}
                        className="align-top transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 min-w-[160px]">
                          <FormInput
                            value={item.role}
                            onChange={(e) =>
                              handleRoleChange(index, "role", e.target.value)
                            }
                            placeholder="e.g. Senior Developer"
                            disabled={isExisting}
                          />
                        </td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <FormInput
                            type="number"
                            value={item.rate}
                            onChange={(e) =>
                              handleRoleChange(index, "rate", e.target.value)
                            }
                            placeholder="e.g. 1500"
                            disabled={isExisting}
                          />
                        </td>
                        <td className="px-4 py-3 min-w-[170px]">
                          <FormSelect
                            value={item.ratePeriod || "HOURLY"}
                            onChange={(e) =>
                              handleRoleChange(
                                index,
                                "ratePeriod",
                                e.target.value,
                              )
                            }
                            options={RATE_PERIOD_OPTIONS}
                            anchorOptions
                          />
                        </td>
                        {!isOneTime && (
                          <>
                            <td className="px-4 py-3 min-w-[160px]">
                              <FormDatePicker
                                value={item.effectiveFrom}
                                onChange={(e) =>
                                  handleRoleChange(
                                    index,
                                    "effectiveFrom",
                                    e.target.value,
                                  )
                                }
                                error={roleDateErrors.effectiveFrom}
                              />
                            </td>
                            <td className="px-4 py-3 min-w-[160px]">
                              <FormDatePicker
                                value={item.effectiveTo}
                                onChange={(e) =>
                                  handleRoleChange(
                                    index,
                                    "effectiveTo",
                                    e.target.value,
                                  )
                                }
                                error={roleDateErrors.effectiveTo}
                              />
                            </td>
                          </>
                        )}
                        {!isExisting && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => saveRow(index)}
                                disabled={item.saving || item.deleting}
                                className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Save rate"
                              >
                                {item.saving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRole(index)}
                                disabled={item.saving || item.deleting}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Remove role"
                              >
                                {item.deleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ContractValueSourceBadge({ source }) {
  if (source === "MANUAL") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
        Manually adjusted
      </span>
    );
  }
  if (source === "PMS") {
    return (
      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
        Imported from PMS Project Budget
      </span>
    );
  }
  return null;
}

function EnterpriseBudgetSourceSelector({ value, onChange, projectBudget, currency }) {
  const isPms = value === "PMS" || value === "PMS_BUDGET";

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2">
      <span className="text-xs font-semibold text-slate-700">Contract Value Source:</span>
      <div className="flex items-center gap-1 rounded-lg bg-slate-200/60 p-0.5">
        <button
          type="button"
          onClick={() => onChange("PMS")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
            isPms
              ? "bg-white text-[#0A0082] shadow-sm font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Landmark className="h-3.5 w-3.5" />
          <span>Project Budget {projectBudget ? `(${currency || ""} ${projectBudget})` : ""}</span>
        </button>

        <button
          type="button"
          onClick={() => onChange("MANUAL")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
            !isPms
              ? "bg-white text-[#0A0082] shadow-sm font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span>Manual Input</span>
        </button>
      </div>
    </div>
  );
}

// Fixed Price billing must be driven by the actual client-agreed commercial value,
// which can legitimately differ from the PMS Project Budget in either direction —
// so Contract Value only seeds from the budget once and is freely editable after.
function FixedPriceForm({
  value = {},
  onChange,
  currency,
  projectBudget,
  billingFrequency,
  billingFrequencyLabel,
  billingConfigurationId,
  projectStartDate,
  projectEndDate,
}) {
  const update = (patch) => onChange({ ...value, ...patch });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fetchedRef = useRef(false);
  const isOneTime = isOneTimeFrequency(billingFrequency);

  // [6] billingConfigurationId received by FixedPriceForm.
  useEffect(() => {
    console.log("[FixedPriceForm] billingConfigurationId prop:", billingConfigurationId);
  }, [billingConfigurationId]);

  useEffect(() => {
    if (value.totalContractValue || value.contractValueSource) return;
    if (projectBudget === "" || projectBudget === null || projectBudget === undefined) return;
    update({ totalContractValue: projectBudget, contractValueSource: "PMS" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectBudget]);

  // A One-Time frequency is a single lump sum with no schedule — any previously
  // entered effective dates are stale the moment the frequency switches to it,
  // so clear them from state (not just the hidden UI) rather than leaving a
  // stale date that could still reach the payload.
  useEffect(() => {
    if (!isOneTime) return;
    if (value.effectiveFrom || value.effectiveTo) {
      update({ effectiveFrom: "", effectiveTo: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOneTime]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!billingConfigurationId) return;
      if (fetchedRef.current) return;
      fetchedRef.current = true;

      setLoadingConfig(true);
      try {
        const record = await getFixedPriceByBillingConfiguration(billingConfigurationId);
        if (!mounted || !record) return;
        update({
          fixedPriceConfigurationId: record.fixedPriceConfigurationId || record.id || null,
          totalContractValue:
            record.totalContractValue ?? record.contractValue ?? value.totalContractValue ?? "",
          contractValueSource: value.contractValueSource || "MANUAL",
          pmsProjectBudget: record.pmsProjectBudget ?? "",
          // retentionPercentage is the canonical backend field name — check it first.
          retentionPercent: record.retentionPercentage ?? record.retentionPercent ?? "",
          advanceReceived: record.advanceReceived ?? "",
          effectiveFrom: record.effectiveFrom || "",
          effectiveTo: record.effectiveTo || "",
          remarks: record.remarks || "",
          retentionAmount: record.retentionAmount ?? "",
          billableAmount: record.billableAmount ?? "",
          // remainingReceivable is the canonical backend field name — check it first.
          remainingAmount: record.remainingReceivable ?? record.remainingAmount ?? "",
        });
      } catch (error) {
        showStatusToast(
          getApiErrorMessage(error, "Unable to load fixed price configuration."),
          "error",
        );
      } finally {
        if (mounted) setLoadingConfig(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingConfigurationId]);

  const contractValue = Number(value.totalContractValue) || 0;
  const retentionPercentNum = Number(value.retentionPercent);
  const hasRetention =
    value.retentionPercent !== "" &&
    value.retentionPercent !== null &&
    value.retentionPercent !== undefined &&
    !Number.isNaN(retentionPercentNum) &&
    retentionPercentNum > 0;
  const retentionAmount = hasRetention ? contractValue * (retentionPercentNum / 100) : 0;
  const billableAmount = contractValue - retentionAmount;

  const advanceReceivedNum = Number(value.advanceReceived);
  const hasAdvance =
    value.advanceReceived !== "" &&
    value.advanceReceived !== null &&
    value.advanceReceived !== undefined &&
    !Number.isNaN(advanceReceivedNum) &&
    advanceReceivedNum > 0;
  const remainingReceivable = billableAmount - (hasAdvance ? advanceReceivedNum : 0);

  const retentionError =
    value.retentionPercent !== "" && value.retentionPercent !== null && value.retentionPercent !== undefined
      ? Number.isNaN(retentionPercentNum) || retentionPercentNum < 0 || retentionPercentNum > 100
        ? "Retention must be between 0% and 100%."
        : ""
      : "";
  const advanceError =
    value.advanceReceived !== "" && value.advanceReceived !== null && value.advanceReceived !== undefined
      ? Number.isNaN(advanceReceivedNum) || advanceReceivedNum < 0
        ? "Advance Received cannot be negative."
        : advanceReceivedNum > billableAmount
        ? "Advance Received cannot exceed the Billable Amount."
        : ""
      : "";

  const dateErrors = isOneTime
    ? { effectiveFrom: "", effectiveTo: "" }
    : getEffectiveDateErrors({
        effectiveFrom: value.effectiveFrom,
        effectiveTo: value.effectiveTo,
        projectStartDate,
        projectEndDate,
      });

  // The backend requires a different field depending on contractValueSource: PMS
  // Budget sends the project budget as pmsProjectBudget (from the Billing
  // Configuration state, never blank/null) AND still needs contractValue populated
  // with that same budget — the backend's retention/billable/remaining calculations
  // read contractValue regardless of source, so it can never be left null there.
  // Manual sends only the user-entered amount as contractValue (not
  // "totalContractValue" — that's only the wizard's internal form field name).
  const buildFixedPricePayload = () => {
    const apiContractValueSource = toApiContractValueSource(value.contractValueSource);
    const sharedFields = {
      contractValueSource: apiContractValueSource,
      // Backend field is "retentionPercentage" (RetentionPercentDto) — "retentionPercent"
      // is only the internal form/state field name, kept as-is to avoid churning every
      // read/validation/calc site below that already references value.retentionPercent.
      retentionPercentage:
        value.retentionPercent === "" || value.retentionPercent === null || value.retentionPercent === undefined
          ? null
          : Number(value.retentionPercent),
      advanceReceived:
        value.advanceReceived === "" || value.advanceReceived === null || value.advanceReceived === undefined
          ? null
          : Number(value.advanceReceived),
      // One-Time is a single lump sum with no schedule — never send a stale
      // effective date range for it, even if one was entered under a previous
      // (recurring) frequency selection.
      effectiveFrom: isOneTime ? "" : value.effectiveFrom || "",
      effectiveTo: isOneTime ? "" : value.effectiveTo || "",
      remarks: value.remarks || "",
    };

    if (apiContractValueSource === "PMS_BUDGET") {
      const pmsProjectBudget = Number(projectBudget);
      return { ...sharedFields, pmsProjectBudget, contractValue: pmsProjectBudget };
    }

    return { ...sharedFields, contractValue: Number(value.totalContractValue) };
  };

  const saveFixedPriceConfig = async () => {
    if (!value.totalContractValue) {
      showStatusToast("Contract Value is required before saving.", "error");
      return;
    }
    if (retentionError || advanceError || (!isOneTime && hasEffectiveDateErrors(dateErrors))) {
      showStatusToast("Please fix the highlighted errors before saving.", "error");
      return;
    }

    const apiContractValueSource = toApiContractValueSource(value.contractValueSource);
    const pmsProjectBudgetIsBlank =
      projectBudget === "" || projectBudget === null || projectBudget === undefined || Number.isNaN(Number(projectBudget));
    if (apiContractValueSource === "PMS_BUDGET" && pmsProjectBudgetIsBlank) {
      showStatusToast("Project budget is required before saving a PMS Budget contract value.", "error");
      return;
    }

    // This button only ever reads billingConfigurationId — it never creates the
    // parent draft itself. The draft is created once, up front, when the wizard is
    // first entered (see ensureBillingConfigurationId in NewConfigurationWizard), so
    // by the time the user reaches this step the id is already in state.
    if (!billingConfigurationId) {
      showStatusToast(
        "Unable to save fixed price configuration: billing configuration id is missing. Please reload and try again.",
        "error",
      );
      return;
    }

    setSaving(true);
    try {
      const payload = buildFixedPricePayload();
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("[FixedPriceForm] Fixed Price API payload:", payload);
      }

      // value.fixedPriceConfigurationId can still be unset here if the wizard's own
      // load effect (above) hasn't resolved yet — re-check the backend directly so a
      // record that already exists is updated, never re-created as a duplicate.
      let existingId = value.fixedPriceConfigurationId;
      if (!existingId && billingConfigurationId) {
        const existingRecord = await getFixedPriceByBillingConfiguration(billingConfigurationId);
        existingId = existingRecord?.fixedPriceConfigurationId || existingRecord?.id || null;
      }

      const saved = existingId
        ? await updateFixedPriceConfiguration(existingId, payload)
        : await createFixedPriceConfiguration(billingConfigurationId, payload);

      update({
        fixedPriceConfigurationId:
          saved?.fixedPriceConfigurationId || saved?.id || value.fixedPriceConfigurationId || null,
        // Reconcile with the backend's canonical retentionPercentage so the field
        // reflects exactly what was persisted (falls back to what was just typed
        // if the response happens not to echo it back).
        retentionPercent: saved?.retentionPercentage ?? saved?.retentionPercent ?? value.retentionPercent ?? "",
        retentionAmount: saved?.retentionAmount ?? value.retentionAmount ?? "",
        billableAmount: saved?.billableAmount ?? value.billableAmount ?? "",
        // Backend field is "remainingReceivable", not "remainingAmount" — without this
        // fallback the freshly-saved value was dropped and the summary kept showing
        // the stale pre-save number (or blank on first create).
        remainingAmount: saved?.remainingReceivable ?? saved?.remainingAmount ?? value.remainingAmount ?? "",
      });
      showStatusToast("Fixed price configuration saved", "success");
    } catch (error) {
      showStatusToast(
        getApiErrorMessage(error, "Unable to save fixed price configuration."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const requestRemoveFixedPriceConfig = () => {
    if (!value.fixedPriceConfigurationId) {
      update({
        totalContractValue: "",
        contractValueSource: "",
        pmsProjectBudget: "",
        retentionPercent: "",
        advanceReceived: "",
        effectiveFrom: "",
        effectiveTo: "",
        remarks: "",
      });
      return;
    }
    setConfirmingDelete(true);
  };

  const removeFixedPriceConfig = async () => {
    const fixedPriceConfigurationId = value.fixedPriceConfigurationId;
    if (!fixedPriceConfigurationId) {
      setConfirmingDelete(false);
      return;
    }

    setDeleting(true);
    try {
      await deleteFixedPriceConfiguration(fixedPriceConfigurationId);
      update({
        fixedPriceConfigurationId: null,
        totalContractValue: "",
        contractValueSource: "",
        pmsProjectBudget: "",
        retentionPercent: "",
        advanceReceived: "",
        effectiveFrom: "",
        effectiveTo: "",
        remarks: "",
        retentionAmount: "",
        billableAmount: "",
        remainingAmount: "",
      });
      showStatusToast("Rate deleted successfully.", "success");
      setConfirmingDelete(false);
    } catch (error) {
      showStatusToast(
        getApiErrorMessage(error, "Unable to delete rate."),
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className={Fonts.heading4}>Fixed Price Billing Configuration</h2>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <EnterpriseBudgetSourceSelector
          value={value.contractValueSource || (value.totalContractValue === projectBudget ? "PMS" : "MANUAL")}
          onChange={(nextSource) => {
            if (nextSource === "PMS") {
              update({
                contractValueSource: "PMS",
                totalContractValue: projectBudget || "",
                pmsProjectBudget: projectBudget || "",
              });
            } else {
              update({ contractValueSource: "MANUAL" });
            }
          }}
          projectBudget={projectBudget}
          currency={currency}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <FormInput
              label={
                <span className="flex flex-wrap items-center gap-2">
                  Contract Value <span className="text-red-500">*</span>
                  <ContractValueSourceBadge source={value.contractValueSource} />
                </span>
              }
              name="totalContractValue"
              type="number"
              value={value.totalContractValue || ""}
              onChange={(event) =>
                update({ totalContractValue: event.target.value, contractValueSource: "MANUAL" })
              }
              placeholder={`e.g. 120000 (${currency})`}
            />
          </div>
          <FormInput
            label="Retention % (optional)"
            name="retentionPercent"
            type="number"
            min="0"
            max="100"
            value={value.retentionPercent || ""}
            onChange={(event) => update({ retentionPercent: event.target.value })}
            placeholder="e.g. 10"
            error={retentionError}
          />
          <FormInput
            label="Advance Received"
            name="advanceReceived"
            type="number"
            min="0"
            value={value.advanceReceived || ""}
            onChange={(event) => update({ advanceReceived: event.target.value })}
            placeholder="e.g. 20000"
            error={advanceError}
          />
          {!isOneTime && (
            <>
              <FormDatePicker
                label="Effective From"
                name="fixedPriceEffectiveFrom"
                value={value.effectiveFrom || ""}
                onChange={(event) => update({ effectiveFrom: event.target.value })}
                min={projectStartDate || undefined}
                max={projectEndDate || undefined}
                error={dateErrors.effectiveFrom}
              />
              <FormDatePicker
                label="Effective To"
                name="fixedPriceEffectiveTo"
                value={value.effectiveTo || ""}
                onChange={(event) => update({ effectiveTo: event.target.value })}
                min={projectStartDate || undefined}
                max={projectEndDate || undefined}
                error={dateErrors.effectiveTo}
              />
            </>
          )}
          <div className="md:col-span-3">
            <FormTextArea
              label="Remarks"
              name="fixedPriceRemarks"
              value={value.remarks || ""}
              onChange={(event) => update({ remarks: event.target.value })}
              placeholder="Any additional notes about this fixed price arrangement"
              rows={3}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="flex items-center justify-between py-1 text-sm">
            <span className="text-slate-500">Contract Value</span>
            <span className="font-semibold text-slate-900">{formatCurrency(contractValue, currency)}</span>
          </div>
          {hasRetention && (
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-slate-500">Retention ({retentionPercentNum}%)</span>
              <span className="font-semibold text-slate-900">-{formatCurrency(retentionAmount, currency)}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
            <span className="font-semibold text-slate-700">Billable Amount</span>
            <span className="font-bold text-[#0A0082]">{formatCurrency(billableAmount, currency)}</span>
          </div>
          {hasAdvance && (
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-slate-500">Advance Received</span>
              <span className="font-semibold text-slate-900">-{formatCurrency(advanceReceivedNum, currency)}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
            <span className="font-semibold text-slate-700">Remaining Receivable</span>
            <span className="font-bold text-[#0A0082]">{formatCurrency(remainingReceivable, currency)}</span>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          {isOneTime
            ? "One-Time billing: the Remaining Receivable will be raised as a single billing event."
            : `Remaining Receivable will be scheduled across ${
                billingFrequencyLabel && billingFrequencyLabel !== "—" ? billingFrequencyLabel : "the selected"
              } billing cycles based on the project duration.`}
        </p>

        {loadingConfig ? (
          <p className="text-sm text-slate-500">Loading saved fixed price configuration…</p>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="small"
              onClick={saveFixedPriceConfig}
              loading={saving}
              loadingText="Saving..."
            >
              <Check className="h-4 w-4" />
              {value.fixedPriceConfigurationId ? "Update Fixed Price Details" : "Save Fixed Price Details"}
            </Button>
            {value.fixedPriceConfigurationId && (
              <Button
                variant="ghost"
                size="small"
                onClick={requestRemoveFixedPriceConfig}
                loading={deleting}
                loadingText="Removing..."
              >
                <Trash2 className="h-4 w-4 text-red-500" /> Remove
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmingDelete}
        title="Delete Fixed Price Rate"
        message="Remove this fixed price configuration? This cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deleting}
        onCancel={() => !deleting && setConfirmingDelete(false)}
        onConfirm={removeFixedPriceConfig}
      />
    </div>
  );
}

const EMPTY_MILESTONE_FORM = {
  name: "",
  amount: "",
  dueDate: "",
  status: "PENDING",
};

function MilestoneForm({
  milestones = [],
  settings = {},
  onMilestonesChange,
  onSettingsChange,
}) {
  const [modalState, setModalState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openAddModal = () =>
    setModalState({ mode: "add", form: EMPTY_MILESTONE_FORM });
  const openEditModal = (milestone) =>
    setModalState({
      mode: "edit",
      id: milestone.id,
      form: {
        name: milestone.name,
        amount: milestone.amount,
        dueDate: milestone.dueDate,
        status: milestone.status || "PENDING",
      },
    });

  const handleModalFieldChange = (patch) =>
    setModalState((prev) => ({ ...prev, form: { ...prev.form, ...patch } }));

  const handleModalSave = () => {
    const { mode, id, form } = modalState;
    if (mode === "add") {
      onMilestonesChange([...milestones, { id: nextMilestoneId(), ...form }]);
    } else {
      onMilestonesChange(
        milestones.map((milestone) =>
          milestone.id === id ? { ...milestone, ...form } : milestone,
        ),
      );
    }
    setModalState(null);
  };

  const handleConfirmDelete = () => {
    onMilestonesChange(
      milestones.filter((milestone) => milestone.id !== deleteTarget.id),
    );
    setDeleteTarget(null);
  };

  const isModalFormValid = Boolean(
    modalState?.form.name &&
    modalState?.form.amount &&
    modalState?.form.dueDate,
  );

  const tableRows = milestones.map((milestone) => ({
    name: milestone.name,
    amount: milestone.amount,
    dueDate: milestone.dueDate,
    status: (
      <StatusBadge
        label={milestone.status === "COMPLETED" ? "Completed" : "Pending"}
        size="sm"
      />
    ),
    actions: (
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          title="Edit milestone"
          onClick={() => openEditModal(milestone)}
        >
          <Pencil className="h-4 w-4 text-blue-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Remove milestone"
          onClick={() => setDeleteTarget(milestone)}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    ),
  }));

  return (
    <div className="space-y-4">
      <h2 className={Fonts.heading4}>Milestone Billing Configuration</h2>

      <div className="rounded-xl border border-slate-200 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Milestones</h3>
          <Button variant="outline" size="small" onClick={openAddModal}>
            <Plus className="h-3.5 w-3.5" /> Add Milestone
          </Button>
        </div>

        <ARTable
          headers={["Milestone Name", "Amount", "Due Date", "Status", "Actions"]}
          columns={["name", "amount", "dueDate", "status", "actions"]}
          rows={tableRows}
          emptyMessage="No milestones added yet. Add at least one milestone."
        />
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 p-5">
        <ToggleSwitch
          label="Bill only completed milestones"
          checked={Boolean(settings.billOnlyCompletedMilestones)}
          onChange={(checked) =>
            onSettingsChange({
              ...settings,
              billOnlyCompletedMilestones: checked,
            })
          }
        />
        <ToggleSwitch
          label="Allow partial milestone billing"
          checked={Boolean(settings.allowPartialMilestoneBilling)}
          onChange={(checked) =>
            onSettingsChange({
              ...settings,
              allowPartialMilestoneBilling: checked,
            })
          }
        />
      </div>

      <Modal
        isOpen={Boolean(modalState)}
        onClose={() => setModalState(null)}
        title={modalState?.mode === "add" ? "Add Milestone" : "Edit Milestone"}
        size="sm"
      >
        {modalState && (
          <div className="space-y-4">
            <FormInput
              label="Milestone Name"
              requiredMark
              name="name"
              value={modalState.form.name}
              onChange={(event) =>
                handleModalFieldChange({ name: event.target.value })
              }
              placeholder="e.g. UAT Completion"
            />
            <FormInput
              label="Amount"
              requiredMark
              name="amount"
              type="number"
              value={modalState.form.amount}
              onChange={(event) =>
                handleModalFieldChange({ amount: event.target.value })
              }
              placeholder="e.g. 1200000"
            />
            <FormDatePicker
              label="Due Date"
              name="dueDate"
              value={modalState.form.dueDate}
              onChange={(event) =>
                handleModalFieldChange({ dueDate: event.target.value })
              }
            />
            {modalState.mode === "edit" && (
              <FormSelect
                label="Status"
                name="status"
                value={modalState.form.status}
                onChange={(event) =>
                  handleModalFieldChange({ status: event.target.value })
                }
                options={MILESTONE_STATUS_OPTIONS}
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalState(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!isModalFormValid}
                onClick={handleModalSave}
              >
                Save Milestone
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Remove Milestone"
        message={
          deleteTarget
            ? `Remove milestone "${deleteTarget.name}"? This cannot be undone.`
            : ""
        }
        confirmText="Remove"
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

// Recurring billing configuration (BillingRecurringConfiguration, via
// /api/billing-recurring). Billing Frequency itself (durationValue +
// durationUnit, chosen via the shared Billing Frequency selector above)
// determines the recurring period — there is no separate Pricing Model for
// Recurring, and no hardcoded MONTHLY/QUARTERLY/ANNUALLY branching here.
function RecurringBillingForm({
  value = {},
  onChange,
  currency,
  projectBudget,
  billingFrequencyOption,
  billingConfigurationId,
  projectStartDate,
  projectEndDate,
}) {
  const update = (patch) => onChange({ ...value, ...patch });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const fetchedRef = useRef(false);

  const contractValueSource = value.contractValueSource || "";
  const isPmsSource = contractValueSource === "PMS_BUDGET";
  const hasProjectBudget = projectBudget !== "" && projectBudget !== null && projectBudget !== undefined;

  // Project dates can arrive as a full timestamp depending on which backend
  // lookup supplied them; the date input's min/max (and every comparison
  // below) need a plain yyyy-mm-dd, so normalize once up front — otherwise
  // the project's own start/end date can be misread as outside its duration.
  const projectStartDateOnly = toDateOnly(projectStartDate);
  const projectEndDateOnly = toDateOnly(projectEndDate);

  const billingFrequencyLabel = billingFrequencyOption
    ? formatBillingFrequencyLabel({
        durationValue: billingFrequencyOption.durationValue,
        durationUnit: billingFrequencyOption.durationUnit,
        billingFrequencyName: billingFrequencyOption.label,
      })
    : "";

  // Fetches the backend-generated schedule for this recurring configuration —
  // the periods/amounts shown in the "Billing Schedule (Preview)" table always
  // come from here, never from a frontend calculation.
  const loadSchedule = async (recurringConfigurationId, billingConfigId) => {
    if (!recurringConfigurationId && !billingConfigId) {
      setSchedule([]);
      return;
    }
    setLoadingSchedule(true);
    try {
      const periods = recurringConfigurationId
        ? await getBillingRecurringSchedule(recurringConfigurationId)
        : await getBillingRecurringScheduleByBillingConfigurationId(billingConfigId);
      setSchedule(periods);
    } catch (error) {
      showStatusToast(getApiErrorMessage(error, "Unable to load billing schedule."), "error");
      setSchedule([]);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Load the existing recurring configuration (and its generated schedule)
  // when editing a Recurring configuration — fetched once per
  // billingConfigurationId (mirrors FixedPriceForm below).
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!billingConfigurationId || fetchedRef.current) return;
      fetchedRef.current = true;

      setLoadingConfig(true);
      try {
        const record = await getBillingRecurringByBillingConfigurationId(billingConfigurationId);
        if (!mounted || !record) return;
        update(normalizeRecurringConfig(record));
        const recurringConfigurationId = record.recurringConfigurationId || record.subscriptionConfigurationId || record.id;
        if (recurringConfigurationId) await loadSchedule(recurringConfigurationId, billingConfigurationId);
      } catch (error) {
        showStatusToast(
          getApiErrorMessage(error, "Unable to load recurring billing configuration."),
          "error",
        );
      } finally {
        if (mounted) setLoadingConfig(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingConfigurationId]);

  // Seed Contract Value Source once from the PMS project budget, same pattern
  // as FixedPriceForm's own seed effect below.
  useEffect(() => {
    if (value.contractValueSource || value.contractValue) return;
    if (!hasProjectBudget) return;
    update({ contractValueSource: "PMS_BUDGET", contractValue: Number(projectBudget), pmsProjectBudget: Number(projectBudget) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProjectBudget, projectBudget]);

  // Requirement: Contract Value Source = PMS_BUDGET must always reflect the
  // *current* project budget — never a frozen snapshot — so it is kept in sync
  // whenever the project budget changes, and recalculated automatically on
  // reload. MANUAL values are left untouched.
  useEffect(() => {
    if (!isPmsSource) return;
    const nextValue = hasProjectBudget ? Number(projectBudget) : "";
    if (value.contractValue === nextValue && value.pmsProjectBudget === nextValue) return;
    update({ contractValue: nextValue, pmsProjectBudget: nextValue });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPmsSource, hasProjectBudget, projectBudget]);

  const dateErrors = getRecurringDateErrors({
    recurringStartDate: value.recurringStartDate,
    recurringEndDate: value.recurringEndDate,
    projectStartDate: projectStartDateOnly,
    projectEndDate: projectEndDateOnly,
  });

  // Fires only when the user actually picks a complete date (native <input
  // type="date"> onChange never fires while browsing calendar months, only
  // once a full date is selected) — so no error ever appears mid-navigation.
  // min/max on the input already gray out invalid dates in the native
  // calendar; this is the fallback for pickers/browsers that don't strictly
  // enforce that, flagging an out-of-range pick via toast in addition to the
  // inline error already shown under the field, rather than silently
  // reverting it with no feedback.
  const handleDateFieldChange = (field, label, dateValue) => {
    update({ [field]: dateValue });
    const normalizedValue = toDateOnly(dateValue);
    if (
      normalizedValue &&
      ((projectStartDateOnly && normalizedValue < projectStartDateOnly) ||
        (projectEndDateOnly && normalizedValue > projectEndDateOnly))
    ) {
      showStatusToast(
        `${label} is outside the project duration (${formatDisplayDate(projectStartDateOnly)} – ${formatDisplayDate(
          projectEndDateOnly,
        )}).`,
        "error",
      );
    }
  };

  const contractValueIsBlank =
    value.contractValue === "" || value.contractValue === null || value.contractValue === undefined;
  const contractValueNum = Number(value.contractValue);
  const contractValueError =
    !isPmsSource && !contractValueIsBlank
      ? Number.isNaN(contractValueNum) || contractValueNum <= 0
        ? "Contract Value must be greater than 0."
        : ""
      : "";

  // Persists the complete recurring billing configuration — contract value/
  // source, billing frequency, and effective dates — and then refreshes the
  // schedule preview from the backend. The frontend never derives periods/
  // amounts itself, so every change to frequency, dates, or contract value
  // must round-trip through this save before the preview can reflect it.
  //
  // Every field this needs is validated here, up front, so clicking Save with
  // incomplete information always surfaces a clear, specific toast — never a
  // raw backend validation error from a request that should never have been sent.
  const saveRecurringConfig = async () => {
    if (!contractValueSource) {
      showStatusToast("Select a Contract Value Source before saving.", "error");
      return;
    }
    if (contractValueIsBlank) {
      showStatusToast("Contract Value is required before saving.", "error");
      return;
    }
    if (contractValueError) {
      showStatusToast(contractValueError, "error");
      return;
    }
    if (!billingFrequencyOption?.billingFrequencyId) {
      showStatusToast("Select a Billing Frequency before saving.", "error");
      return;
    }
    if (!value.recurringStartDate || !value.recurringEndDate) {
      showStatusToast("Billing Start Date and Billing End Date are required.", "error");
      return;
    }
    if (hasRecurringDateErrors(dateErrors)) {
      showStatusToast("Please fix the highlighted date errors before saving.", "error");
      return;
    }
    if (!billingConfigurationId) {
      showStatusToast(
        "Unable to save recurring configuration: billing configuration id is missing. Please reload and try again.",
        "error",
      );
      return;
    }

    setSaving(true);
    try {
      const payload = buildRecurringRequestPayload(value, billingFrequencyOption.billingFrequencyId);

      // value.recurringConfigurationId can still be unset here if the
      // wizard's own load effect (above) hasn't resolved yet — re-check the
      // backend directly so an existing record is updated, never duplicated.
      let existingId = value.recurringConfigurationId;
      if (!existingId) {
        const existingRecord = await getBillingRecurringByBillingConfigurationId(billingConfigurationId);
        existingId = existingRecord?.recurringConfigurationId || existingRecord?.subscriptionConfigurationId || existingRecord?.id || null;
      }

      const saved = existingId
        ? await updateBillingRecurring(existingId, payload)
        : await createBillingRecurring(billingConfigurationId, payload);
      const savedId = saved?.recurringConfigurationId || saved?.subscriptionConfigurationId || saved?.id || existingId;

      update({ recurringConfigurationId: savedId || value.recurringConfigurationId || null });
      showStatusToast("Recurring configuration saved.", "success");
      await loadSchedule(savedId, billingConfigurationId);
    } catch (error) {
      showStatusToast(
        getApiErrorMessage(error, "Unable to save recurring configuration."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const requestRemoveRecurring = () => {
    if (!value.recurringConfigurationId) {
      onChange({});
      setSchedule([]);
      return;
    }
    setConfirmingDelete(true);
  };

  const removeRecurring = async () => {
    setDeleting(true);
    try {
      await deleteBillingRecurring(value.recurringConfigurationId);
      onChange({});
      setSchedule([]);
      showStatusToast("Recurring configuration removed.", "success");
      setConfirmingDelete(false);
    } catch (error) {
      showStatusToast(
        getApiErrorMessage(error, "Unable to remove recurring configuration."),
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className={Fonts.heading4}>Recurring Billing Configuration</h2>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <EnterpriseBudgetSourceSelector
          value={contractValueSource}
          onChange={(nextSource) => {
            if (nextSource === "PMS" || nextSource === "PMS_BUDGET") {
              update({
                contractValueSource: "PMS_BUDGET",
                contractValue: hasProjectBudget ? Number(projectBudget) : "",
                pmsProjectBudget: hasProjectBudget ? Number(projectBudget) : "",
              });
            } else {
              update({ contractValueSource: "MANUAL" });
            }
          }}
          projectBudget={projectBudget}
          currency={currency}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <FormInput
              label={
                <span className="flex flex-wrap items-center gap-2">
                  Contract Value <span className="text-red-500">*</span>
                  {isPmsSource && <PmsSyncedBadge />}
                </span>
              }
              name="contractValue"
              type="number"
              value={value.contractValue ?? ""}
              onChange={(event) => update({ contractValue: event.target.value })}
              placeholder={`e.g. 25000 (${currency})`}
              disabled={isPmsSource}
              error={contractValueError}
            />
            {isPmsSource && (
              <p className="mt-1 text-xs text-slate-500">
                Synced from the current project budget. Switch to Manual to enter a different value.
              </p>
            )}
          </div>

          <ReadOnlyField label="Billing Frequency" value={billingFrequencyLabel || "—"} />

          <FormDatePicker
            label="Billing Start Date *"
            name="recurringStartDate"
            value={value.recurringStartDate || ""}
            onChange={(event) =>
              handleDateFieldChange("recurringStartDate", "Billing Start Date", event.target.value)
            }
            min={projectStartDateOnly || undefined}
            max={projectEndDateOnly || undefined}
            error={dateErrors.recurringStartDate}
          />
          <FormDatePicker
            label="Billing End Date *"
            name="recurringEndDate"
            value={value.recurringEndDate || ""}
            onChange={(event) =>
              handleDateFieldChange("recurringEndDate", "Billing End Date", event.target.value)
            }
            min={projectStartDateOnly || undefined}
            max={projectEndDateOnly || undefined}
            error={dateErrors.recurringEndDate}
          />
        </div>

        <FormTextArea
          label="Remarks"
          name="recurringRemarks"
          value={value.remarks || ""}
          onChange={(event) => update({ remarks: event.target.value })}
          placeholder="Any additional notes about this recurring arrangement"
          rows={3}
        />

        {loadingConfig ? (
          <p className="text-sm text-slate-500">Loading saved recurring configuration…</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="small"
              onClick={saveRecurringConfig}
              loading={saving}
              loadingText="Saving..."
            >
              <Check className="h-4 w-4" />
              {value.recurringConfigurationId ? "Update Recurring Configuration" : "Save Recurring Configuration"}
            </Button>
            {value.recurringConfigurationId && (
              <Button
                variant="ghost"
                size="small"
                onClick={requestRemoveRecurring}
                loading={deleting}
                loadingText="Removing..."
              >
                <Trash2 className="h-4 w-4 text-red-500" /> Remove Recurring Configuration
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Billing Schedule (Preview)</h3>
          <span className="text-xs text-slate-400">Generated by the system — not editable.</span>
        </div>

        {loadingSchedule ? (
          <p className="text-sm text-slate-500">Loading billing schedule…</p>
        ) : schedule.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-500">
            {value.recurringConfigurationId
              ? "No billing schedule has been generated yet."
              : "Save the recurring configuration to generate the billing schedule."}
          </p>
        ) : (
          <div className="max-h-96 w-full overflow-y-auto overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-1/6 px-3 py-2.5 text-center align-middle font-semibold text-slate-600">Period</th>
                  <th className="w-1/6 px-3 py-2.5 text-center align-middle font-semibold text-slate-600">From</th>
                  <th className="w-1/6 px-3 py-2.5 text-center align-middle font-semibold text-slate-600">To</th>
                  <th className="w-1/6 px-3 py-2.5 text-center align-middle font-semibold text-slate-600">Amount</th>
                  <th className="w-1/6 px-3 py-2.5 text-center align-middle font-semibold text-slate-600">Partial Period</th>
                  <th className="w-1/6 px-3 py-2.5 text-center align-middle font-semibold text-slate-600">Invoiced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedule.map((period, index) => (
                  <tr key={period.periodNumber ?? index}>
                    <td className="px-3 py-2.5 text-center align-middle text-slate-700">
                      Period {period.periodNumber ?? index + 1}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle text-slate-700">
                      {formatDisplayDate(period.periodStartDate)}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle text-slate-700">
                      {formatDisplayDate(period.periodEndDate)}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle font-medium text-slate-900">
                      {period.billingAmount || period.billingAmount === 0
                        ? formatCurrency(period.billingAmount, currency)
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle text-slate-700">
                      {period.isPartialPeriod ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      <StatusBadge label={period.isInvoiced ? "Invoiced" : "Pending"} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-sm font-semibold text-slate-900">Total Contract Value</span>
          <span className="text-sm font-semibold text-slate-900">
            {value.contractValue || value.contractValue === 0 ? formatCurrency(value.contractValue, currency) : "—"}
          </span>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmingDelete}
        title="Delete Recurring Configuration"
        message="Remove this recurring billing configuration? This cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deleting}
        onCancel={() => !deleting && setConfirmingDelete(false)}
        onConfirm={removeRecurring}
      />
    </div>
  );
}

export default function BillingConfigurationStep({
  value = {},
  onChange,
  setupMode,
  projectInfo = {},
  onProjectInfoChange,
  ensureBillingConfigurationId,
}) {
  const isExisting = false; // Billing mode and rates are always configurable for new billing setups
  const billingType = value.billingType || "";
  const billingMode = value.billingMode || "";
  const billingFrequency = value.billingFrequency || "";
  const billingTypeId = value.billingTypeId || "";
  const billingFrequencyId = value.billingFrequencyId || "";
  const currency = String(
    projectInfo?.projectBudgetCurrency || projectInfo?.currency || "",
  )
    .trim()
    .toUpperCase();
  const isPmsSourced =
    String(projectInfo?.projectSource || "ENTERPRISE").toUpperCase() ===
    "ENTERPRISE";
  const hasPmsBudget =
    isPmsSourced &&
    projectInfo?.projectBudget !== "" &&
    projectInfo?.projectBudget !== null &&
    projectInfo?.projectBudget !== undefined;
  const [activeBillingTypeOptions, setActiveBillingTypeOptions] = useState([]);
  const [activeBillingFrequencyOptions, setActiveBillingFrequencyOptions] =
    useState([]);
  const [loadingBillingData, setLoadingBillingData] = useState(true);
  const frequencyLabel = (val) =>
    activeBillingFrequencyOptions.find((option) => option.value === val)
      ?.label ||
    val ||
    "—";

  useEffect(() => {
    let isMounted = true;

    const loadBillingOptions = async () => {
      try {
        const [billingTypes, billingFrequencies] = await Promise.all([
          getActiveBillingTypes(),
          getActiveBillingFrequencies(),
        ]);

        if (!isMounted) return;

        const normalizedTypes = Array.isArray(billingTypes)
          ? billingTypes.map(normalizeBillingType).filter((type) => type.value)
          : [];
        const normalizedFrequencies = Array.isArray(billingFrequencies)
          ? billingFrequencies.filter((frequency) => frequency.value)
          : [];

        setActiveBillingTypeOptions(
          sortByOrder(normalizedTypes, BILLING_TYPE_ORDER),
        );
        setActiveBillingFrequencyOptions(normalizedFrequencies);
      } catch (error) {
        if (!isMounted) return;
        setActiveBillingTypeOptions([]);
        setActiveBillingFrequencyOptions([]);
        showStatusToast(
          getApiErrorMessage(
            error,
            "Failed to load billing types and frequencies.",
          ),
          "error",
        );
      } finally {
        if (isMounted) setLoadingBillingData(false);
      }
    };

    loadBillingOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const projectCurrencyCode = String(
      projectInfo.projectBudgetCurrency || projectInfo.currency || "",
    )
      .trim()
      .toUpperCase();
    if (
      !projectCurrencyCode ||
      (projectInfo.currency === projectCurrencyCode &&
        projectInfo.projectBudgetCurrency === projectCurrencyCode)
    ) {
      return;
    }

    onProjectInfoChange({
      ...projectInfo,
      currency: projectCurrencyCode,
      projectBudgetCurrency:
        projectInfo.projectBudgetCurrency || projectCurrencyCode,
    });
  }, [onProjectInfoChange, projectInfo]);

  const update = (patch) => onChange({ ...value, ...patch });
  const updateSection = (section, patch) => update({ [section]: patch });
  const pricingModelOptions = getPricingModelOptions(billingType);
  const frequencyOptions = getBillingFrequencyOptions(
    billingType,
    activeBillingFrequencyOptions,
  );

  const handleBillingTypeChange = (nextId) => {
    const selectedOption = activeBillingTypeOptions.find(
      (type) => String(type.billingTypeId) === String(nextId),
    );
    if (!selectedOption) return;

    const normalizedBillingType = selectedOption.value;
    const nextPricingModels = getPricingModelOptions(normalizedBillingType);
    const nextBillingMode =
      nextPricingModels.length > 0 ? nextPricingModels[0].value : "";

    // Switching away from Fixed Price after it was already saved would otherwise leave
    // an orphaned fixed price record under this billing configuration.
    const staleFixedPriceId = value.fixedPrice?.fixedPriceConfigurationId;
    if (
      billingType === "FIXED_PRICE" &&
      normalizedBillingType !== "FIXED_PRICE" &&
      staleFixedPriceId
    ) {
      deleteFixedPriceConfiguration(staleFixedPriceId).catch((error) => {
        console.warn("Unable to remove previous fixed price configuration", error);
      });
    }

    // Same cleanup for Recurring: switching away after a recurring
    // configuration was already saved would otherwise leave an orphaned record.
    const staleRecurringId =
      value.recurring?.recurringConfigurationId || value.recurring?.subscriptionConfigurationId;
    if (
      billingType === "RECURRING" &&
      normalizedBillingType !== "RECURRING" &&
      staleRecurringId
    ) {
      deleteBillingRecurring(staleRecurringId).catch((error) => {
        console.warn("Unable to remove previous recurring billing configuration", error);
      });
    }

    update({
      billingType: normalizedBillingType,
      billingTypeId: selectedOption.billingTypeId,
      billingTypeLabel: selectedOption.label,
      billingMode: nextBillingMode,
      billingFrequency:
        normalizedBillingType === "RECURRING"
          ? value.billingFrequency || ""
          : "",
      billingFrequencyId:
        normalizedBillingType === "RECURRING"
          ? value.billingFrequencyId || ""
          : "",
      timeAndMaterial:
        normalizedBillingType === "TIME_MATERIAL"
          ? value.timeAndMaterial || {}
          : {},
      fixedPrice:
        normalizedBillingType === "FIXED_PRICE" ? value.fixedPrice || {} : {},
      milestones:
        normalizedBillingType === "MILESTONE" ? value.milestones || [] : [],
      milestoneSettings:
        normalizedBillingType === "MILESTONE"
          ? value.milestoneSettings || {}
          : {},
      recurring:
        normalizedBillingType === "RECURRING" ? value.recurring || {} : {},
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Project Financials</h3>
          {(isPmsSourced || hasPmsBudget) && <PmsSyncedBadge />}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isPmsSourced ? (
            <ReadOnlyField label="Billing Currency *" value={currency} />
          ) : (
            <FormSelect
              label="Billing Currency *"
              name="currency"
              value={currency}
              onChange={(e) =>
                onProjectInfoChange({
                  ...projectInfo,
                  currency: e.target.value,
                  projectBudgetCurrency: e.target.value,
                })
              }
              options={CURRENCY_OPTIONS}
            />
          )}

          {hasPmsBudget ? (
            <ReadOnlyField label="Project Budget" value={projectInfo.projectBudget} />
          ) : (
            <FormInput
              label="Project Budget"
              name="projectBudget"
              type="number"
              min="0"
              step="0.01"
              value={projectInfo.projectBudget ?? ""}
              onChange={(e) =>
                onProjectInfoChange({
                  ...projectInfo,
                  projectBudget: e.target.value,
                })
              }
              placeholder="e.g. 45678"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Billing Type <span className="text-red-500">*</span>
          </label>
          {loadingBillingData ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <PillSelectGroup
              name="billingTypeId"
              options={activeBillingTypeOptions.map((type) => ({
                value: type.billingTypeId,
                label: type.label,
              }))}
              value={billingTypeId}
              onChange={handleBillingTypeChange}
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Billing Frequency <span className="text-red-500">*</span>
          </label>
          <PillSelectGroup
            name="billingFrequencyId"
            options={frequencyOptions.map((f) => ({
              value: f.billingFrequencyId,
              label: f.label,
            }))}
            value={billingFrequencyId}
            onChange={(next) => {
              const selectedFrequency = activeBillingFrequencyOptions.find(
                (option) =>
                  String(option.billingFrequencyId) === String(next),
              );
              update({
                billingFrequency: selectedFrequency?.value || "",
                billingFrequencyId:
                  selectedFrequency?.billingFrequencyId ||
                  selectedFrequency?.id ||
                  "",
                billingFrequencyName:
                  selectedFrequency?.label ||
                  selectedFrequency?.billingFrequencyName ||
                  "",
              });
            }}
          />
        </div>
      </div>

      {!isExisting && pricingModelOptions.length > 0 && (
        <div className="space-y-3 pt-5 border-t border-slate-100">
          <h3 className={Fonts.subheading}>Pricing Model</h3>

          <RadioCardGroup
            name="billingMode"
            options={pricingModelOptions}
            value={billingMode || ""}
            onChange={(next) => update({ billingMode: next })}
            columns={2}
          />
        </div>
      )}

      {billingType !== "" ? (
        <div className="space-y-3 pt-5 border-t border-slate-100">
          <h3 className={Fonts.subheading}>Rate Details</h3>
          <div>
            {billingType === "TIME_MATERIAL" && (
              <TimeAndMaterialForm
                value={value.timeAndMaterial}
                onChange={(next) => updateSection("timeAndMaterial", next)}
                billingMode={billingMode}
                currency={currency}
                isExisting={isExisting}
                billingConfigurationId={
                  value.billingConfigurationId || value.id
                }
                ensureBillingConfigurationId={ensureBillingConfigurationId}
                billingConfigurationPayload={{
                  ...value,
                  projectInfo,
                  billingConfig: value,
                }}
                billingFrequency={billingFrequency}
                projectStartDate={projectInfo.startDate}
                projectEndDate={projectInfo.endDate}
              />
            )}

            {billingType === "FIXED_PRICE" && (
              <FixedPriceForm
                value={value.fixedPrice}
                onChange={(next) => updateSection("fixedPrice", next)}
                currency={currency}
                projectBudget={projectInfo.projectBudget}
                billingFrequency={billingFrequency}
                billingFrequencyLabel={frequencyLabel(billingFrequency)}
                billingConfigurationId={value.billingConfigurationId || value.id}
                projectStartDate={projectInfo.startDate}
                projectEndDate={projectInfo.endDate}
              />
            )}

            {billingType === "MILESTONE" && (
              <MilestoneForm
                milestones={value.milestones}
                settings={value.milestoneSettings}
                onMilestonesChange={(next) => update({ milestones: next })}
                onSettingsChange={(next) => update({ milestoneSettings: next })}
              />
            )}

            {billingType === "RECURRING" && (
              <RecurringBillingForm
                value={value.recurring || {}}
                onChange={(next) => updateSection("recurring", next)}
                currency={currency}
                projectBudget={projectInfo.projectBudget}
                billingFrequencyOption={activeBillingFrequencyOptions.find(
                  (option) => String(option.billingFrequencyId) === String(billingFrequencyId),
                )}
                billingConfigurationId={value.billingConfigurationId || value.id}
                projectStartDate={projectInfo.startDate}
                projectEndDate={projectInfo.endDate}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
