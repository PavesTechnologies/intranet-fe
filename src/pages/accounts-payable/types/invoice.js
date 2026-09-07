import { INVOICE_STATUS } from "../constants/invoiceStatus";
import { INVOICE_TYPES } from "../constants/invoiceTypes";
import { ISSUE_SEVERITY, ISSUE_SOURCE, ISSUE_STATUS } from "../constants/invoiceIssues";

/**
 * @typedef {Object} OcrExtractedFields
 * @property {string} invoiceNumber
 * @property {string} invoiceDate - ISO date string
 * @property {string} dueDate - ISO date string
 * @property {number} amount
 * @property {number} taxAmount
 * @property {string} currency
 * @property {number} confidenceScore - 0-1 OCR extraction confidence, drives review priority
 */

/**
 * @typedef {Object} ValidationChecklist
 * @property {boolean} vendorMatched
 * @property {boolean} amountMatched
 * @property {boolean} duplicateChecked
 * @property {string} notes
 */

/**
 * @typedef {Object} InvoiceLine
 * @property {string} id
 * @property {number} lineNumber
 * @property {string} description
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {number} taxAmount
 * @property {number} lineAmount
 */

/**
 * @typedef {Object} InvoiceAttachment
 * @property {string} id
 * @property {string} fileName
 * @property {string} fileType - e.g. "PDF", "PNG", "JPG"
 * @property {string} uploadedAt - ISO date string
 * @property {string} fileUrl - opaque reference; do not assume it is a working download URL
 *   until a real file-storage backend exists (see invoiceService.js)
 */

/**
 * @typedef {Object} InvoiceIssue
 * @property {string} id
 * @property {string} issueSource - one of ISSUE_SOURCE (see constants/invoiceIssues.js)
 * @property {string} issueType - short machine-ish label, e.g. "GSTIN_MISMATCH"
 * @property {string} severity - one of ISSUE_SEVERITY
 * @property {string} result - one of CHECK_RESULT, the outcome that raised this issue
 * @property {string} description - human-readable finding, e.g. "Vendor GSTIN does not match extracted GSTIN"
 * @property {string} status - one of ISSUE_STATUS
 * @property {string} resolvedBy - empty until resolved
 * @property {string} resolvedAt - ISO date string, empty until resolved
 */

/**
 * @typedef {Object} InvoiceVendorSummary
 * @property {string} id
 * @property {string} name
 * @property {string} gstin
 * @property {string} email
 */

/**
 * @typedef {Object} InvoiceCurrency
 * @property {string} code - e.g. "INR"
 * @property {string} symbol - e.g. "₹"
 */

/**
 * @typedef {Object} InvoiceApprovalInfo
 * @property {boolean} required - false when this workflow has no approval gate for the invoice
 * @property {string} approvedBy - empty when not yet approved
 * @property {string} approvedAt - ISO date string, empty when not yet approved
 * @property {string} rejectionReason - empty unless status is REJECTED
 */

/**
 * @typedef {Object} InvoiceHistoryEntry
 * @property {string} status - one of INVOICE_STATUS at the time of this entry
 * @property {string} at - ISO date-time string
 * @property {string} note - human-readable context, e.g. "Submitted by AP Executive"
 */

/**
 * @typedef {Object} InvoicePaymentRecord
 * @property {string} id
 * @property {string} paidAt - ISO date string
 * @property {number} amount
 * @property {string} method
 * @property {string} referenceNumber
 */

/**
 * @typedef {Object} Invoice
 * @property {string} id
 * @property {string} invoiceNumber
 * @property {string} invoiceType - one of INVOICE_TYPES (see constants/invoiceTypes.js)
 * @property {string} status - one of INVOICE_STATUS (see constants/invoiceStatus.js)
 * @property {string} invoiceDate - ISO date string
 * @property {string} dueDate - ISO date string
 * @property {InvoiceVendorSummary} vendor
 * @property {InvoiceCurrency} currency
 * @property {string} paymentTerms
 * @property {number} grossAmount
 * @property {number} discountAmount
 * @property {number} taxAmount
 * @property {number} netAmount
 * @property {number} amountPaid
 * @property {InvoiceLine[]} invoiceLines
 * @property {InvoiceAttachment[]} attachments
 * @property {InvoiceIssue[]} issues
 * @property {InvoiceApprovalInfo} approval
 * @property {InvoicePaymentRecord[]} payments
 * @property {OcrExtractedFields} ocrFields
 * @property {ValidationChecklist} validation
 * @property {InvoiceHistoryEntry[]} history
 * @property {string} uploadedBy
 * @property {string} uploadedAt - ISO date string
 */

/** @returns {Invoice} a blank invoice record, set immediately after file upload */
export function createEmptyInvoice() {
  return {
    id: "",
    invoiceNumber: "",
    invoiceType: INVOICE_TYPES.NON_PO,
    status: INVOICE_STATUS.DRAFT,
    invoiceDate: "",
    dueDate: "",
    vendor: null,
    currency: { code: "INR", symbol: "₹" },
    paymentTerms: "",
    grossAmount: 0,
    discountAmount: 0,
    taxAmount: 0,
    netAmount: 0,
    amountPaid: 0,
    invoiceLines: [],
    attachments: [],
    issues: [],
    approval: { required: true, approvedBy: "", approvedAt: "", rejectionReason: "" },
    payments: [],
    ocrFields: {
      invoiceNumber: "",
      invoiceDate: "",
      dueDate: "",
      amount: 0,
      taxAmount: 0,
      currency: "INR",
      confidenceScore: 0,
    },
    validation: { vendorMatched: false, amountMatched: false, duplicateChecked: false, notes: "" },
    history: [],
    uploadedBy: "",
    uploadedAt: "",
  };
}

/** @returns {InvoiceIssue} a blank issue record, used by mocks/tests rather than components directly */
export function createEmptyInvoiceIssue() {
  return {
    id: "",
    issueSource: ISSUE_SOURCE.OCR,
    issueType: "",
    severity: ISSUE_SEVERITY.INFO,
    result: "",
    description: "",
    status: ISSUE_STATUS.OPEN,
    resolvedBy: "",
    resolvedAt: "",
  };
}
