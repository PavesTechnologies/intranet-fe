/**
 * Literal UMS permission codes for Procurement, exactly as issued on the JWT's `permissions`
 * claim (Backend/API_Layer/routes/procurement_route.py's permission_based_access checks).
 *
 * This is NOT a role -> permission map — UMS owns which roles (PR_Creator, PR_Approver,
 * Procurement_Officer) carry which of these; the frontend never encodes that relationship.
 * It exists only so call sites pass around one named constant instead of a repeated magic
 * string, e.g. hasPermission(PROCUREMENT_PERMISSIONS.PR_CREATE).
 *
 * Two intentional non-1:1 mappings inherited from the backend (see useApPermissions.js):
 *   - Cancel PR uses PR_SUBMIT (no dedicated PR_CANCEL permission exists).
 *   - Return-for-clarification uses PR_REJECT (no dedicated return permission exists).
 *   - The "sourcing decision" (creating an RFQ / recording a quotation) uses QUOTATION_CREATE,
 *     not PR_EDIT — sourcing happens after PR approval and is Procurement Officer territory.
 */
export const PROCUREMENT_PERMISSIONS = {
  PR_VIEW: "PR_VIEW",
  PR_CREATE: "PR_CREATE",
  PR_EDIT: "PR_EDIT",
  PR_DELETE: "PR_DELETE",
  PR_SUBMIT: "PR_SUBMIT",
  PR_TRACK: "PR_TRACK",

  PR_APPROVAL_VIEW: "PR_APPROVAL_VIEW",
  PR_APPROVE: "PR_APPROVE",
  PR_REJECT: "PR_REJECT",

  QUOTATION_VIEW: "QUOTATION_VIEW",
  QUOTATION_CREATE: "QUOTATION_CREATE",
  QUOTATION_UPDATE: "QUOTATION_UPDATE",
  QUOTATION_DELETE: "QUOTATION_DELETE",

  VENDOR_SELECTION_VIEW: "VENDOR_SELECTION_VIEW",
  VENDOR_SELECT: "VENDOR_SELECT",

  PO_VIEW: "PO_VIEW",
  PO_CREATE: "PO_CREATE",
};

/**
 * Any one of these lets a user land on the /procurement page at all — each tab inside it is
 * then independently gated by its own single permission (see ProcurementPage.jsx). Route-level
 * only; do not reuse for a specific tab or action check.
 */
export const PROCUREMENT_ANY_VIEW_PERMISSIONS = [
  PROCUREMENT_PERMISSIONS.PR_VIEW,
  PROCUREMENT_PERMISSIONS.PR_APPROVAL_VIEW,
  PROCUREMENT_PERMISSIONS.QUOTATION_VIEW,
  PROCUREMENT_PERMISSIONS.VENDOR_SELECTION_VIEW,
  PROCUREMENT_PERMISSIONS.PO_VIEW,
];

export default PROCUREMENT_PERMISSIONS;
