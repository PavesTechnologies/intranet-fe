import React from "react";
import classNames from "classnames";

/**
 * Deliberately not the shared StatusBadge (@/components/...) - this module renders its own
 * approval-lifecycle statuses (AWAITING_CORRECTION, PENDING_APPROVAL, level display names like
 * "Pending Manager Approval") rather than extending a shared component built for generic
 * request/task statuses elsewhere in the app.
 */
const TONE_BY_STATUS = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  AWAITING_CORRECTION: "bg-orange-100 text-orange-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-gray-100 text-gray-600",
  POLICY_REJECTED: "bg-rose-100 text-rose-800",
  QUERY_RAISED: "bg-orange-100 text-orange-800",
  PENDING_FINANCE_VERIFICATION: "bg-blue-100 text-blue-800",
};

export default function ApprovalStatusPill({ status, label }) {
  const tone = TONE_BY_STATUS[status] || "bg-gray-100 text-gray-700";
  const displayLabel =
    label ||
    (status === "PENDING_FINANCE_VERIFICATION"
      ? "Pending Finance Verification"
      : status === "AWAITING_CORRECTION"
      ? "Manager Requested Correction"
      : status === "QUERY_RAISED"
      ? "Finance Executive Requested Correction"
      : status);
  return (
    <span className={classNames("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
      {displayLabel}
    </span>
  );
}
