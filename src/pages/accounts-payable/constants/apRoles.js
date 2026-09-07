/**
 * Accounts Payable role identifiers.
 * ADMIN reuses the platform-wide "Admin" role (ROLES.ADMIN in src/config/sidebarConfig.js) —
 * there is no AP-specific admin. The other three are AP-only and not used by any other module.
 * hasRole() in AuthContext is case-insensitive, so casing here is for readability only.
 */
export const AP_ROLES = {
  ADMIN: "Admin",
  VENDOR_INTAKE: "Vendor_Intake",
  AP_EXECUTIVE: "AP_Executive",
  FINANCE_EXECUTIVE: "Finance_Executive",
};

export const AP_ALL_ROLES = Object.values(AP_ROLES);

/** Can onboard/edit vendors. */
export const AP_VENDOR_MANAGER_ROLES = [AP_ROLES.ADMIN, AP_ROLES.VENDOR_INTAKE];

/** Can upload invoices and act on the OCR Review / Validation queues. */
export const AP_INVOICE_PROCESSOR_ROLES = [AP_ROLES.ADMIN, AP_ROLES.AP_EXECUTIVE];

/** Can view (not necessarily act on) invoices — All Invoices list, read-only Validation view. */
export const AP_INVOICE_VIEWER_ROLES = [
  AP_ROLES.ADMIN,
  AP_ROLES.AP_EXECUTIVE,
  AP_ROLES.FINANCE_EXECUTIVE,
];

/** Can mark invoices as paid. */
export const AP_PAYMENT_ACTION_ROLES = [AP_ROLES.ADMIN, AP_ROLES.FINANCE_EXECUTIVE];

/** Can view payment queue/history without acting. */
export const AP_PAYMENT_VIEWER_ROLES = [
  AP_ROLES.ADMIN,
  AP_ROLES.AP_EXECUTIVE,
  AP_ROLES.FINANCE_EXECUTIVE,
];

// Procurement (PR_Creator / PR_Approver / Procurement_Officer) is authorized entirely by UMS
// JWT permission codes, not by a role array here — see constants/procurementPermissions.js
// and useApPermissions.js. There is deliberately no AP_PROCUREMENT_ROLES.
