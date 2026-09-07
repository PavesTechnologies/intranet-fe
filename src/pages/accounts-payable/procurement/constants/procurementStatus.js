/**
 * Mirrors PR_TRANSITIONS in Backend/Business_Layer/services/procurement_service.py exactly —
 * used only to decide which actions to show/enable in the UI. The backend re-validates every
 * transition server-side regardless; this is not a second source of truth.
 */
export const PR_TRANSITIONS = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "RETURNED", "CANCELLED"],
  RETURNED: ["PENDING_APPROVAL"],
  APPROVED: ["VENDOR_SELECTION", "CANCELLED"],
  VENDOR_SELECTION: ["PO_GENERATED", "CANCELLED"],
  PO_GENERATED: [],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Mirrors RFQ_TRANSITIONS in Backend/Business_Layer/services/rfq_service.py exactly — used
 * only to decide which actions to show/enable in the UI. The backend re-validates every
 * transition server-side regardless; this is not a second source of truth.
 */
export const RFQ_TRANSITIONS = {
  DRAFT: ["SENT"],
  SENT: ["RESPONSE_RECEIVED", "CLOSED"],
  RESPONSE_RECEIVED: ["CLOSED"],
  CLOSED: [],
};

/** Matches VALID_PRIORITIES in procurement_service.py. */
export const PR_PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

/** A quotation can only be created while the PR is in one of these statuses. */
export const QUOTATION_ELIGIBLE_PR_STATUSES = ["APPROVED", "VENDOR_SELECTION"];

/** A vendor can only be selected while the PR is in this status. */
export const VENDOR_SELECTION_ELIGIBLE_PR_STATUS = "VENDOR_SELECTION";

/** A PO can only be generated while the PR is in this status and already has a selection. */
export const PO_GENERATION_ELIGIBLE_PR_STATUS = "VENDOR_SELECTION";
