import { useMemo, useState } from "react";
import { FolderKanban, Coins, Wallet, Receipt, Pencil, Search, ChevronRight, Building2, Calendar, ShieldCheck, CheckCircle2, Info } from "lucide-react";

import { PageCard, PageCardContent } from "../../../../components/Cards/PageCard";
import Modal from "../../../../components/Modal/modal";
import StatusBadge from "../../../../components/status/statusbadge";
import { BILLING_MODE_LABELS } from "../../data/wizardOptions";
import { getBillingTypeDisplayName } from "../../utils/billingType";

const labelizeStatus = (value) => {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const FREQUENCY_LABEL_MAP = {
  ONE_TIME: "One-Time",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUALLY: "Annually",
  BI_WEEKLY: "Bi-Weekly",
  WEEKLY: "Weekly",
  SEMI_ANNUALLY: "Semi-Annually",
};

export function formatFrequencyLabel(freqVal, freqName, freqLabel, isOneTimeHint = false) {
  const nameCandidate = freqName || freqLabel || "";
  if (nameCandidate && !/^[0-9a-fA-F-]{20,}$/.test(nameCandidate)) {
    const candidateUpper = String(nameCandidate).trim().toUpperCase();
    if (FREQUENCY_LABEL_MAP[candidateUpper]) return FREQUENCY_LABEL_MAP[candidateUpper];
    return nameCandidate;
  }
  if (!freqVal) return isOneTimeHint ? "One-Time" : "—";
  const upper = String(freqVal).trim().toUpperCase();
  if (upper.includes("ONE") || upper.includes("SINGLE") || isOneTimeHint) {
    return "One-Time";
  }
  if (FREQUENCY_LABEL_MAP[upper]) return FREQUENCY_LABEL_MAP[upper];
  return isOneTimeHint ? "One-Time" : "Monthly";
}

const RATE_DISPLAY_LIMIT = 5;
const RATE_PREVIEW_COUNT = 4;

const RATE_PERIOD_SUFFIX = { HOURLY: "/ hr", DAILY: "/ day", WEEKLY: "/ wk" };
const RATE_PERIOD_LABEL = { HOURLY: "Hourly", DAILY: "Daily", WEEKLY: "Weekly" };

function formatDisplayDate(isoValue) {
  if (!isoValue || !/^\d{4}-\d{2}-\d{2}$/.test(isoValue)) return isoValue;
  const date = new Date(`${isoValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoValue;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMoney(value, currency) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num);
  return currency ? `${currency} ${formatted}` : formatted;
}

function ratePeriodSuffix(period) {
  if (!period) return "";
  return RATE_PERIOD_SUFFIX[period] || `/ ${String(period).toLowerCase()}`;
}

function ratePeriodLabel(period) {
  if (!period) return "—";
  return RATE_PERIOD_LABEL[period] || period;
}

function rateDateRange(role) {
  if (!role.effectiveFrom && !role.effectiveTo) return null;
  return `${role.effectiveFrom ? formatDisplayDate(role.effectiveFrom) : "—"} – ${
    role.effectiveTo ? formatDisplayDate(role.effectiveTo) : "Ongoing"
  }`;
}

function getCommercialEffectiveDates(billingConfig) {
  const { billingType, billingMode } = billingConfig;

  if (billingType === "TIME_MATERIAL" && billingMode === "ROLE_BASED") {
    const roles = billingConfig.timeAndMaterial?.roles || [];
    const fromDates = roles.map((role) => role.effectiveFrom).filter(Boolean).sort();
    const toDates = roles.map((role) => role.effectiveTo).filter(Boolean).sort();
    return {
      from: fromDates[0] || null,
      to: toDates.length ? toDates[toDates.length - 1] : null,
    };
  }
  if (billingType === "TIME_MATERIAL" && (billingMode === "STANDARD" || !billingMode)) {
    return {
      from: billingConfig.timeAndMaterial?.effectiveFrom || null,
      to: billingConfig.timeAndMaterial?.effectiveTo || null,
    };
  }
  if (billingType === "RECURRING") {
    return {
      from: billingConfig.recurring?.recurringStartDate || billingConfig.recurring?.effectiveFrom || null,
      to: billingConfig.recurring?.recurringEndDate || billingConfig.recurring?.effectiveTo || null,
    };
  }
  if (billingType === "FIXED_PRICE") {
    return {
      from: billingConfig.fixedPrice?.effectiveFrom || billingConfig.fixedPrice?.startDate || null,
      to: billingConfig.fixedPrice?.effectiveTo || billingConfig.fixedPrice?.endDate || null,
    };
  }
  if (billingType === "MILESTONE") {
    return {
      from: billingConfig.milestone?.effectiveFrom || null,
      to: billingConfig.milestone?.effectiveTo || null,
    };
  }
  return { from: null, to: null };
}

function CardShell({ icon, title, stepId, onEdit, children, headerAction }) {
  const Icon = icon;
  return (
    <PageCard className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <PageCardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0A0082]/10 text-[#0A0082]">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {headerAction}
            {onEdit && stepId && (
              <button
                type="button"
                onClick={() => onEdit(stepId)}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>
        </div>
        <div className="p-4">{children}</div>
      </PageCardContent>
    </PageCard>
  );
}

function DataRow({ label, value, highlight = false }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 text-xs last:border-0">
      <span className="font-medium text-slate-500">{label}</span>
      <span className={`text-right font-bold ${highlight ? "text-[#0A0082] text-sm" : "text-slate-900"}`}>{value || "—"}</span>
    </div>
  );
}

function PricingTable({ rows }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">
      <table className="w-full text-xs">
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={`${row.label}-${index}`} className={row.highlight ? "bg-emerald-50/40" : ""}>
              <td className="w-1/2 px-3.5 py-2.5 font-medium text-slate-600">{row.label}</td>
              <td className={`w-1/2 px-3.5 py-2.5 text-right font-bold ${row.highlight ? "text-emerald-800 text-sm" : "text-slate-900"}`}>
                {row.value ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoleRatesTable({ roles, currency }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <th className="px-3.5 py-2.5">Role</th>
            <th className="px-3.5 py-2.5">Rate</th>
            <th className="px-3.5 py-2.5">Frequency</th>
            <th className="px-3.5 py-2.5">Effective Period</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {roles.map((role, index) => (
            <tr key={`${role.role}-${index}`}>
              <td className="px-3.5 py-2.5 font-bold text-slate-900">{role.role || "—"}</td>
              <td className="px-3.5 py-2.5 font-bold text-slate-900">{formatMoney(role.rate, currency) || "—"}</td>
              <td className="px-3.5 py-2.5 text-slate-600">{ratePeriodLabel(role.ratePeriod)}</td>
              <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600">{rateDateRange(role) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoleRatesDrawer({ isOpen, onClose, roles, currency }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return roles;
    const q = query.trim().toLowerCase();
    return roles.filter((role) => (role.role || "").toLowerCase().includes(q));
  }, [roles, query]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`All Rate Cards (${roles.length})`}
      bodyClassName="p-0"
      maxHeight="max-h-[82vh]"
      panelStyle={{ width: "78vw", maxWidth: "1400px" }}
    >
      <div className="border-b border-slate-100 p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search role..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs shadow-sm outline-none transition focus:border-[#0A0082] focus:ring-2 focus:ring-[#0A0082]/20"
          />
        </div>
      </div>
      <div className="max-h-[62vh] overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">No roles match &quot;{query}&quot;.</p>
        ) : (
          <RoleRatesTable roles={filtered} currency={currency} />
        )}
      </div>
    </Modal>
  );
}

function RoleRatesList({ roles, currency }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (roles.length === 0) {
    return <DataRow label="Roles Configured" value="—" />;
  }

  if (roles.length <= RATE_DISPLAY_LIMIT) {
    return <RoleRatesTable roles={roles} currency={currency} />;
  }

  return (
    <div className="space-y-2">
      <RoleRatesTable roles={roles.slice(0, RATE_PREVIEW_COUNT)} currency={currency} />
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-1.5 text-xs font-semibold text-[#0A0082] transition-colors hover:bg-[#0A0082]/5"
      >
        View all {roles.length} rates <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <RoleRatesDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} roles={roles} currency={currency} />
    </div>
  );
}

export default function ReviewActivateStep({ wizardData, onEditStep }) {
  const { projectInfo = {}, billingConfig = {}, controls = {}, approvalStatus, billingStatus } = wizardData;

  const currency = projectInfo.projectBudgetCurrency || projectInfo.currency || "";

  const frequencyNameCode = String(
    billingConfig.billingFrequencyName || billingConfig.billingFrequencyLabel || ""
  )
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const isOneTime = billingConfig.billingFrequency === "ONE_TIME" || frequencyNameCode === "ONE_TIME";

  const billingTypeLabel = getBillingTypeDisplayName(
    billingConfig.billingTypeName ||
      billingConfig.billingTypeLabel ||
      billingConfig.billingType ||
      "—"
  );

  const billingFrequencyLabel = formatFrequencyLabel(
    billingConfig.billingFrequency,
    billingConfig.billingFrequencyName,
    billingConfig.billingFrequencyLabel,
    isOneTime
  );

  const pricingModel = billingConfig.pricingModel || billingConfig.billingMode || "";
  const roleRateRows = (billingConfig.timeAndMaterial?.roles || []).filter(
    (roleRate) => roleRate.role || roleRate.rate
  );
  const standardRate = billingConfig.timeAndMaterial || {};
  const standardRateDateRange = rateDateRange(standardRate);
  const commercialEffectiveDates = getCommercialEffectiveDates(billingConfig);

  const hasSchedule = Boolean(
    commercialEffectiveDates.from ||
      commercialEffectiveDates.to ||
      projectInfo.startDate ||
      billingConfig.billingFrequency
  );

  return (
    <div className="space-y-4">
      {/* SECTION 1: Project Summary (Full-Width Header & Metric Cards) */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0A0082]/10 text-[#0A0082]">
              <Building2 className="h-5.5 w-5.5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {projectInfo.clientName || "Client Unspecified"}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                {projectInfo.projectName || "Billing Setup"}
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Project Code: <span className="font-bold text-slate-800">{projectInfo.projectCode || "—"}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(approvalStatus || billingStatus) && (
              <div className="flex flex-wrap items-center gap-2">
                {approvalStatus && <StatusBadge label={labelizeStatus(approvalStatus)} size="md" />}
                {billingStatus && <StatusBadge label={labelizeStatus(billingStatus)} size="md" />}
              </div>
            )}
            {onEditStep && (
              <button
                type="button"
                onClick={() => onEditStep(1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-500" /> Edit Setup
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary Cards Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Billing Type</p>
            <p className="mt-0.5 text-xs font-bold text-slate-900">{billingTypeLabel || "—"}</p>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Billing Frequency</p>
            <p className="mt-0.5 text-xs font-bold text-slate-900">{billingFrequencyLabel || "—"}</p>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Currency</p>
            <p className="mt-0.5 text-xs font-bold text-slate-900">{currency || "—"}</p>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project Budget</p>
            <p className="mt-0.5 text-xs font-bold text-[#0A0082]">{formatMoney(projectInfo.projectBudget, currency) || "—"}</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: Billing & Pricing (Full-Width Card) */}
      <CardShell icon={Wallet} title="Billing & Pricing" stepId={2} onEdit={onEditStep}>
        <div className="space-y-3.5">
          {billingConfig.billingType === "FIXED_PRICE" && (() => {
            const fixedPrice = billingConfig.fixedPrice || {};
            const totalContractValue = Number(fixedPrice.totalContractValue) || 0;
            const retentionPercent = Number(fixedPrice.retentionPercent) || 0;
            const retentionAmountInput = Number(fixedPrice.retentionAmount) || 0;

            const retentionAmount =
              retentionAmountInput > 0
                ? retentionAmountInput
                : retentionPercent > 0 && totalContractValue > 0
                ? (totalContractValue * retentionPercent) / 100
                : 0;

            const hasRetention = retentionAmount > 0 || retentionPercent > 0;

            const billableAmount =
              fixedPrice.billableAmount !== "" && fixedPrice.billableAmount !== null && fixedPrice.billableAmount !== undefined && Number(fixedPrice.billableAmount) > 0
                ? Number(fixedPrice.billableAmount)
                : totalContractValue - retentionAmount;

            const advanceReceived = Number(fixedPrice.advanceReceived) || 0;
            const hasAdvance = advanceReceived > 0;

            const remainingAmount =
              fixedPrice.remainingAmount !== "" && fixedPrice.remainingAmount !== null && fixedPrice.remainingAmount !== undefined && Number(fixedPrice.remainingAmount) > 0
                ? Number(fixedPrice.remainingAmount)
                : billableAmount - advanceReceived;

            const pmsBudgetVal =
              fixedPrice.pmsProjectBudget !== "" && fixedPrice.pmsProjectBudget !== null && fixedPrice.pmsProjectBudget !== undefined
                ? Number(fixedPrice.pmsProjectBudget)
                : projectInfo.projectBudget !== "" && projectInfo.projectBudget !== null && projectInfo.projectBudget !== undefined
                ? Number(projectInfo.projectBudget)
                : null;

            const hasPmsBudget = pmsBudgetVal !== null && pmsBudgetVal !== undefined && !isNaN(pmsBudgetVal) && pmsBudgetVal > 0;
            const isSameAmount = hasPmsBudget && totalContractValue === pmsBudgetVal;
            const isDifferentAmount = hasPmsBudget && totalContractValue !== pmsBudgetVal;

            let contractBudgetRows = [];
            if (isSameAmount) {
              contractBudgetRows = [
                {
                  label: "Contract / Project Budget",
                  value: totalContractValue ? formatMoney(totalContractValue, currency) : "—",
                },
              ];
            } else if (isDifferentAmount) {
              contractBudgetRows = [
                {
                  label: (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span>Contract Value</span>
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                        Billing Amount Used
                      </span>
                    </span>
                  ),
                  value: totalContractValue ? formatMoney(totalContractValue, currency) : "—",
                },
                {
                  label: "PMS Project Budget",
                  value: formatMoney(pmsBudgetVal, currency),
                },
              ];
            } else {
              contractBudgetRows = [
                {
                  label: "Contract Value",
                  value: totalContractValue ? formatMoney(totalContractValue, currency) : "—",
                },
              ];
            }

            return (
              <div className="space-y-3.5">
                {/* Visual Calculation Formula Banner */}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Financial Calculation Formula
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-800">
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">Billable Amount</span>
                    <span className="text-slate-400">−</span>
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">Retention Amount</span>
                    <span className="text-slate-400">−</span>
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">Advance Received</span>
                    <span className="font-extrabold text-indigo-600">=</span>
                    <span className="rounded-md bg-[#0A0082] px-2 py-0.5 font-extrabold text-white shadow-2xs">
                      Remaining Receivable
                    </span>
                  </div>
                </div>

                {/* Primary Highlighted Remaining Receivable Card */}
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      Remaining Receivable
                    </span>
                    <span className="block text-[11px] text-emerald-600">Net outstanding balance to collect</span>
                  </div>
                  <span className="text-xl font-black text-emerald-900 sm:text-2xl">
                    {formatMoney(remainingAmount, currency) || "—"}
                  </span>
                </div>

                {/* Contract Value & PMS Budget Supporting Note Banner */}
                {isSameAmount && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2 text-xs font-medium text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Contract Value and PMS Project Budget are the same ({formatMoney(totalContractValue, currency)}).</span>
                  </div>
                )}
                {isDifferentAmount && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3.5 py-2 text-xs font-medium text-amber-900">
                    <Info className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      Contract Value ({formatMoney(totalContractValue, currency)}) is used for billing calculation because it differs from the PMS Project Budget ({formatMoney(pmsBudgetVal, currency)}).
                    </span>
                  </div>
                )}

                {/* Financial Breakdown Table */}
                <PricingTable
                  rows={[
                    ...contractBudgetRows,
                    { label: "Retention %", value: hasRetention ? `${retentionPercent}%` : "0%" },
                    {
                      label: "Retention Amount",
                      value: hasRetention ? `-${formatMoney(retentionAmount, currency)}` : formatMoney(0, currency),
                    },
                    { label: "Billable Amount", value: formatMoney(billableAmount, currency) },
                    {
                      label: "Advance Received",
                      value: hasAdvance ? `-${formatMoney(advanceReceived, currency)}` : formatMoney(0, currency),
                    },
                    { label: "Remaining Receivable", value: formatMoney(remainingAmount, currency), highlight: true },
                    ...(fixedPrice.remarks ? [{ label: "Remarks", value: fixedPrice.remarks }] : []),
                  ]}
                />
              </div>
            );
          })()}

          {billingConfig.billingType === "TIME_MATERIAL" && (
            <div className="space-y-3">
              {pricingModel && (
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-600">Pricing Mode:</span>
                  <span className="font-bold text-[#0A0082]">
                    {BILLING_MODE_LABELS[pricingModel] || pricingModel}
                  </span>
                </div>
              )}

              {(pricingModel === "STANDARD" || !pricingModel) && (
                <PricingTable
                  rows={[
                    {
                      label: "Standard Rate",
                      value: `${formatMoney(standardRate.rate, currency) || "—"} ${ratePeriodSuffix(standardRate.ratePeriod)}`,
                    },
                    { label: "Effective Period", value: standardRateDateRange },
                  ]}
                />
              )}

              {pricingModel === "ROLE_BASED" && <RoleRatesList roles={roleRateRows} currency={currency} />}
            </div>
          )}

          {billingConfig.billingType === "RECURRING" && (() => {
            const recurring = billingConfig.recurring || {};
            const totalVal = Number(recurring.contractValue) || 0;
            const pmsBudgetVal =
              recurring.pmsProjectBudget !== "" && recurring.pmsProjectBudget !== null && recurring.pmsProjectBudget !== undefined
                ? Number(recurring.pmsProjectBudget)
                : projectInfo.projectBudget !== "" && projectInfo.projectBudget !== null && projectInfo.projectBudget !== undefined
                ? Number(projectInfo.projectBudget)
                : null;

            const hasPmsBudget = pmsBudgetVal !== null && pmsBudgetVal !== undefined && !isNaN(pmsBudgetVal) && pmsBudgetVal > 0;
            const isSameAmount = hasPmsBudget && totalVal === pmsBudgetVal;
            const isDifferentAmount = hasPmsBudget && totalVal !== pmsBudgetVal;

            let contractBudgetRows = [];
            if (isSameAmount) {
              contractBudgetRows = [
                {
                  label: "Contract / Project Budget",
                  value: totalVal ? formatMoney(totalVal, currency) : "—",
                },
              ];
            } else if (isDifferentAmount) {
              contractBudgetRows = [
                {
                  label: (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span>Contract Value</span>
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                        Billing Amount Used
                      </span>
                    </span>
                  ),
                  value: totalVal ? formatMoney(totalVal, currency) : "—",
                },
                {
                  label: "PMS Project Budget",
                  value: formatMoney(pmsBudgetVal, currency),
                },
              ];
            } else {
              contractBudgetRows = [
                {
                  label: "Contract Value",
                  value: totalVal ? formatMoney(totalVal, currency) : "—",
                },
              ];
            }

            return (
              <div className="space-y-3">
                {isSameAmount && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2 text-xs font-medium text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Contract Value and PMS Project Budget are the same ({formatMoney(totalVal, currency)}).</span>
                  </div>
                )}
                {isDifferentAmount && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3.5 py-2 text-xs font-medium text-amber-900">
                    <Info className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      Contract Value ({formatMoney(totalVal, currency)}) is used for billing because it differs from the PMS Project Budget ({formatMoney(pmsBudgetVal, currency)}).
                    </span>
                  </div>
                )}
                <PricingTable
                  rows={[
                    ...contractBudgetRows,
                    { label: "Billing Frequency", value: billingFrequencyLabel },
                    {
                      label: "Billing Period",
                      value:
                        recurring.recurringStartDate || recurring.recurringEndDate
                          ? `${formatDisplayDate(recurring.recurringStartDate) || "—"} – ${
                              formatDisplayDate(recurring.recurringEndDate) || "Ongoing"
                            }`
                          : null,
                    },
                    ...(recurring.remarks ? [{ label: "Remarks", value: recurring.remarks }] : []),
                  ]}
                />
              </div>
            );
          })()}

          {billingConfig.billingType === "MILESTONE" && (
            <PricingTable rows={[{ label: "Milestones", value: `${(billingConfig.milestones || []).length} defined` }]} />
          )}
        </div>
      </CardShell>

      {/* SECTION 3: Billing Schedule (Full-Width Card) */}
      <CardShell icon={Calendar} title="Billing Schedule" stepId={2} onEdit={onEditStep}>
        {hasSchedule ? (
          <div className="space-y-1">
            <DataRow label="Billing Frequency" value={billingFrequencyLabel} />
            <DataRow
              label="Effective From"
              value={
                commercialEffectiveDates.from
                  ? formatDisplayDate(commercialEffectiveDates.from)
                  : projectInfo.startDate
                  ? formatDisplayDate(projectInfo.startDate)
                  : "—"
              }
            />
            <DataRow
              label="Effective To"
              value={
                commercialEffectiveDates.to
                  ? formatDisplayDate(commercialEffectiveDates.to) || "Ongoing"
                  : projectInfo.endDate
                  ? formatDisplayDate(projectInfo.endDate) || "Ongoing"
                  : "Ongoing"
              }
            />
            <DataRow
              label="Project Duration"
              value={
                projectInfo.startDate
                  ? `${formatDisplayDate(projectInfo.startDate)} – ${formatDisplayDate(projectInfo.endDate) || "Ongoing"}`
                  : "—"
              }
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-6 text-center">
            <Calendar className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">Billing schedule not applicable</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              This billing configuration type does not require a recurring schedule.
            </p>
          </div>
        )}
      </CardShell>

      {/* SECTION 4: Invoice & Control Settings (Full-Width Card) */}
      <CardShell icon={Receipt} title="Invoice & Control Settings" stepId={3} onEdit={onEditStep}>
        <div className="space-y-1">
          <DataRow
            label="Invoice Generation"
            value={
              controls.autoInvoiceGeneration === true
                ? "Automatic"
                : controls.autoInvoiceGeneration === false
                ? "Manual"
                : "—"
            }
          />
          {controls.autoInvoiceGeneration === true && (
            <DataRow
              label="Generation Day"
              value={controls.invoiceGenerationDay ? `Day ${controls.invoiceGenerationDay}` : "—"}
            />
          )}
          <DataRow
            label="Payment Terms"
            value={controls.paymentTermName || controls.paymentTerms || controls.paymentTermId || "—"}
          />
          <DataRow label="Tax Region" value={controls.taxRegionName || controls.taxRegionId || "—"} />
          <DataRow
            label="Expense Billing Eligibility"
            value={controls.expenseBillingEligible ? "Eligible" : "Not Eligible"}
          />
        </div>
      </CardShell>
    </div>
  );
}
