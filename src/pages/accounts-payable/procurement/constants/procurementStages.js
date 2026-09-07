/**
 * The six business stages a purchase requisition moves through end-to-end. This is a purely
 * presentational grouping on top of the real PR/RFQ status codes already defined in
 * procurementStatus.js — it introduces no new statuses and mirrors nothing new server-side.
 *
 * PO_ACKNOWLEDGED is the workflow's target end state, not something the backend currently
 * exposes (no acknowledgement endpoint/status exists yet). It is always rendered as a future,
 * inactive stage — see getProcurementStageIndex, which never returns its index.
 */
export const PROCUREMENT_STAGES = [
  { key: "PR_REQUEST", label: "PR Request" },
  { key: "PR_APPROVAL", label: "PR Approval" },
  { key: "RFQ_QUOTATIONS", label: "RFQ / Quotations" },
  { key: "VENDOR_SELECTION", label: "Vendor Selection" },
  { key: "PURCHASE_ORDER", label: "Purchase Order" },
  { key: "PO_ACKNOWLEDGED", label: "PO Acknowledged" },
];

/** PR status codes that mean the requisition's flow has stopped without reaching PO. */
const TERMINAL_HALT_CODES = new Set(["REJECTED", "CANCELLED"]);

/**
 * Maps a PR's status_code to an index into PROCUREMENT_STAGES, for driving the workflow
 * stepper. `terminal` is true when the PR stopped at that stage (rejected/cancelled) rather
 * than completed it, so the stepper can render it as halted instead of in-progress.
 * @param {string|undefined} prStatusCode
 * @returns {{ index: number, terminal: boolean } | null} null when the status isn't recognized
 */
export function getProcurementStageIndex(prStatusCode) {
  switch (prStatusCode) {
    case "DRAFT":
    case "RETURNED":
      return { index: 0, terminal: false };
    case "PENDING_APPROVAL":
      return { index: 1, terminal: false };
    case "APPROVED":
      return { index: 2, terminal: false };
    case "VENDOR_SELECTION":
      return { index: 3, terminal: false };
    case "PO_GENERATED":
      return { index: 4, terminal: false };
    case "REJECTED":
      // Rejected always happens while pending approval — halted at stage 1.
      return { index: 1, terminal: true };
    case "CANCELLED":
      // Cancellable from DRAFT through VENDOR_SELECTION — without the PR's prior status we
      // can't know exactly where it was halted, so anchor on PR Request rather than guess.
      return { index: 0, terminal: true };
    default:
      return null;
  }
}

export function isTerminalPrStatus(prStatusCode) {
  return TERMINAL_HALT_CODES.has(prStatusCode);
}
