import React, { useState } from "react";
import { AlertTriangle, Check, MessageSquareWarning, Landmark } from "lucide-react";
import Button from "@/components/Button/Button";
import CommentPromptModal from "../../../approval-engine/components/CommentPromptModal";

const formatMoney = (amount, currencyCode) =>
  amount == null ? "—" : `${currencyCode || ""} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const isLineEligible = (line) => {
  if (!line) return false;
  if (line.eligibleForVerify === false || line.eligible === false || line.isEligible === false) return false;
  if (line.ineligibleReason && String(line.ineligibleReason).trim().length > 0) return false;
  return true;
};

export default function FinanceLineItemReviewPanel({ reportId, lineItems, onVerifyLine, onQueryLine, isBusy }) {
  const [queryingLineItemId, setQueryingLineItemId] = useState(null);

  if (!lineItems?.length) {
    return <p className="text-sm text-gray-500 px-4 py-3">No line items currently pending finance verification.</p>;
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
                
                {line.glAccountCode && (
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                    <Landmark className="h-3 w-3" /> GL: {line.glAccountCode}
                  </span>
                )}

                {line.clientBillable && (
                  <span className="inline-flex items-center rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                    Billable
                  </span>
                )}
              </div>
              {line.description && <p className="text-sm text-gray-600 mt-0.5">{line.description}</p>}
              
              {!isLineEligible(line) && line.ineligibleReason && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-rose-700 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>Ineligible for verification: {line.ineligibleReason}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="font-semibold text-sm text-gray-900 whitespace-nowrap">
                {formatMoney(line.amount, line.currencyCode)}
              </span>
              <Button
                size="small"
                variant="success"
                disabled={isBusy || !isLineEligible(line)}
                onClick={() => onVerifyLine(line.lineItemId)}
              >
                <Check className="h-3.5 w-3.5" /> Verify
              </Button>
              <Button
                size="small"
                variant="outline"
                disabled={isBusy}
                onClick={() => setQueryingLineItemId(line.lineItemId)}
              >
                <MessageSquareWarning className="h-3.5 w-3.5" /> Needs Correction
              </Button>
            </div>
          </div>
        ))}
      </div>

      <CommentPromptModal
        isOpen={queryingLineItemId != null}
        title="Request correction"
        description="The employee will see this comment and can fix this line item, then resubmit the report."
        confirmLabel="Request Correction"
        confirmVariant="danger"
        isLoading={isBusy}
        onCancel={() => setQueryingLineItemId(null)}
        onConfirm={(reason) => {
          onQueryLine(queryingLineItemId, reason);
          setQueryingLineItemId(null);
        }}
      />
    </>
  );
}
