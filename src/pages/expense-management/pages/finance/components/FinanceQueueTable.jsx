import React from "react";
import { Inbox, ShieldAlert } from "lucide-react";
import Button from "@/components/Button/Button";
import GenericTable from "@/components/Table/table";
import Pagination from "@/components/Pagination/pagination";
import EmployeeLabel from "../../../approval-engine/components/EmployeeLabel";
import ApprovalStatusPill from "../../../approval-engine/components/ApprovalStatusPill";
import { formatMoney, formatDate } from "../../../approval-engine/constants/approvalLabels";

const isLineEligible = (line) => {
  if (!line) return false;
  if (line.eligibleForVerify === false || line.eligible === false || line.isEligible === false) return false;
  if (line.ineligibleReason && String(line.ineligibleReason).trim().length > 0) return false;
  return true;
};

const hasIneligibleLines = (lineItems) => (lineItems || []).some((l) => !isLineEligible(l));

/**
 * The Finance Verification queue table - one row per report, "Review" as the only per-row action
 * (Verify/Query stay inside FinanceReviewPanel, not duplicated here as row shortcuts). Extracted so
 * the dedicated Finance Verification page and the common Approvals page's own Finance section
 * render this identically instead of each keeping their own copy that could drift apart.
 */
export default function FinanceQueueTable({ items, page, totalPages, onPrevious, onNext, onReview, emptyTitle, emptySubtitle }) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white py-16 text-center">
        <Inbox className="h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-600">{emptyTitle || "Nothing waiting on you right now."}</p>
        <p className="text-xs text-gray-400">{emptySubtitle || "Expense reports awaiting Finance verification will show up here."}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="w-full overflow-x-auto rounded-lg">
        <GenericTable
          headers={["Employee", "Report", "Submitted", "Cost Center", "Amount", "Status", "Eligibility", "Action"]}
          columns={["employee", "report", "submitted", "costCenter", "amount", "status", "eligibility", "action"]}
          rows={items.map((item) => {
            const hasIneligible = hasIneligibleLines(item.pendingLineItems);
            return {
              employee: <EmployeeLabel employeeId={item.employeeId} />,
              report: item.reportNumber,
              submitted: formatDate(item.submittedAt),
              costCenter: item.costCenterName || "—",
              amount: formatMoney(item.totalAmount, item.currencyCode),
              status: <ApprovalStatusPill status={item.reportStatus} />,
              eligibility: hasIneligible ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  <ShieldAlert className="h-3 w-3" /> Constraints
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  Ready
                </span>
              ),
              action: (
                <Button size="small" variant="outline" onClick={() => onReview(item)}>
                  Review
                </Button>
              ),
            };
          })}
        />
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination currentPage={page + 1} totalPages={totalPages} onPrevious={onPrevious} onNext={onNext} />
        </div>
      )}
    </div>
  );
}
