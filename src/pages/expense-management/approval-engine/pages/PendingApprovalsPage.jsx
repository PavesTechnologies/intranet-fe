import React, { useState, useMemo } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Inbox, Layers, ShieldAlert, XCircle } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import Button from "@/components/Button/Button";
import LoadingSpinner from "@/components/LoadingSpinner";
import { showStatusToast } from "@/components/toastfy/toast";
import {
  useMyQueue,
  useReviewLineItem,
  useRejectReport,
  useBulkApprove,
} from "../hooks/useApprovalWorkflow";
import { useApprovalLiveSync } from "../hooks/useApprovalLiveSync";
import { formatMoney } from "../constants/approvalLabels";
import EmployeeLabel from "../components/EmployeeLabel";
import LineItemReviewPanel from "../components/LineItemReviewPanel";
import CommentPromptModal from "../components/CommentPromptModal";
import MyDelegateCard from "../components/MyDelegateCard";
import ExpenseReviewPanel from "../components/ExpenseReviewPanel";
import { useQueries } from "@tanstack/react-query";
import { lineItemService } from "@/pages/expense-management/api/expenseReportsApi";
import { approvalWorkflowApi } from "../api/approvalWorkflowApi";

const merchantSummary = (lineItems) => {
  if (!lineItems?.length) return "—";
  const first = lineItems[0]?.merchantName || lineItems[0]?.categoryName || lineItems[0]?.merchant || lineItems[0]?.category || "Line item";
  return lineItems.length > 1 ? `${first} +${lineItems.length - 1} more` : first;
};

const hasPolicyIssue = (lineItems) => (lineItems || []).some((l) => (l.policyViolations && l.policyViolations.length > 0) || (l.policyWarnings && l.policyWarnings.length > 0));

/**
 * The approver's queue - every report where the caller (or their active delegate) currently has an
 * ACTIVE assignment (GET /xms/approvals/my-queue, server-side paginated). Row expansion still
 * offers the fast quick-approve line panel; "Review" opens the full ExpenseReviewPanel (receipt +
 * full detail + timeline) for reports that need a closer look.
 */
