import { useEffect, useMemo, useState } from "react";
import { Eye, CheckCircle2, XCircle, ClipboardCheck, Clock, FolderKanban, Building2, Calendar, Receipt, Wallet, Info } from "lucide-react";

import PageHeader from "../../../components/ui/PageHeader";
import { PageCard, PageCardContent } from "../../../components/Cards/PageCard";
import { KPICard } from "../../../components/kpi/KPI";
import Button from "../../../components/Button/Button";
import Modal from "../../../components/Modal/modal";
import ConfirmationModal from "../../../components/confirmation_modal/ConfirmationModal";
import FormTextArea from "../../../components/forms/FormTextArea";
import SearchInput from "../../../components/filter/Searchbar";
import Pagination from "../../../components/Pagination/pagination";
import StatusBadge from "../../../components/status/statusbadge";
import { showStatusToast } from "../../../components/toastfy/toast";
import ARTable from "../components/common/ARTable";
import {
  approveBillingConfigurationRequest,
  formatApprovalStatusLabel,
  getApiErrorMessage,
  getBillingConfigurationForApproval,
  getPendingApprovalConfigurations,
  rejectBillingConfigurationRequest,
} from "../services/billingApprovalService";
import { fetchBillingConfigurations } from "../services/billingConfigService";
import { formatFrequencyLabel } from "../components/billing-setup/ReviewActivateStep";
import { BILLING_MODE_LABELS } from "../data/wizardOptions";
import { getBillingTypeDisplayName } from "../utils/billingType";

const PAGE_SIZE = 8;

const STATUS_TABS = {
  PENDING: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ALL: "ALL",
};

const TABLE_HEADERS = [
  "Project",
  "Client",
  "Billing Type",
  "Billing Frequency",
  "Payment Terms",
  "Tax Region",
  "Effective Period",
  "Approval Status",
  "Action",
];

const TABLE_COLUMNS = [
  "project",
  "client",
  "billingType",
  "billingFrequency",
  "paymentTerms",
  "taxRegion",
  "effectivePeriod",
  "approvalStatus",
  "action",
];

