import React, { useState } from "react";
import { X, Wallet, FileText, User, Layers, CheckCircle2 } from "lucide-react";
import Button from "@/components/Button/Button";
import StatusBadge from "@/components/status/statusbadge";
import ConfirmationModal from "@/components/confirmation_modal/ConfirmationModal";
import { showStatusToast } from "@/components/toastfy/toast";
import EmployeeLabel from "../../../approval-engine/components/EmployeeLabel";
import ApprovalStatusPill from "../../../approval-engine/components/ApprovalStatusPill";
import { formatMoney, formatDate } from "../../../approval-engine/constants/approvalLabels";
import { useApPaymentDetails, useCompletePayment } from "../hooks/useApPayments";

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

/**
 * The AP Executive's "open a report" detail/action view - same full-screen-overlay shape as
 * ExpenseReviewPanel/FinanceReviewPanel (header + scrollable sections + sticky action bar), so all
 * three review experiences in Expense Management look and behave consistently. Sourced from a
 * single GET /xms/ap-payments/{reportId} call - ApPaymentDetailsResponse already composes the
 * report, its line items, and the approval-status read model in one response, so no extra fetch is
 * needed here.
 */
export default function ApPaymentReviewPanel({ isOpen, onClose, reportId, queueItem }) {
  const [confirming, setConfirming] = useState(false);
  const { data: details } = useApPaymentDetails(isOpen ? reportId : null);
  const completePayment = useCompletePayment();

  if (!isOpen) return null;

  const report = details?.report || queueItem;
  const lineItems = details?.lineItems || queueItem?.lineItems || queueItem?.pendingLineItems || [];
  const approvalStatus = details?.approvalStatus;

  const reportNumber = queueItem?.reportNumber || report?.reportNumber || report?.reportId;
  const employeeId = queueItem?.employeeId || report?.employeeId;
  const title = report?.title || queueItem?.title;
  const businessPurpose = report?.businessPurpose || queueItem?.businessPurpose;
  const costCenterName = queueItem?.costCenterName || queueItem?.costCenter || report?.costCenterName || report?.costCenter;
  const totalAmount = queueItem?.totalAmount ?? queueItem?.amount ?? report?.totalAmount ?? report?.amount;
  const currencyCode = queueItem?.currencyCode || report?.currencyCode || "INR";
  const approvedAt = queueItem?.approvedAt || queueItem?.createdAt || queueItem?.submittedAt || report?.approvedAt || report?.createdAt;
  const reportStatus = queueItem?.reportStatus || report?.reportStatus || "APPROVED";
  const rawRouting = queueItem?.paymentRoutingStatus || report?.paymentRoutingStatus;
  const paymentRoutingStatus = (!rawRouting || rawRouting === "NONE") ? "APPROVED_FOR_PAYMENT" : rawRouting;

  const canComplete = paymentRoutingStatus === "APPROVED_FOR_PAYMENT" || paymentRoutingStatus === "PENDING" || paymentRoutingStatus === "NONE" || !paymentRoutingStatus;

  const handleConfirmPayment = () => {
    completePayment.mutate(reportId, {
      onSuccess: () => {
        showStatusToast("Payment marked as completed", "success");
        setConfirming(false);
        onClose();
      },
      onError: (err) => {
        showStatusToast(err.response?.data?.message || "Failed to complete payment", "error");
        setConfirming(false);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-gray-900">{reportNumber || "Expense Report"}</h2>
            <ApprovalStatusPill status={reportStatus} />
            {paymentRoutingStatus && <StatusBadge label={paymentRoutingStatus} size="sm" />}
          </div>
          {title && <p className="mt-0.5 truncate text-sm text-gray-500">{title}</p>}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </header>

      {paymentRoutingStatus === "PAYMENT_COMPLETED" && (
        <div className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-3 sm:px-6">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Payment already completed for this report - no further action is possible here.
          </p>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <Section icon={<User className="h-4 w-4 text-gray-400" />} title="Employee Information">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Employee" value={<EmployeeLabel employeeId={employeeId} />} />
            <Field label="Report ID" value={reportNumber} />
            <Field label="Cost Center" value={costCenterName} />
            <Field label="Approved On" value={formatDate(approvedAt)} />
          </div>
          {businessPurpose && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <Field label="Business Purpose" value={businessPurpose} />
            </div>
          )}
        </Section>

        {lineItems.length > 0 && (
          <Section icon={<Layers className="h-4 w-4 text-gray-400" />} title={`Line Items (${lineItems.length})`}>
            <div className="space-y-1.5">
              {lineItems.map((line) => (
                <div key={line.lineItemId} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-gray-800">
                    {line.merchantName || line.categoryName || "Line item"}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">{formatMoney(line.amount, line.currencyCode)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section icon={<Wallet className="h-4 w-4 text-gray-400" />} title="Amount">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Approved Amount" value={formatMoney(totalAmount, currencyCode)} />
            <Field label="Currency" value={currencyCode} />
            <Field label="Payment Routing Status" value={<StatusBadge label={paymentRoutingStatus} size="sm" />} />
          </div>
        </Section>

        {approvalStatus && (
          <Section icon={<FileText className="h-4 w-4 text-gray-400" />} title="Approval Summary">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Approval Levels Completed" value={approvalStatus.totalLevels} />
              <Field label="Final Level" value={approvalStatus.currentLevelDisplayName || "—"} />
            </div>
          </Section>
        )}
      </div>

      {canComplete && (
        <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 bg-white p-3 sm:p-4">
          <Button variant="success" disabled={completePayment.isPending} onClick={() => setConfirming(true)}>
            <CheckCircle2 className="h-4 w-4" /> Complete Payment
          </Button>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirming}
        title="Complete Payment"
        message={`Mark ${reportNumber || "this report"} (${formatMoney(totalAmount, currencyCode)}) as paid? This cannot be undone.`}
        confirmText="Complete Payment"
        cancelText="Cancel"
        variant="success"
        isLoading={completePayment.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={handleConfirmPayment}
      />
    </div>
  );
}
