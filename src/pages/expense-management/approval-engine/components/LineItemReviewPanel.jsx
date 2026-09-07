import React, { useState } from "react";
import { AlertTriangle, Check, MessageSquareWarning } from "lucide-react";
import Button from "@/components/Button/Button";
import CommentPromptModal from "./CommentPromptModal";

const formatMoney = (amount, currencyCode) =>
  amount == null ? "—" : `${currencyCode || ""} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

/**
 * One report's pending line items, from the enriched ApprovalQueueItemResponse.pendingLineItems -
 * full context per line (merchant/date/description/amount/category/violations) so an approver
 * never has to tab-switch to decide. Approve and Needs Correction are per-line; whole-report Reject
 * lives one level up (a distinct, more consequential action, not buried in this panel).
 */
export default function LineItemReviewPanel({ reportId, lineItems, onApproveLine, onFlagLine, isBusy }) {
  const [flaggingLineItemId, setFlaggingLineItemId] = useState(null);

  if (!lineItems?.length) {
    return <p className="text-sm text-gray-500 px-4 py-3">No line items currently pending your review.</p>;
  }

  return (
    <>
      <div className="divide-y divide-gray-100">
        {lineItems.map((line) => (
          <div key={line.lineItemId} className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-gray-900">{line.merchantName || "(no merchant)"}</span>
                <span className="text-xs text-gray-400">{line.categoryName}</span>
                <span className="text-xs text-gray-400">{line.expenseDate}</span>
              </div>
              {line.description && <p className="text-sm text-gray-600 mt-0.5">{line.description}</p>}
              {line.policyViolations?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {line.policyViolations.map((v, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-xs text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>{v.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="font-semibold text-sm text-gray-900 whitespace-nowrap">
                {formatMoney(line.amount, line.currencyCode)}
              </span>
              <Button
                size="small"
                variant="success"
                disabled={isBusy}
                onClick={() => onApproveLine(line.lineItemId)}
              >
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                size="small"
                variant="outline"
                disabled={isBusy}
                onClick={() => setFlaggingLineItemId(line.lineItemId)}
              >
                <MessageSquareWarning className="h-3.5 w-3.5" /> Needs Correction
              </Button>
            </div>
          </div>
        ))}
      </div>

      <CommentPromptModal
        isOpen={flaggingLineItemId != null}
        title="Flag line item for correction"
        description="The employee will see this comment and can fix just this line, without restarting the whole approval."
        confirmLabel="Flag for Correction"
        confirmVariant="danger"
        isLoading={isBusy}
        onCancel={() => setFlaggingLineItemId(null)}
        onConfirm={(comment) => {
          onFlagLine(flaggingLineItemId, comment);
          setFlaggingLineItemId(null);
        }}
      />
    </>
  );
}
