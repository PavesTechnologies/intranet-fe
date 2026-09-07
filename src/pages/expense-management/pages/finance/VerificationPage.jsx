import React, { useState, useMemo } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Inbox, Layers, ShieldAlert, Lock, FileStack, FilePlus2, Landmark } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import Button from "@/components/Button/Button";
import LoadingSpinner from "@/components/LoadingSpinner";
import { showStatusToast } from "@/components/toastfy/toast";
import { useFinanceQueue, useVerifyLineItem, useQueryLineItem } from "./hooks/useFinanceVerification";
import EmployeeLabel from "../../approval-engine/components/EmployeeLabel";
import FinanceLineItemReviewPanel from "./components/FinanceLineItemReviewPanel";
import FinanceReviewPanel from "./components/FinanceReviewPanel";
import { formatMoney } from "../../approval-engine/constants/approvalLabels";
import SearchInput from "@/components/filter/Searchbar";
import FormSelect from "@/components/forms/FormSelect";
import { PageCard, PageCardContent } from "@/components/Cards/PageCard";
import Pagination from "@/components/Pagination/pagination";
import { useEmployeeDirectory } from "../../approval-engine/hooks/useEmployeeDirectory";
import { useQueries } from "@tanstack/react-query";
import { lineItemService } from "@/pages/expense-management/api/expenseReportsApi";
import { financeVerificationApi } from "./api/financeVerificationApi";

const merchantSummary = (lineItems) => {
  if (!lineItems?.length) return "—";
  const first = lineItems[0]?.merchantName || lineItems[0]?.categoryName || lineItems[0]?.merchant || lineItems[0]?.category || "Line item";
  return lineItems.length > 1 ? `${first} +${lineItems.length - 1} more` : first;
};

const isLineEligible = (line) => {
  if (!line) return false;
  if (line.eligibleForVerify === false || line.eligible === false || line.isEligible === false) return false;
  if (line.ineligibleReason && String(line.ineligibleReason).trim().length > 0) return false;
  return true;
};

const hasIneligibleLines = (lineItems) => (lineItems || []).some((l) => !isLineEligible(l));

