import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Check,
  MessageSquareWarning,
  Landmark,
  FileText,
  Wallet,
  User,
  Layers,
  AlertTriangle,
} from "lucide-react";
import Button from "@/components/Button/Button";
import { showStatusToast } from "@/components/toastfy/toast";
import { expenseReportService, lineItemService } from "@/pages/expense-management/api/expenseReportsApi";
import ApprovalStatusPill from "../../../approval-engine/components/ApprovalStatusPill";
import EmployeeLabel from "../../../approval-engine/components/EmployeeLabel";
import LineReviewStatusBadge, { deriveLineReviewState } from "../../../approval-engine/components/LineReviewStatusBadge";
import FinanceApprovalLevelTimeline from "./FinanceApprovalLevelTimeline";
import ReceiptViewer from "../../../approval-engine/components/ReceiptViewer";
import CommentPromptModal from "../../../approval-engine/components/CommentPromptModal";
import { useFinanceStatus, useFinanceReviews, useVerifyLineItem, useQueryLineItem } from "../hooks/useFinanceVerification";
import { formatMoney, formatDate } from "../../../approval-engine/constants/approvalLabels";

const isLineEligible = (line) => {
  if (!line) return false;
  if (line.eligibleForVerify === false || line.eligible === false || line.isEligible === false) return false;
  if (line.ineligibleReason && String(line.ineligibleReason).trim().length > 0) return false;
  return true;
};

const Section = ({ icon, title, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
      {icon}
      {title}
    </div>
    {children}
  </div>
);

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
    <p className="mt-0.5 text-sm font-medium text-gray-800 break-words">{value ?? "—"}</p>
  </div>
);

