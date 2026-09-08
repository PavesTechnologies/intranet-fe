import { useAuth } from "../../../contexts/AuthContext";
import { AP_PERMISSIONS, rolesForPermission } from "../constants/permissions";
import { PROCUREMENT_PERMISSIONS } from "../constants/procurementPermissions";

/**
 * One boolean flag per capability, consumed by pages/buttons instead of calling
 * hasRole()/hasPermission() ad hoc — so the permission matrix stays defined in one file.
 * Mirrors the useCampaignPermissions.js pattern used elsewhere in the app
 * (src/pages/airs/campaigns/hooks/useCampaignPermissions.js).
 *
 * Two different authorization models live here side by side:
 *  - Non-procurement flags (dashboard/vendor/invoice/payment) are role-derived via the
 *    AP_PERMISSIONS -> role-array map in constants/permissions.js, same as always.
 *  - Procurement flags read the UMS `permissions` claim on the JWT directly via
 *    hasPermission() — no frontend role -> permission mapping exists for these; UMS alone
 *    decides which of PR_Creator / PR_Approver / Procurement_Officer carries which
 *    permission, and this hook just reflects whatever the token says.
 *
 * Frontend permission checks are UX only (hide/show, not enforce) — backend authorization
 * (permission_based_access in procurement_route.py) remains authoritative regardless of what
 * this hook returns. Every non-view procurement flag below independently gates one specific
 * action — holding a *_VIEW permission never implies any create/edit/approve/etc. capability.
 */
export function useApPermissions() {
  const { hasRole, hasPermission } = useAuth();

  return {
    canViewDashboard: hasRole(rolesForPermission(AP_PERMISSIONS.VIEW_DASHBOARD)),
    canOnboardVendor: hasRole(rolesForPermission(AP_PERMISSIONS.ONBOARD_VENDOR)),
    canEditVendor: hasRole(rolesForPermission(AP_PERMISSIONS.EDIT_VENDOR)),
    canViewVendor: hasRole(rolesForPermission(AP_PERMISSIONS.VIEW_VENDOR)),
    canUploadInvoice: hasRole(rolesForPermission(AP_PERMISSIONS.UPLOAD_INVOICE)),
    canReviewOcr: hasRole(rolesForPermission(AP_PERMISSIONS.REVIEW_OCR)),
    canValidateInvoice: hasRole(rolesForPermission(AP_PERMISSIONS.VALIDATE_INVOICE)),
    canApproveInvoice: hasRole(rolesForPermission(AP_PERMISSIONS.APPROVE_INVOICE)),
    canViewInvoice: hasRole(rolesForPermission(AP_PERMISSIONS.VIEW_INVOICE)),
    canMarkPaid: hasRole(rolesForPermission(AP_PERMISSIONS.MARK_PAID)),
    canViewPayment: hasRole(rolesForPermission(AP_PERMISSIONS.VIEW_PAYMENT)),

    // ── PR Request ─────────────────────────────────────────────────────────
    canViewPR: hasPermission(PROCUREMENT_PERMISSIONS.PR_VIEW),
    canCreatePR: hasPermission(PROCUREMENT_PERMISSIONS.PR_CREATE),
    canEditPR: hasPermission(PROCUREMENT_PERMISSIONS.PR_EDIT),
    canDeletePR: hasPermission(PROCUREMENT_PERMISSIONS.PR_DELETE),
    canSubmitPR: hasPermission(PROCUREMENT_PERMISSIONS.PR_SUBMIT),
    canTrackPR: hasPermission(PROCUREMENT_PERMISSIONS.PR_TRACK),
    // Cancel is intentionally the same backend permission as Submit (PR_SUBMIT) — there is no
    // dedicated PR_CANCEL permission. Do not change this mapping.
    canCancelPR: hasPermission(PROCUREMENT_PERMISSIONS.PR_SUBMIT),

    // ── PR Approval ────────────────────────────────────────────────────────
    canViewPRApprovals: hasPermission(PROCUREMENT_PERMISSIONS.PR_APPROVAL_VIEW),
    canApprovePR: hasPermission(PROCUREMENT_PERMISSIONS.PR_APPROVE),
    canRejectPR: hasPermission(PROCUREMENT_PERMISSIONS.PR_REJECT),
    // Return-for-clarification is intentionally the same backend permission as Reject
    // (PR_REJECT) — there is no dedicated return permission. Do not change this mapping.
    canReturnPR: hasPermission(PROCUREMENT_PERMISSIONS.PR_REJECT),

    // ── Quotations / RFQ sourcing ──────────────────────────────────────────
    canViewQuotation: hasPermission(PROCUREMENT_PERMISSIONS.QUOTATION_VIEW),
    // Also covers the "sourcing decision" (creating an RFQ, sending it, inviting vendors,
    // recording a quotation) — intentionally QUOTATION_CREATE, not PR_EDIT. Sourcing happens
    // after PR approval and belongs to the Procurement Officer's permission set.
    canCreateQuotation: hasPermission(PROCUREMENT_PERMISSIONS.QUOTATION_CREATE),
    canUpdateQuotation: hasPermission(PROCUREMENT_PERMISSIONS.QUOTATION_UPDATE),
    canDeleteQuotation: hasPermission(PROCUREMENT_PERMISSIONS.QUOTATION_DELETE),

    // ── Vendor Selection ───────────────────────────────────────────────────
    canViewVendorSelection: hasPermission(PROCUREMENT_PERMISSIONS.VENDOR_SELECTION_VIEW),
    canSelectVendor: hasPermission(PROCUREMENT_PERMISSIONS.VENDOR_SELECT),

    // ── Purchase Orders ────────────────────────────────────────────────────
    // purchase_order_route.py doesn't have permission_based_access wired up yet (known
    // backend gap, out of scope here) — PO_VIEW/PO_CREATE still gate the frontend so the UI
    // is consistent, but this is UX only until that route is protected server-side too.
    canViewPO: hasPermission(PROCUREMENT_PERMISSIONS.PO_VIEW),
    canGeneratePO: hasPermission(PROCUREMENT_PERMISSIONS.PO_CREATE),
  };
}