function parseTimestamp(val) {
  if (!val) return null;
  if (Array.isArray(val)) {
    const [y, m, d, h = 0, min = 0, s = 0] = val;
    return new Date(y, m - 1, d, h, min, s);
  }
  if (typeof val === "string" && val.includes(",")) {
    const parts = val.split(",").map((p) => parseInt(p.trim(), 10)).filter((p) => !isNaN(p));
    if (parts.length >= 3) {
      const [y, m, d, h = 0, min = 0, s = 0] = parts;
      return new Date(y, m - 1, d, h, min, s);
    }
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function formatDate(value) {
  const date = parseTimestamp(value);
  if (!date) return typeof value === "string" && !value.includes(",") ? value : "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  const date = parseTimestamp(value);
  if (!date) return typeof value === "string" && !value.includes(",") ? value : "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatMoney(value, currency) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num);
  return currency ? `${currency} ${formatted}` : formatted;
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 text-xs last:border-0">
      <span className="text-slate-500 font-medium">{label}</span>
      <span className="text-right font-bold text-slate-900">{value || "—"}</span>
    </div>
  );
}

function ReviewSection({ title, rows }) {
  return (
    <PageCard className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <PageCardContent className="p-0">
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">{title}</h3>
        </div>
        <div className="px-5">
          {rows.map((row, index) => (
            <InfoRow key={`${row.label}-${index}`} label={row.label} value={row.value} />
          ))}
        </div>
      </PageCardContent>
    </PageCard>
  );
}

// Finance Manager (Checker) queue for the Maker-Checker billing configuration workflow.
export default function BillingApprovals() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState(STATUS_TABS.PENDING);
  const [currentPage, setCurrentPage] = useState(1);

  const [reviewingId, setReviewingId] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);

  const [approveLoading, setApproveLoading] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  const loadAllApprovals = async () => {
    setLoading(true);
    try {
      const [pendingResult, allConfigs] = await Promise.allSettled([
        getPendingApprovalConfigurations(),
        fetchBillingConfigurations(),
      ]);

      const pendingList = pendingResult.status === "fulfilled" ? pendingResult.value : [];
      const allList = allConfigs.status === "fulfilled" ? allConfigs.value : [];

      const combinedMap = new Map();
      allList.forEach((item) => {
        const id = item.id || item.billingConfigurationId;
        if (!id) return;
        combinedMap.set(id, {
          billingConfigurationId: id,
          projectName: item.projectName || "—",
          projectCode: item.projectCode || "—",
          clientName: item.client || item.clientName || "—",
          billingTypeName: item.billingType || item.billingTypeName || "—",
          billingFrequencyName: item.billingFrequency || item.billingFrequencyName || "—",
          paymentTermName: item.paymentTerms || item.paymentTermName || "—",
          taxRegionName: item.taxRegion || item.taxRegionName || "—",
          effectiveFrom: item.startDate || item.effectiveFrom || "",
          effectiveTo: item.endDate || item.effectiveTo || "",
          submittedBy: item.submittedBy || item.createdBy || "—",
          approvalStatus: item.approvalStatus || "DRAFT",
          billingStatus: item.billingStatus || "INACTIVE",
          createdAt: item.createdAt || "",
          updatedAt: item.updatedAt || "",
        });
      });

      pendingList.forEach((item) => {
        if (item.billingConfigurationId) {
          combinedMap.set(item.billingConfigurationId, item);
        }
      });

      setConfigs(Array.from(combinedMap.values()));
    } catch (error) {
      showStatusToast(getApiErrorMessage(error, "Failed to load billing configuration approvals."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllApprovals();
  }, []);

  const tabCounts = useMemo(() => {
    return {
      PENDING: configs.filter((c) => c.approvalStatus === "PENDING_APPROVAL").length,
      APPROVED: configs.filter((c) => c.approvalStatus === "APPROVED").length,
      REJECTED: configs.filter((c) => c.approvalStatus === "REJECTED").length,
      ALL: configs.length,
    };
  }, [configs]);

  const kpiCards = [
    { label: "Total Requests", value: tabCounts.ALL, icon: FolderKanban, color: "bg-[#0A0082] text-white" },
    { label: "Pending Approvals", value: tabCounts.PENDING, icon: Clock, color: "bg-amber-500 text-white" },
    { label: "Approved", value: tabCounts.APPROVED, icon: CheckCircle2, color: "bg-emerald-600 text-white" },
    { label: "Rejected", value: tabCounts.REJECTED, icon: XCircle, color: "bg-rose-600 text-white" },
  ];

  const handleTabChange = (key) => {
    setStatusTab(key);
    setCurrentPage(1);
  };

  const filteredConfigs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return configs.filter((c) => {
      let matchesTab = true;
      if (statusTab !== STATUS_TABS.ALL) {
        matchesTab = c.approvalStatus === statusTab;
      }
      const matchesSearch =
        !q ||
        (c.projectName || "").toLowerCase().includes(q) ||
        (c.projectCode || "").toLowerCase().includes(q) ||
        (c.clientName || "").toLowerCase().includes(q) ||
        (c.submittedBy || "").toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });
  }, [configs, statusTab, searchQuery]);

  const totalPages = Math.ceil(filteredConfigs.length / PAGE_SIZE) || 1;
  const paginatedConfigs = useMemo(
    () => filteredConfigs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredConfigs, currentPage]
  );

  const handleSearchInputChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleReview = async (config) => {
    setReviewingId(config.billingConfigurationId);
    try {
      const detail = await getBillingConfigurationForApproval(config.billingConfigurationId);
      setReviewTarget(detail);
    } catch (error) {
      showStatusToast(getApiErrorMessage(error, "Failed to load billing configuration details."), "error");
    } finally {
      setReviewingId(null);
    }
  };

  const closeReview = () => {
    if (approveLoading) return;
    setReviewTarget(null);
  };

  const openRejectModal = () => {
    setRejectTarget(reviewTarget);
    setRejectionReason("");
    setReviewTarget(null);
  };

  const closeRejectModal = () => {
    if (rejectLoading) return;
    setRejectTarget(null);
    setRejectionReason("");
  };

  // Approving is a single click from the review screen — no extra "are you
  // sure" step, since the review screen itself is already the confirmation.
  const handleApprove = async () => {
    if (!reviewTarget) return;
    setApproveLoading(true);
    try {
      await approveBillingConfigurationRequest(reviewTarget.billingConfigurationId);
      showStatusToast("Billing Configuration approved successfully.", "success");
      setReviewTarget(null);
      await loadAllApprovals();
    } catch (error) {
      showStatusToast(getApiErrorMessage(error, "Failed to approve billing configuration."), "error");
    } finally {
      setApproveLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectionReason.trim()) {
      showStatusToast("Please enter a reason for rejection.", "warning");
      return;
    }

    setRejectLoading(true);
    try {
      await rejectBillingConfigurationRequest(rejectTarget.billingConfigurationId, rejectionReason.trim());
      showStatusToast("Billing Configuration rejected successfully.", "success");
      setRejectTarget(null);
      setRejectionReason("");
      await loadAllApprovals();
    } catch (error) {
      showStatusToast(getApiErrorMessage(error, "Failed to reject billing configuration."), "error");
    } finally {
      setRejectLoading(false);
    }
  };

  const tableRows = useMemo(
    () =>
      paginatedConfigs.map((config) => ({
        project: (
          <div className="text-left">
            <div className="font-semibold text-slate-900">{config.projectName || "—"}</div>
            <div className="text-xs text-slate-400">{config.projectCode || "—"}</div>
          </div>
        ),
        client: config.clientName || "—",
        billingType: getBillingTypeDisplayName(config.billingTypeName) || "—",
        billingFrequency: config.billingFrequencyName || "—",
        paymentTerms: config.paymentTermName || "—",
        taxRegion: config.taxRegionName || "—",
        effectivePeriod: `${formatDate(config.effectiveFrom)} – ${formatDate(config.effectiveTo) || "Ongoing"}`,
        approvalStatus: <StatusBadge label={formatApprovalStatusLabel(config.approvalStatus)} size="sm" />,
        action: (
          <Button
            variant="outline"
            size="small"
            onClick={() => handleReview(config)}
            loading={reviewingId === config.billingConfigurationId}
            loadingText="Loading..."
          >
            <Eye className="h-3.5 w-3.5" /> Review
          </Button>
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paginatedConfigs, reviewingId]
  );

  const tabsList = [
    { key: STATUS_TABS.PENDING, label: "Pending Approvals", icon: Clock, count: tabCounts.PENDING },
    { key: STATUS_TABS.APPROVED, label: "Approved", icon: CheckCircle2, count: tabCounts.APPROVED },
    { key: STATUS_TABS.REJECTED, label: "Rejected", icon: XCircle, count: tabCounts.REJECTED },
    { key: STATUS_TABS.ALL, label: "All Requests", icon: FolderKanban, count: tabCounts.ALL },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Page Header */}
      <PageHeader
        title="Billing Configuration Approvals"
        subtitle="Review, approve, or reject billing configuration setups submitted by Finance Executives."
      />

      {/* 2. Summary KPI Cards (Total, Pending, Approved, Rejected) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpiCards.map((kpi) => (
          <KPICard
            key={kpi.label}
            label={kpi.label}
            value={loading ? "…" : kpi.value}
            icon={<kpi.icon className="h-5 w-5" />}
            color={kpi.color}
            className="h-full w-full bg-white shadow-sm"
          />
        ))}
      </div>

      {/* 3. Main Data Card */}
      <PageCard>
        <PageCardContent className="p-4 sm:p-5 space-y-4">
          {/* Status Tabs Navigation */}
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-2 overflow-x-auto sm:space-x-4" aria-label="Approval Status Tabs">
              {tabsList.map((tab) => {
                const isActive = statusTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    className={`group inline-flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? "border-[#0A0082] text-[#0A0082]"
                        : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? "text-[#0A0082]" : "text-slate-400 group-hover:text-slate-500"}`} />
                    <span>{tab.label}</span>
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        isActive
                          ? "bg-[#0A0082]/10 text-[#0A0082]"
                          : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                      }`}
                    >
                      {loading ? "…" : tab.count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-md">
              <SearchInput
                value={searchQuery}
                onChange={handleSearchInputChange}
                onSearch={(val) => setSearchQuery(val)}
                placeholder="Search by project, code, or client..."
              />
            </div>
          </div>

          <ARTable
            headers={TABLE_HEADERS}
            columns={TABLE_COLUMNS}
            rows={tableRows}
            loading={loading}
            emptyMessage="No billing configuration requests found for this filter."
          />

          {!loading && filteredConfigs.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPrevious={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              onNext={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
            />
          )}
        </PageCardContent>
      </PageCard>

      {/* 4. Detailed Executive Review Modal — Contract Value & PMS Budget displayed separately */}
      <Modal
        isOpen={Boolean(reviewTarget)}
        onClose={closeReview}
        title="Review Billing Configuration Request"
        subtitle={reviewTarget ? `${reviewTarget.projectName || "—"} (${reviewTarget.clientName || "—"})` : ""}
        titleIcon={<ClipboardCheck className="h-5 w-5 text-[#0A0082]" />}
        size="3xl"
        footer={
          reviewTarget && (
            <div className="flex justify-end gap-2">
              {reviewTarget.approvalStatus === "PENDING_APPROVAL" ? (
                <>
                  <Button variant="danger" size="small" onClick={openRejectModal} disabled={approveLoading}>
                    <XCircle className="h-4 w-4" /> Reject Configuration
                  </Button>
                  <Button
                    variant="success"
                    size="small"
                    onClick={handleApprove}
                    loading={approveLoading}
                    loadingText="Approving..."
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve Configuration
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="small" onClick={closeReview}>
                  Close
                </Button>
              )}
            </div>
          )
        }
      >
        {reviewTarget && (() => {
          const typeUpper = String(reviewTarget.billingTypeName || reviewTarget.billingType || "").toUpperCase();
          const isTimesheetBased = typeUpper.includes("TIMESHEET") || typeUpper.includes("TIME") || typeUpper.includes("MATERIAL");
          const isFixedPrice = typeUpper.includes("FIXED");
          const isRecurring = typeUpper.includes("RECURRING");
          const isMilestone = typeUpper.includes("MILESTONE");

          const currency = reviewTarget.currencyCode || reviewTarget.currency || "";

          // reviewTarget.contractValue/pmsProjectBudget/contractValueSource and every
          // commercial figure below already come straight from the billing-type-specific
          // details section (fixedPriceDetails/recurringDetails) via
          // normalizeApprovalConfiguration — read them as-is, never recomputed here.
          const contractVal = Number(reviewTarget.contractValue) || 0;
          const pmsBudgetVal = Number(reviewTarget.pmsProjectBudget) || 0;

          const hasContractVal = contractVal > 0;
          const hasPmsBudget = pmsBudgetVal > 0;
          const isSameAmount = hasPmsBudget && hasContractVal && contractVal === pmsBudgetVal;
          const isDifferentAmount = hasPmsBudget && hasContractVal && contractVal !== pmsBudgetVal;

          const sourceRaw = reviewTarget.contractValueSource;

          const sourceLabel =
            sourceRaw === "PMS" || sourceRaw === "PMS_BUDGET"
              ? "PMS Project Budget"
              : sourceRaw === "MANUAL"
              ? "Manual Input"
              : sourceRaw
              ? String(sourceRaw)
              : hasContractVal && isSameAmount
              ? "PMS Project Budget"
              : "Manual Input";

          const retentionPercent = Number(reviewTarget.retentionPercent) || 0;
          const retentionAmount = Number(reviewTarget.retentionAmount) || 0;
          const hasRetention = retentionAmount > 0 || retentionPercent > 0;

          const billableAmount = Number(reviewTarget.billableAmount) || 0;

          const advanceReceived = Number(reviewTarget.advanceReceived) || 0;
          const hasAdvance = advanceReceived > 0;

          const remainingAmount = Number(reviewTarget.remainingAmount) || 0;

          const billingFreqLabel = formatFrequencyLabel(
            reviewTarget.billingFrequency,
            reviewTarget.billingFrequencyName,
            reviewTarget.billingFrequencyId,
            isFixedPrice || String(reviewTarget.billingTypeName || "").toUpperCase().includes("ONE")
          );

          const hasSchedule = Boolean(reviewTarget.effectiveFrom || reviewTarget.effectiveTo || reviewTarget.billingFrequency);

          return (
            <div className="space-y-4">
              {/* 1. Commercial Configuration */}
              <ReviewSection
                title="Commercial Configuration"
                rows={[
                  {
                    label: "Billing Type",
                    value: getBillingTypeDisplayName(reviewTarget.billingTypeName || reviewTarget.billingType),
                  },
                  { label: "Billing Frequency", value: billingFreqLabel },
                  { label: "Currency", value: currency },
                  { label: "PMS Project Budget", value: formatMoney(pmsBudgetVal, currency) },
                  ...(hasContractVal
                    ? [
                        {
                          label: (
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span>Contract Value</span>
                              {isDifferentAmount && (
                                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                                  Billing Amount Used
                                </span>
                              )}
                            </span>
                          ),
                          value: formatMoney(contractVal, currency),
                        },
                        { label: "Contract Value Source", value: sourceLabel },
                      ]
                    : []),
                  ...(isTimesheetBased && reviewTarget.pricingModel
                    ? [{ label: "Pricing Model", value: BILLING_MODE_LABELS[reviewTarget.pricingModel] || reviewTarget.pricingModel }]
                    : []),
                ]}
              />

              {/* 2. Billing & Pricing Details */}
              {isFixedPrice && (
                <div className="space-y-3">
                  <PageCard className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                      Fixed Price Financial Summary
                    </h3>

                    {/* Financial Formula Banner */}
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
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Remaining Receivable</span>
                        <span className="block text-[11px] text-emerald-600">Net outstanding balance to collect</span>
                      </div>
                      <span className="text-xl font-black text-emerald-900 sm:text-2xl">
                        {formatMoney(remainingAmount, currency) || "—"}
                      </span>
                    </div>

                    {/* SAME vs DIFFERENT Budget Warning Banner */}
                    {isSameAmount && (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2 text-xs font-medium text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>Contract Value and PMS Project Budget are the same ({formatMoney(contractVal, currency)}).</span>
                      </div>
                    )}
                    {isDifferentAmount && (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3.5 py-2 text-xs font-medium text-amber-900">
                        <Info className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>
                          Contract Value ({formatMoney(contractVal, currency)}) is used for billing calculation because it differs from PMS Project Budget ({formatMoney(pmsBudgetVal, currency)}).
                        </span>
                      </div>
                    )}

                    {/* Financial Breakdown Table */}
                    <div className="divide-y divide-slate-100 text-xs">
                      <div className="flex justify-between py-2">
                        <span className="text-slate-500 font-medium">Contract Value (Billing Amount)</span>
                        <span className="font-bold text-slate-900">{formatMoney(contractVal, currency) || "—"}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-slate-500 font-medium">PMS Project Budget</span>
                        <span className="font-bold text-slate-900">{formatMoney(pmsBudgetVal, currency) || "—"}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-slate-500 font-medium">Contract Value Source</span>
                        <span className="font-bold text-slate-900">{sourceLabel}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-slate-500 font-medium">Retention %</span>
                        <span className="font-bold text-slate-900">{hasRetention ? `${retentionPercent}%` : "0%"}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-slate-500 font-medium">Retention Amount</span>
                        <span className="font-bold text-slate-900">{hasRetention ? `-${formatMoney(retentionAmount, currency)}` : formatMoney(0, currency)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-slate-500 font-medium">Billable Amount</span>
                        <span className="font-bold text-slate-900">{formatMoney(billableAmount, currency)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-slate-500 font-medium">Advance Received</span>
                        <span className="font-bold text-slate-900">{hasAdvance ? `-${formatMoney(advanceReceived, currency)}` : formatMoney(0, currency)}</span>
                      </div>
                      <div className="flex justify-between py-2 bg-emerald-50/40 px-2 rounded">
                        <span className="text-emerald-800 font-bold">Remaining Receivable</span>
                        <span className="font-extrabold text-emerald-900">{formatMoney(remainingAmount, currency)}</span>
                      </div>
                    </div>
                  </PageCard>
                </div>
              )}

              {isTimesheetBased && (
                <ReviewSection
                  title="Timesheet Rates & Pricing"
                  rows={[
                    { label: "Pricing Mode", value: BILLING_MODE_LABELS[reviewTarget.pricingModel] || reviewTarget.pricingModel || "Standard" },
                    ...(reviewTarget.hourlyRate ? [{ label: "Standard Rate", value: `${formatMoney(reviewTarget.hourlyRate, currency)} / hr` }] : []),
                    { label: "PMS Project Budget", value: formatMoney(pmsBudgetVal, currency) },
                  ]}
                />
              )}

              {isRecurring && (
                <div className="space-y-3">
                  {isSameAmount && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2 text-xs font-medium text-emerald-900">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>Contract Value and PMS Project Budget are the same ({formatMoney(contractVal, currency)}).</span>
                    </div>
                  )}
                  {isDifferentAmount && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3.5 py-2 text-xs font-medium text-amber-900">
                      <Info className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        Contract Value ({formatMoney(contractVal, currency)}) is used for billing calculation because it differs from PMS Project Budget ({formatMoney(pmsBudgetVal, currency)}).
                      </span>
                    </div>
                  )}
                  <ReviewSection
                    title="Recurring Pricing Details"
                    rows={[
                      { label: "Contract Value (Billing Amount)", value: formatMoney(contractVal, currency) },
                      { label: "PMS Project Budget", value: formatMoney(pmsBudgetVal, currency) },
                      { label: "Contract Value Source", value: sourceLabel },
                    ]}
                  />
                </div>
              )}

              {/* 3. Billing Schedule */}
              <PageCard className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
                <PageCardContent className="p-0">
                  <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#0A0082]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Billing Schedule</h3>
                  </div>
                  <div className="p-4">
                    {hasSchedule ? (
                      <div className="space-y-1">
                        <InfoRow label="Billing Frequency" value={billingFreqLabel} />
                        <InfoRow label="Effective From" value={formatDate(reviewTarget.effectiveFrom)} />
                        <InfoRow label="Effective To" value={formatDate(reviewTarget.effectiveTo) || "Ongoing"} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 text-center">
                        <Calendar className="h-7 w-7 text-slate-300 mb-1" />
                        <p className="text-xs font-semibold text-slate-600">Billing schedule not applicable</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">This configuration does not require a recurring schedule.</p>
                      </div>
                    )}
                  </div>
                </PageCardContent>
              </PageCard>

              {/* 4. Invoice & Tax Controls */}
              <ReviewSection
                title="Invoice & Tax Controls"
                rows={[
                  { label: "Payment Terms", value: reviewTarget.paymentTermName || reviewTarget.paymentTerms },
                  { label: "Tax Region", value: reviewTarget.taxRegionName || reviewTarget.taxRegion },
                  { label: "Invoice Generation Mode", value: reviewTarget.invoiceGenerationType || (reviewTarget.autoInvoiceGeneration ? "Automatic" : "Manual") },
                  ...(reviewTarget.autoInvoiceGeneration && reviewTarget.invoiceGenerationDay
                    ? [{ label: "Generation Day", value: `Day ${reviewTarget.invoiceGenerationDay}` }]
                    : []),
                  { label: "Expense Billing Eligibility", value: reviewTarget.expenseBillingEligible ? "Eligible" : "Not Eligible" },
                ]}
              />

              {/* 5. Submission & Workflow Information */}
              <ReviewSection
                title="Submission & Workflow Information"
                rows={[
                  {
                    label: "Approval Status",
                    value: <StatusBadge label={formatApprovalStatusLabel(reviewTarget.approvalStatus)} size="sm" />,
                  },
                  {
                    label: "Billing Status",
                    value: <StatusBadge label={formatApprovalStatusLabel(reviewTarget.billingStatus)} size="sm" />,
                  },
                  { label: "Submitted By", value: reviewTarget.submittedBy },
                  { label: "Submitted Date", value: formatDateTime(reviewTarget.createdAt) },
                  { label: "Last Updated", value: formatDateTime(reviewTarget.updatedAt) },
                  ...(reviewTarget.rejectionReason ? [{ label: "Rejection Reason", value: reviewTarget.rejectionReason }] : []),
                ]}
              />
            </div>
          );
        })()}
      </Modal>

      {/* 5. Reject Confirmation — shared ConfirmationModal, reason kept as a required field */}
      <ConfirmationModal
        isOpen={Boolean(rejectTarget)}
        title="Reject Billing Configuration"
        message={`Please provide a reason for rejecting the billing setup for ${
          rejectTarget?.projectName || "this project"
        } (${rejectTarget?.clientName || "—"}).`}
        confirmText="Reject Configuration"
        cancelText="Cancel"
        variant="danger"
        isLoading={rejectLoading}
        onConfirm={handleConfirmReject}
        onCancel={closeRejectModal}
      >
        <FormTextArea
          label="Rejection Reason *"
          name="rejectionReason"
          value={rejectionReason}
          onChange={(event) => setRejectionReason(event.target.value)}
          placeholder="Specify why this configuration is being rejected..."
          rows={4}
          required
          disabled={rejectLoading}
        />
      </ConfirmationModal>
    </div>
  );
}