export default function VerificationPage() {
  const [page, setPage] = useState(0);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [reviewingReport, setReviewingReport] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState("");

  const { data, isLoading, isError, error, refetch } = useFinanceQueue(page, 20);
  const { data: directory } = useEmployeeDirectory();
  const verifyLineItem = useVerifyLineItem();
  const queryLineItem = useQueryLineItem();

  const items = data?.content || [];
  const isMutating = verifyLineItem.isPending || queryLineItem.isPending;

  const lineItemsQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["reportLineItems", item.reportId],
      queryFn: async () => {
        const res = await lineItemService.getAll(item.reportId);
        const payload = res.data?.data;
        return Array.isArray(payload) ? payload : payload?.lineItems || payload?.content || payload?.data || [];
      },
      staleTime: 30_000,
    })),
  });

  const reviewsQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["financeReviews", item.reportId],
      queryFn: async () => {
        const res = await financeVerificationApi.getReviews(item.reportId);
        return res.data?.data || [];
      },
      staleTime: 15_000,
    })),
  });

  const resolvedItems = useMemo(() => {
    return items.map((item, idx) => {
      const queriedLines = lineItemsQueries[idx]?.data;
      const backendLines = item.pendingLineItems || item.lineItems || item.items || item.pendingLines || [];
      const baseLines = (queriedLines && queriedLines.length > 0) ? queriedLines : backendLines;
      const reportReviews = reviewsQueries[idx]?.data || [];

      const mergedLines = baseLines.map((line) => {
        const qi = backendLines.find((b) => b.lineItemId === line.lineItemId) || {};
        return { ...line, ...qi };
      });

      // A line is pending verification if it has not been verified or queried.
      const pendingLineItems = mergedLines.filter((line) => {
        const lineReviews = reportReviews.filter((r) => r.lineItemId === line.lineItemId);
        const hasVerifiedOrQueried = lineReviews.some((r) => r.status === "VERIFIED" || r.status === "QUERIED");
        return !hasVerifiedOrQueried;
      });

      const finalPending = pendingLineItems.length > 0 ? pendingLineItems : mergedLines;

      return {
        ...item,
        pendingLineItems: finalPending,
      };
    });
  }, [items, lineItemsQueries, reviewsQueries]);

  const handleVerifyLine = (reportId, lineItemId) => {
    verifyLineItem.mutate(
      { reportId, lineItemId },
      {
        onSuccess: () => showStatusToast("Line item verified successfully", "success"),
        onError: (err) => showStatusToast(err.response?.data?.message || "Failed to verify line item", "error"),
      }
    );
  };

  const handleQueryLine = (reportId, lineItemId, reason) => {
    queryLineItem.mutate(
      { reportId, lineItemId, reason },
      {
        onSuccess: () => showStatusToast("Query raised successfully", "success"),
        onError: (err) => showStatusToast(err.response?.data?.message || "Failed to raise query", "error"),
      }
    );
  };

  // Stats calculation
  const totalReportsCount = data?.totalElements ?? resolvedItems.length;
  const totalPendingLines = resolvedItems.reduce((sum, item) => sum + (item.pendingLineItems?.length ?? 0), 0);
  const totalQueueValue = resolvedItems.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
  const firstCurrency = resolvedItems[0]?.currencyCode || "INR";

  // Client-side filtering & sorting by date (latest first)
  const filteredItems = useMemo(() => {
    const filtered = resolvedItems.filter((item) => {
      const reportNumber = (item.reportNumber || "").toLowerCase();
      const merchant = merchantSummary(item.pendingLineItems).toLowerCase();
      const empEntry = directory?.get(item.employeeId);
      const empName = (empEntry?.name || item.employeeId || "").toLowerCase();

      const query = searchTerm.toLowerCase();
      const matchesSearch =
        !query ||
        reportNumber.includes(query) ||
        merchant.includes(query) ||
        empName.includes(query);

      const hasIneligible = hasIneligibleLines(item.pendingLineItems);
      const matchesEligibility =
        !eligibilityFilter ||
        (eligibilityFilter === "READY" && !hasIneligible) ||
        (eligibilityFilter === "CONSTRAINTS" && hasIneligible);

      return matchesSearch && matchesEligibility;
    });

    return filtered.sort((a, b) => {
      const dateA = a.submittedAt || a.createdAt || a.approvedAt || a.submittedDate || a.expenseDate || a.date;
      const dateB = b.submittedAt || b.createdAt || b.approvedAt || b.submittedDate || b.expenseDate || b.date;
      const timeA = dateA ? new Date(dateA).getTime() : 0;
      const timeB = dateB ? new Date(dateB).getTime() : 0;
      return timeB - timeA;
    });
  }, [resolvedItems, searchTerm, eligibilityFilter, directory]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-3">
        <Breadcrumb
          items={[
            { label: "Expense Management", to: "/expense-management/dashboard" },
            { label: "Finance", to: "/expense-management/finance/verification" },
            { label: "Verification" },
          ]}
        />
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#0a174e]">Finance Verification</h1>
            <p className="text-xs text-gray-500 mt-0.5">Review and verify expense report line items for reimbursement.</p>
          </div>
        </div>
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16 shadow-sm">
          <LoadingSpinner text="Loading verification queue…" />
        </div>
      </div>
    );
  }

  // Handle error states (including 401 & 403)
  if (isError) {
    const errorStatus = error?.response?.status;
    const isAuthError = errorStatus === 401 || errorStatus === 403;
    return (
      <div className="p-4 sm:p-6 space-y-3">
        <Breadcrumb
          items={[
            { label: "Expense Management", to: "/expense-management/dashboard" },
            { label: "Finance", to: "/expense-management/finance/verification" },
            { label: "Verification" },
          ]}
        />
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#0a174e]">Finance Verification</h1>
            <p className="text-xs text-gray-500 mt-0.5">Review and verify expense report line items for reimbursement.</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-10 text-center px-4 shadow-sm">
          {isAuthError ? <Lock className="h-6 w-6 text-rose-500" /> : <AlertTriangle className="h-6 w-6 text-rose-500" />}
          <p className="text-sm font-semibold text-rose-700">
            {errorStatus === 401
              ? "Your session has expired. Please log in again."
              : errorStatus === 403
              ? "Access denied. You do not have the required role (FINANCE_EXECUTIVE) to view this page."
              : "Failed to load verification queue."}
          </p>
          <p className="text-xs text-rose-500 max-w-md">
            {error?.response?.data?.message || error?.message || "Please check your network connection and try again."}
          </p>
          {!isAuthError && (
            <Button size="small" variant="outline" className="mt-2" onClick={() => refetch()}>
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-3">
      <Breadcrumb
        items={[
          { label: "Expense Management", to: "/expense-management/dashboard" },
          { label: "Finance", to: "/expense-management/finance/verification" },
          { label: "Verification" },
        ]}
      />

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[#0a174e]">Finance Verification</h1>
          <p className="text-xs text-gray-500 mt-0.5">Review and verify expense report line items for reimbursement.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <FileStack size={18} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Reports</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{totalReportsCount}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <FilePlus2 size={18} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Pending Line Items</p>
            <p className="text-xl font-bold text-amber-600 mt-0.5">{totalPendingLines}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-green-50 text-green-600 rounded-lg">
            <Landmark size={18} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Queue Value</p>
            <p className="text-xl font-bold text-green-600 mt-0.5">{formatMoney(totalQueueValue, firstCurrency)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <SearchInput
              value={searchTerm}
              onSearch={(val) => setSearchTerm(val || "")}
              placeholder="Search by employee, merchant, or report #..."
              className="!py-1.5 !px-3 !text-xs"
            />
          </div>
          <FormSelect
            label="Eligibility"
            name="eligibilityFilter"
            value={eligibilityFilter}
            onChange={(e) => setEligibilityFilter(e.target.value)}
            options={[
              { label: "All Eligibilities", value: "" },
              { label: "Ready", value: "READY" },
              { label: "Constraints", value: "CONSTRAINTS" },
            ]}
            className="[&>label]:text-xs [&>label]:mb-1"
            buttonClassName="!py-1.5 !px-3 !text-xs"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        {items.length === 0 ? (
          <PageCard>
            <PageCardContent className="flex flex-col items-center justify-center text-center py-16">
              <Inbox className="h-10 w-10 text-gray-300 mb-3" />
              <h2 className="text-sm font-semibold text-gray-700">Nothing waiting on you right now</h2>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">Expense reports awaiting Finance verification will show up here.</p>
            </PageCardContent>
          </PageCard>
        ) : filteredItems.length === 0 ? (
          <PageCard>
            <PageCardContent className="flex flex-col items-center justify-center text-center py-16">
              <Layers className="h-10 w-10 text-gray-300 mb-3" />
              <h2 className="text-sm font-semibold text-gray-700">No Reports Found</h2>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">No verification items match the selected search criteria or filters.</p>
            </PageCardContent>
          </PageCard>
        ) : (
          <>
            <div className="w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm [&_td]:!py-2 [&_td]:!px-3 [&_td]:!text-xs [&_th]:!py-2.5 [&_th]:!px-3 [&_th]:!text-xs [&_table]:!text-xs [&_.rounded-full]:!text-[10px] [&_.rounded-full]:!px-2 [&_.rounded-full]:!py-0.5">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gradient-to-r from-blue-900 to-indigo-900 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  <tr>
                    <th className="w-8 px-3 py-2.5 text-white" />
                    <th className="px-3 py-2.5 text-white">Report</th>
                    <th className="px-3 py-2.5 text-white">Employee</th>
                    <th className="px-3 py-2.5 text-white">Merchant / Category</th>
                    <th className="px-3 py-2.5 text-white">Items Pending</th>
                    <th className="px-3 py-2.5 text-white">Level</th>
                    <th className="px-3 py-2.5 text-white">Eligibility</th>
                    <th className="px-3 py-2.5 text-white">Amount</th>
                    <th className="px-3 py-2.5 text-right text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredItems.map((item) => {
                    const isExpanded = expandedReportId === item.reportId;
                    const hasIneligible = hasIneligibleLines(item.pendingLineItems);
                    return (
                      <React.Fragment key={item.reportId}>
                        <tr
                          className="hover:bg-blue-50/40 transition cursor-pointer"
                          onClick={() => setExpandedReportId(isExpanded ? null : item.reportId)}
                        >
                          <td className="px-3 py-2 text-gray-400">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] font-semibold text-gray-700">{item.reportNumber}</td>
                          <td className="px-3 py-2 text-gray-600 font-medium">
                            <EmployeeLabel employeeId={item.employeeId} />
                          </td>
                          <td className="px-3 py-2 text-gray-600 max-w-[220px] truncate">
                            {merchantSummary(item.pendingLineItems)}
                          </td>
                          <td className="px-3 py-2 text-gray-600 font-medium">{item.pendingLineItems?.length ?? 0}</td>
                          <td className="px-3 py-2 text-gray-600">
                            <span className="inline-flex items-center gap-1">
                              <Layers className="h-3.5 w-3.5" /> Level {item.levelOrder}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {hasIneligible ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                                <ShieldAlert className="h-3 w-3" /> Constraints
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                                Ready
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-900 font-semibold whitespace-nowrap font-mono">
                            {formatMoney(item.totalAmount, item.currencyCode)}
                          </td>
                          <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex flex-wrap items-center justify-end gap-2">
                              <Button
                                size="small"
                                variant="outline"
                                className="!py-1 !px-2.5 !text-xs font-semibold shadow-sm hover:bg-slate-50 transition"
                                disabled={isMutating}
                                onClick={() => setReviewingReport(item)}
                              >
                                Review
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="bg-slate-50/60 p-0">
                              {hasIneligible && (
                                <p className="flex items-center gap-1.5 text-xs text-amber-700 px-4 pt-3">
                                  <ShieldAlert className="h-3.5 w-3.5" /> Contains line items that are currently ineligible for verification.
                                </p>
                              )}
                              <FinanceLineItemReviewPanel
                                reportId={item.reportId}
                                lineItems={item.pendingLineItems}
                                isBusy={isMutating}
                                onVerifyLine={(lineItemId) => handleVerifyLine(item.reportId, lineItemId)}
                                onQueryLine={(lineItemId, reason) => handleQueryLine(item.reportId, lineItemId, reason)}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data?.totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination
                  currentPage={page + 1}
                  totalPages={data.totalPages}
                  onPrevious={() => setPage((p) => Math.max(p - 1, 0))}
                  onNext={() => setPage((p) => Math.min(p + 1, data.totalPages - 1))}
                />
              </div>
            )}
          </>
        )}
      </div>

      {reviewingReport && (
        <FinanceReviewPanel
          isOpen={reviewingReport != null}
          onClose={() => setReviewingReport(null)}
          reportId={reviewingReport.reportId}
          queueItem={reviewingReport}
        />
      )}
    </div>
  );
}