export default function PendingApprovalsPage({ searchTerm = "" }) {
  const [page, setPage] = useState(0);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [rejectingReport, setRejectingReport] = useState(null);
  const [reviewingItem, setReviewingItem] = useState(null);

  useApprovalLiveSync();

  const { data, isLoading, isError, refetch } = useMyQueue(page, 20);
  const reviewLineItem = useReviewLineItem();
  const rejectReport = useRejectReport();
  const bulkApprove = useBulkApprove();

  const items = data?.content || [];

  const lineItemsQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["reportLineItems", item.reportId],
      queryFn: async () => {
        try {
          const res = await lineItemService.getAll(item.reportId);
          const payload = res.data?.data;
          return Array.isArray(payload) ? payload : payload?.lineItems || payload?.content || payload?.data || [];
        } catch {
          return [];
        }
      },
      staleTime: 30_000,
    })),
  });

  const reviewsQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["reportReviews", item.reportId],
      queryFn: async () => {
        try {
          const res = await approvalWorkflowApi.getLineItemReviews(item.reportId);
          return res.data?.data || [];
        } catch {
          return [];
        }
      },
      staleTime: 15_000,
    })),
  });

  const resolvedItems = useMemo(() => {
    return items.map((item, idx) => {
      const queriedLines = lineItemsQueries[idx]?.data;
      const backendLines = item.pendingLineItems || item.lineItems || item.items || item.pendingLines || [];
      const allLines = (queriedLines && queriedLines.length > 0) ? queriedLines : backendLines;
      const reportReviews = reviewsQueries[idx]?.data || [];

      const currentLevel = item.levelOrder ?? item.currentLevelOrder;

      const pendingLineItems = allLines.filter((line) => {
        const lineReviews = reportReviews.filter((r) => r.lineItemId === line.lineItemId);
        if (!lineReviews.length) return true;
        const currentLevelReview = lineReviews.find(
          (r) => (currentLevel != null ? r.levelOrder === currentLevel : true)
        );
        if (!currentLevelReview) return true;
        return (
          currentLevelReview.status === "PENDING" ||
          (currentLevelReview.status !== "APPROVED" && currentLevelReview.status !== "NEEDS_CORRECTION")
        );
      });

      const finalPendingLines = pendingLineItems.length > 0 ? pendingLineItems : allLines;

      return {
        ...item,
        pendingLineItems: finalPendingLines,
        levelOrder: item.levelOrder ?? item.currentLevelOrder ?? 1,
      };
    });
  }, [items, lineItemsQueries, reviewsQueries]);

  const filteredItems = useMemo(() => {
    const filtered = resolvedItems.filter((item) => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      const reportNum = (item.reportNumber || "").toLowerCase();
      const merchant = merchantSummary(item.pendingLineItems).toLowerCase();
      return reportNum.includes(q) || merchant.includes(q);
    });

    return filtered.sort((a, b) => {
      const dateA = a.submittedAt || a.createdAt || a.approvedAt || a.submittedDate || a.expenseDate || a.date;
      const dateB = b.submittedAt || b.createdAt || b.approvedAt || b.submittedDate || b.expenseDate || b.date;
      const timeA = dateA ? new Date(dateA).getTime() : 0;
      const timeB = dateB ? new Date(dateB).getTime() : 0;
      return timeB - timeA;
    });
  }, [resolvedItems, searchTerm]);
  const isMutating = reviewLineItem.isPending || rejectReport.isPending || bulkApprove.isPending;

  const handleApproveLine = (reportId, lineItemId) => {
    reviewLineItem.mutate(
      { reportId, lineItemId, decision: "APPROVED" },
      {
        onError: (err) => showStatusToast(err.response?.data?.message || "Failed to approve line item", "error"),
      },
    );
  };

  const handleFlagLine = (reportId, lineItemId, comment) => {
    reviewLineItem.mutate(
      { reportId, lineItemId, decision: "NEEDS_CORRECTION", comment },
      {
        onSuccess: () => showStatusToast("Line item flagged for correction", "success"),
        onError: (err) => showStatusToast(err.response?.data?.message || "Failed to flag line item", "error"),
      },
    );
  };

  const handleBulkApprove = (reportId) => {
    bulkApprove.mutate(reportId, {
      onSuccess: () => showStatusToast("Report bulk-approved", "success"),
      onError: (err) => showStatusToast(err.response?.data?.message || "Bulk approve failed", "error"),
    });
  };

  const renderActions = (item) => (
    <div className="inline-flex flex-wrap items-center justify-end gap-2">
      <Button size="small" variant="outline" disabled={isMutating} onClick={() => setReviewingItem(item)}>
        Review
      </Button>
      {item.eligibleForBulkApprove && (
        <Button size="small" variant="success" disabled={isMutating} onClick={() => handleBulkApprove(item.reportId)}>
          Bulk Approve
        </Button>
      )}
      <Button size="small" variant="outline" disabled={isMutating} onClick={() => setRejectingReport(item)}>
        <XCircle className="h-3.5 w-3.5" /> Reject
      </Button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6">
      <Breadcrumb
        items={[
          { label: "Expense Management", to: "/expense-management/dashboard" },
          { label: "Approvals" },
          { label: "Pending" },
        ]}
      />

      <h1 className="text-xl font-semibold text-gray-900 mt-3 mb-4">Pending Approvals</h1>

      <MyDelegateCard />

      {isLoading && (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <LoadingSpinner text="Loading your queue…" />
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          <p className="text-sm text-rose-700">Failed to load your queue.</p>
          <Button size="small" variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Inbox className="h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">Nothing waiting on you right now.</p>
          <p className="text-xs text-gray-400">Reports assigned to you for approval will show up here.</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-900 to-indigo-900 text-left text-xs font-semibold text-white uppercase">
                  <tr>
                    <th className="w-8 px-2.5 py-2" />
                    <th className="px-2.5 py-2">Report</th>
                    <th className="px-2.5 py-2">Employee</th>
                    <th className="px-2.5 py-2">Merchant / Category</th>
                    <th className="px-2.5 py-2">Items Pending</th>
                    <th className="px-2.5 py-2">Level</th>
                    <th className="px-2.5 py-2">Policy</th>
                    <th className="px-2.5 py-2">Amount</th>
                    <th className="px-2.5 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.map((item, index) => {
                    const isExpanded = expandedReportId === item.reportId;
                    const flagged = hasPolicyIssue(item.pendingLineItems);
                    return (
                      <React.Fragment key={item.reportId}>
                        <tr className={`transition cursor-pointer ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50`} onClick={() => setExpandedReportId(isExpanded ? null : item.reportId)}>
                          <td className="px-2.5 py-1.5 text-gray-400">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </td>
                          <td className="px-2.5 py-1.5">
                            <span className="font-mono text-[11px] font-semibold text-gray-700">{item.reportNumber}</span>
                          </td>
                          <td className="px-2.5 py-1.5">
                            <span className="font-medium text-xs text-gray-900">
                              <EmployeeLabel employeeId={item.employeeId} />
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 text-gray-600 max-w-[220px] truncate text-xs">{merchantSummary(item.pendingLineItems)}</td>
                          <td className="px-2.5 py-1.5 text-gray-600 text-xs">{item.pendingLineItems?.length ?? 0}</td>
                          <td className="px-2.5 py-1.5 text-gray-600 text-xs">
                            <span className="inline-flex items-center gap-1">
                              <Layers className="h-3.5 w-3.5" /> Level {item.levelOrder}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5">
                            {flagged ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                <ShieldAlert className="h-3 w-3" /> Warning
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                Clear
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 text-gray-900 font-medium whitespace-nowrap text-xs">{formatMoney(item.totalAmount, item.currencyCode)}</td>
                          <td className="px-2.5 py-1.5 text-right text-xs" onClick={(e) => e.stopPropagation()}>
                            {renderActions(item)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="bg-gray-50/60 p-0">
                              {flagged && (
                                <p className="flex items-center gap-1.5 text-xs text-amber-700 px-4 pt-3">
                                  <ShieldAlert className="h-3.5 w-3.5" /> Has open policy violations - not eligible for bulk approval.
                                </p>
                              )}
                              <LineItemReviewPanel
                                reportId={item.reportId}
                                lineItems={item.pendingLineItems}
                                isBusy={isMutating}
                                onApproveLine={(lineItemId) => handleApproveLine(item.reportId, lineItemId)}
                                onFlagLine={(lineItemId, comment) => handleFlagLine(item.reportId, lineItemId, comment)}
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
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => {
              const flagged = hasPolicyIssue(item.pendingLineItems);
              return (
                <div key={item.reportId} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{item.reportNumber}</p>
                      <p className="text-sm text-gray-500">
                        <EmployeeLabel employeeId={item.employeeId} />
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-gray-900">{formatMoney(item.totalAmount, item.currencyCode)}</p>
                  </div>
                  <p className="mt-2 truncate text-sm text-gray-600">{merchantSummary(item.pendingLineItems)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                      <Layers className="h-3 w-3" /> Level {item.levelOrder}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{item.pendingLineItems?.length ?? 0} pending</span>
                    {flagged && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                        <ShieldAlert className="h-3 w-3" /> Policy warning
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">{renderActions(item)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 mt-4 text-sm text-gray-600">
          <Button size="small" variant="outline" disabled={data.first} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {data.page + 1} of {data.totalPages}
          </span>
          <Button size="small" variant="outline" disabled={data.last} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <CommentPromptModal
        isOpen={!!rejectingReport}
        title={`Reject report ${rejectingReport?.reportNumber ?? ""}`}
        description="This is a terminal decision - the employee cannot resubmit this report. Use Needs Correction on individual lines instead if the report just needs a fix."
        confirmLabel="Reject Report"
        confirmVariant="danger"
        isLoading={rejectReport.isPending}
        onCancel={() => setRejectingReport(null)}
        onConfirm={(comment) => {
          rejectReport.mutate(
            { reportId: rejectingReport.reportId, comment },
            {
              onSuccess: () => {
                showStatusToast("Report rejected", "success");
                setRejectingReport(null);
              },
              onError: (err) => showStatusToast(err.response?.data?.message || "Failed to reject report", "error"),
            },
          );
        }}
      />

      <ExpenseReviewPanel
        isOpen={!!reviewingItem}
        onClose={() => setReviewingItem(null)}
        reportId={reviewingItem?.reportId}
        mode="queue"
        queueItem={reviewingItem}
      />
    </div>
  );
}
