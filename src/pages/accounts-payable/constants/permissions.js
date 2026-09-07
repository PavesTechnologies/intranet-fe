import {
  AP_VENDOR_MANAGER_ROLES,
  AP_INVOICE_PROCESSOR_ROLES,
  AP_INVOICE_VIEWER_ROLES,
  AP_PAYMENT_ACTION_ROLES,
  AP_PAYMENT_VIEWER_ROLES,
  AP_ALL_ROLES,
} from "./apRoles";

/**
 * Named AP permissions — one per distinct capability in the nav/role matrix from the
 * architecture doc. useApPermissions.js derives its boolean flags from AP_PERMISSION_ROLES
 * instead of inlining role arrays, so a capability's allowed roles live in exactly one place.
 *
 * Procurement is NOT here — it's authorized by real UMS JWT permission codes
 * (PR_VIEW/PR_CREATE/... in constants/procurementPermissions.js) read directly via
 * hasPermission(), not a frontend role -> permission map. See useApPermissions.js.
 */
export const AP_PERMISSIONS = {
  VIEW_DASHBOARD: "view_dashboard",
  ONBOARD_VENDOR: "onboard_vendor",
  EDIT_VENDOR: "edit_vendor",
  VIEW_VENDOR: "view_vendor",
  UPLOAD_INVOICE: "upload_invoice",
  REVIEW_OCR: "review_ocr",
  VALIDATE_INVOICE: "validate_invoice",
  APPROVE_INVOICE: "approve_invoice",
  VIEW_INVOICE: "view_invoice",
  MARK_PAID: "mark_paid",
  VIEW_PAYMENT: "view_payment",
};

export const AP_PERMISSION_ROLES = {
  [AP_PERMISSIONS.VIEW_DASHBOARD]: AP_ALL_ROLES,
  [AP_PERMISSIONS.ONBOARD_VENDOR]: AP_VENDOR_MANAGER_ROLES,
  [AP_PERMISSIONS.EDIT_VENDOR]: AP_VENDOR_MANAGER_ROLES,
  [AP_PERMISSIONS.VIEW_VENDOR]: AP_ALL_ROLES,
  [AP_PERMISSIONS.UPLOAD_INVOICE]: AP_INVOICE_PROCESSOR_ROLES,
  [AP_PERMISSIONS.REVIEW_OCR]: AP_INVOICE_PROCESSOR_ROLES,
  [AP_PERMISSIONS.VALIDATE_INVOICE]: AP_INVOICE_PROCESSOR_ROLES,
  [AP_PERMISSIONS.APPROVE_INVOICE]: AP_INVOICE_PROCESSOR_ROLES,
  [AP_PERMISSIONS.VIEW_INVOICE]: AP_INVOICE_VIEWER_ROLES,
  [AP_PERMISSIONS.MARK_PAID]: AP_PAYMENT_ACTION_ROLES,
  [AP_PERMISSIONS.VIEW_PAYMENT]: AP_PAYMENT_VIEWER_ROLES,
};

/** @returns {string[]} allowed roles for a permission, or [] if the key is unrecognized. */
export function rolesForPermission(permission) {
  return AP_PERMISSION_ROLES[permission] ?? [];
}
