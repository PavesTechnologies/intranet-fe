import { INVOICE_STATUS } from "../../constants/invoiceStatus";

/**
 * Backend `status_code` is a machine code (e.g. "PENDING_APPROVAL"), not the frontend's display
 * label — the rest of the app (StatusBadge, tab/queue filtering) already keys off
 * INVOICE_STATUS.* display values, so map the code through that lookup. Falls back to the raw
 * code unchanged if it doesn't match a known key, rather than hiding an unrecognized status.
 */
function mapStatusCode(statusCode) {
  if (!statusCode) return "";
  return INVOICE_STATUS[statusCode.toUpperCase()] ?? statusCode;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Maps a backend InvoiceDetailsResponse record (snake_case) to the frontend's camelCase Invoice
 * model. Used for both the list and detail endpoints — they return the same shape (see
 * invoiceService.js). Fields the backend doesn't provide yet (vendor GSTIN/email, line items,
 * attachments, issues, approval, payments, history, currency, amount paid) get safe empty/null
 * defaults — never invented values — so existing detail-page sections render without crashing but
 * never show fabricated data.
 * @param {Object} raw - InvoiceDetailsResponse
 * @returns {Object} mapped Invoice
 */
export function mapInvoiceRecord(raw = {}) {
  const vendorName = raw.vendor_name ?? null;

  return {
    // Canonical API-aligned fields
    id: raw.invoice_id,
    invoiceId: raw.invoice_id,
    invoiceNumber: raw.invoice_number ?? "",
    vendorName,
    inboundDocumentId: raw.inbound_document_id ?? null,
    invoiceType: raw.invoice_type ?? "",
    invoiceDate: raw.invoice_date ?? "",
    dueDate: raw.due_date ?? "",
    grossAmount: toNumber(raw.gross_amount),
    discountAmount: toNumber(raw.discount_amount),
    taxAmount: toNumber(raw.tax_amount),
    netAmount: toNumber(raw.net_amount),
    status: mapStatusCode(raw.status_code),

    // Compatibility defaults for existing UI components — not returned by
    // InvoiceDetailsResponse yet. Do not replace these with invented values.
    amountPaid: 0,
    vendor: vendorName ? { name: vendorName, gstin: null, email: null } : null,
    paymentTerms: null,
    invoiceLines: [],
    attachments: [],
    issues: [],
    history: [],
    approval: null,
    payments: [],
    // InvoiceDetailsResponse has no currency field at all — not even the vendor's currency_id.
    // Leave unset rather than assuming INR; every consumer already falls back to the rupee sign
    // via `invoice.currency?.symbol || "₹"` when this is null.
    currency: null,
    uploadedAt: null,
  };
}