export default function FinanceReviewPanel({ isOpen, onClose, reportId, queueItem }) {
  const [selectedLineItemId, setSelectedLineItemId] = useState(null);
  const [queryingLine, setQueryingLine] = useState(null);

  const { data: approvalStatus } = useFinanceStatus(isOpen ? reportId : null);
  const { data: lineItemReviews } = useFinanceReviews(isOpen ? reportId : null);
  
  const verifyLineItem = useVerifyLineItem();
  const queryLineItem = useQueryLineItem();

  const { data: fullReport } = useQuery({
    queryKey: ["expenseReviewReport", reportId],
    queryFn: () => expenseReportService.getById(reportId).then((res) => res.data?.data),
    enabled: isOpen && !!reportId,
    retry: 0,
    staleTime: 60_000,
  });

  const { data: fullLineItems } = useQuery({
    queryKey: ["expenseReviewLineItems", reportId],
    queryFn: async () => {
      const res = await lineItemService.getAll(reportId);
      const payload = res.data?.data;
      return Array.isArray(payload) ? payload : payload?.lineItems || payload?.content || payload?.data || [];
    },
    enabled: isOpen && !!reportId,
    retry: 0,
    staleTime: 30_000,
  });

  const reportStatus = fullReport?.reportStatus || "PENDING_FINANCE_VERIFICATION";
  const lineItems = queueItem?.pendingLineItems || [];

  // Match queue items or full items
  const mergedLineItems = useMemo(() => {
    const baseItems = fullLineItems?.length ? fullLineItems : lineItems;
    if (!baseItems.length) return [];
    return baseItems.map(item => {
      const qi = lineItems.find(li => li.lineItemId === item.lineItemId) || {};
      return { ...item, ...qi };
    });
  }, [lineItems, fullLineItems]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedLineItemId(null);
      return;
    }
    if (mergedLineItems.length && !mergedLineItems.some((l) => l.lineItemId === selectedLineItemId)) {
      setSelectedLineItemId(mergedLineItems[0].lineItemId);
    }
  }, [isOpen, reportId, mergedLineItems]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const reviewsByLineItem = useMemo(() => {
    const map = new Map();
    (lineItemReviews || []).forEach((r) => map.set(r.lineItemId, r));
    return map;
  }, [lineItemReviews]);

  const selectedLine = mergedLineItems.find((l) => l.lineItemId === selectedLineItemId) || null;
  const selectedReview = selectedLine ? reviewsByLineItem.get(selectedLine.lineItemId) : null;
  const hasPolicyWarnings = (selectedLine?.policyViolations?.length > 0) || (selectedLine?.policyWarnings?.length > 0);

  const employeeId = queueItem?.employeeId || fullReport?.employeeId;
  const reportNumber = queueItem?.reportNumber || fullReport?.reportNumber;
  const title = fullReport?.title;
  const businessPurpose = fullReport?.businessPurpose;
  const costCenterName = queueItem?.costCenterName || queueItem?.costCenter || queueItem?.costCenterCode || queueItem?.departmentName || fullReport?.costCenterName || fullReport?.costCenter;
  const submittedAt = queueItem?.submittedAt || queueItem?.createdAt || queueItem?.submittedDate || fullReport?.submittedAt || fullReport?.createdAt;
  const totalAmount = queueItem?.totalAmount ?? fullReport?.totalAmount;
  const currencyCode = queueItem?.currencyCode || fullReport?.currencyCode;

  const isMutating = verifyLineItem.isPending || queryLineItem.isPending;
  const canAct = reportStatus === "PENDING_FINANCE_VERIFICATION";

  if (!isOpen) return null;

  const handleVerify = () => {
    if (!selectedLine) return;
    verifyLineItem.mutate(
      { reportId, lineItemId: selectedLine.lineItemId },
      {
        onSuccess: () => showStatusToast("Line item verified successfully", "success"),
        onError: (err) => showStatusToast(err.response?.data?.message || "Failed to verify line item", "error"),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-gray-900">{reportNumber || "Expense Report"}</h2>
            {reportStatus && <ApprovalStatusPill status={reportStatus} label={approvalStatus?.currentLevelDisplayName ? `Pending ${approvalStatus.currentLevelDisplayName}` : undefined} />}
          </div>
          {title && <p className="mt-0.5 truncate text-sm text-gray-500">{title}</p>}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="h-[42vh] shrink-0 border-b border-gray-200 p-3 md:h-auto md:w-[42%] md:border-b-0 md:border-r md:p-4">
          <ReceiptViewer lineItemId={selectedLine?.lineItemId} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:w-[58%]">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {mergedLineItems.length > 1 && (
              <Section icon={<Layers className="h-4 w-4 text-gray-400" />} title={`Line Items (${mergedLineItems.length})`}>
                <div className="space-y-1.5">
                  {mergedLineItems.map((line) => {
                    const review = reviewsByLineItem.get(line.lineItemId);
                    const state = deriveLineReviewState(review, (line.policyViolations?.length > 0) || (line.policyWarnings?.length > 0));
                    const isSelected = line.lineItemId === selectedLineItemId;
                    return (
                      <button
                        key={line.lineItemId}
                        type="button"
                        onClick={() => setSelectedLineItemId(line.lineItemId)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                          isSelected ? "border-[#0A0082] bg-indigo-50" : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <span className="min-w-0 truncate font-medium text-gray-800">
                          {line.merchantName || line.categoryName || "Line item"}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-gray-500">{formatMoney(line.amount, line.currencyCode)}</span>
                          <LineReviewStatusBadge state={state} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            <Section icon={<User className="h-4 w-4 text-gray-400" />} title="Employee Information">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Employee" value={<EmployeeLabel employeeId={employeeId} />} />
                <Field label="Report ID" value={reportNumber} />
                <Field label="Submitted" value={formatDate(submittedAt)} />
                <Field label="Cost Center" value={costCenterName} />
              </div>
              {businessPurpose && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <Field label="Business Purpose" value={businessPurpose} />
                </div>
              )}
            </Section>

            {selectedLine ? (
              <>
                <Section icon={<FileText className="h-4 w-4 text-gray-400" />} title="Expense Information">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Merchant" value={selectedLine.merchantName} />
                    <Field label="Category" value={selectedLine.categoryName} />
                    <Field label="Date" value={formatDate(selectedLine.expenseDate)} />
                    <Field
                      label="Verification Status"
                      value={<LineReviewStatusBadge state={deriveLineReviewState(selectedReview, hasPolicyWarnings)} />}
                    />
                    
                    {selectedLine.glAccountCode && (
                      <Field
                        label="GL Account"
                        value={
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                            <Landmark className="h-3 w-3" /> {selectedLine.glAccountCode}
                          </span>
                        }
                      />
                    )}

                    {selectedLine.clientBillable && (
                      <Field
                        label="Client Billable"
                        value={
                          <span className="inline-flex items-center rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                            Billable
                          </span>
                        }
                      />
                    )}
                  </div>
                  {selectedLine.description && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <Field label="Description" value={selectedLine.description} />
                    </div>
                  )}

                  {!isLineEligible(selectedLine) && selectedLine.ineligibleReason && (
                    <div className="mt-3 border-t border-gray-100 pt-3 flex items-start gap-2 text-sm text-rose-700 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs uppercase text-rose-500 font-semibold tracking-wider">Ineligibility Reason</p>
                        <p className="mt-0.5">{selectedLine.ineligibleReason}</p>
                      </div>
                    </div>
                  )}
                </Section>

                <Section icon={<Wallet className="h-4 w-4 text-gray-400" />} title="Amount">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Line Amount" value={formatMoney(selectedLine.amount, selectedLine.currencyCode)} />
                    {selectedLine.taxAmount != null && <Field label="Tax / GST" value={formatMoney(selectedLine.taxAmount, selectedLine.currencyCode)} />}
                    <Field label="Report Total" value={formatMoney(totalAmount, currencyCode)} />
                  </div>
                </Section>
              </>
            ) : (
              <Section icon={<FileText className="h-4 w-4 text-gray-400" />} title="Expense Information">
                <p className="text-sm text-gray-400">No line item details available for this report.</p>
              </Section>
            )}

            <Section icon={<Landmark className="h-4 w-4 text-gray-400" />} title="Approval Progress">
              <FinanceApprovalLevelTimeline reportId={reportId} reportStatus={reportStatus} />
            </Section>
          </div>

          {canAct && (
            <div className="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-white p-3 sm:p-4">
              <Button
                variant="outline"
                disabled={isMutating || !selectedLine}
                onClick={() => setQueryingLine(selectedLine)}
              >
                <MessageSquareWarning className="h-4 w-4" /> Request Correction
              </Button>
              <Button
                variant="success"
                disabled={isMutating || !selectedLine || !isLineEligible(selectedLine)}
                loading={verifyLineItem.isPending}
                onClick={handleVerify}
              >
                <Check className="h-4 w-4" /> Verify Line
              </Button>
            </div>
          )}
        </div>
      </div>

      <CommentPromptModal
        isOpen={!!queryingLine}
        title="Request correction"
        description="The employee will see this comment and can fix the line item details, then resubmit the report."
        contextLabel={queryingLine ? `Correcting: ${queryingLine.merchantName || queryingLine.categoryName || "Line item"} — ${formatMoney(queryingLine.amount, queryingLine.currencyCode)}` : ""}
        confirmLabel="Request Correction"
        confirmVariant="danger"
        isLoading={queryLineItem.isPending}
        onCancel={() => setQueryingLine(null)}
        onConfirm={(reason) => {
          queryLineItem.mutate(
            { reportId, lineItemId: queryingLine.lineItemId, reason },
            {
              onSuccess: () => {
                showStatusToast("Correction requested successfully", "success");
                setQueryingLine(null);
                onClose();
              },
              onError: (err) => showStatusToast(err.response?.data?.message || "Failed to request correction", "error"),
            }
          );
        }}
      />
    </div>
  );
}
