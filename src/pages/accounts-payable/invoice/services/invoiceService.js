import { INVOICE_STATUS } from "../../constants/invoiceStatus";
import { calculateBalance } from "../../utils/formatters";
import api from "../../../../api/axiosInstance.js";
import { mapInvoiceRecord } from "./invoiceMapper";

/**
 * Real backend-backed invoice service (Invoice Details API). Uses the shared axiosInstance —
 * no second Axios instance, no duplicated auth logic; the request interceptor there already
 * injects the bearer token for every call made through `api`.
 *
 * AP endpoints live on a separate service from the main USER_MANAGEMENT_URL, so each call is
 * made with an absolute URL built from window.__APP_CONFIG__.AP_BASE_URL (see public/config.js /
 * docker-entrypoint.sh) — same pattern already used by
 * src/pages/accounts-payable/vendor/services/vendorTaxService.js. Passing an absolute URL to a
 * configured axios instance overrides its baseURL for that call only; the instance's own
 * baseURL (USER_MANAGEMENT_URL) is never mutated, so other modules using `api` are unaffected.
 */
const AP_BASE_URL = window.__APP_CONFIG__.AP_BASE_URL;

function matchesSearch(invoice, search) {
  if (!search) return true;
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return (
    invoice.invoiceNumber?.toLowerCase().includes(term) ||
    invoice.vendor?.name?.toLowerCase().includes(term)
  );
}

function matchesDateRange(invoice, dateField, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const raw = invoice[dateField];
  if (!raw) return false;
  const value = new Date(raw).getTime();
  if (dateFrom && value < new Date(dateFrom).getTime()) return false;
  if (dateTo && value > new Date(dateTo).getTime()) return false;
  return true;
}

/** Not exposed on the service object — every read method funnels through this single fetch. */
async function fetchAllInvoices() {
  const response = await api.get(`${AP_BASE_URL}/invoice-details/invoice`);
  const records = Array.isArray(response.data) ? response.data : [];
  return records.map(mapInvoiceRecord);
}

/** Normalizes an axios error's HTTP status onto `error.status` so callers (e.g.
 *  InvoiceDetailPage's `error?.status === 404` check) don't need to know it came from axios. */
function withNormalizedStatus(error) {
  error.status = error.status ?? error.response?.status;
  return error;
}

export const invoiceService = {
  /**
   * @param {Object} [params]
   * @param {string} [params.search] - matches invoice number or vendor name
   * @param {string} [params.status] - one exact INVOICE_STATUS to filter to (from the Status filter)
   * @param {string[]} [params.statuses] - status allowlist for the active queue/tab
   * @param {string} [params.invoiceType] - one of INVOICE_TYPES
   * @param {string} [params.dateField] - "invoiceDate" | "dueDate", defaults to "invoiceDate"
   * @param {string} [params.dateFrom] - ISO date string
   * @param {string} [params.dateTo] - ISO date string
   * @param {number} [params.page=1]
   * @param {number} [params.pageSize=10]
   * @returns {Promise<{items: Array, total: number, page: number, pageSize: number, totalPages: number}>}
   *
   * The backend list endpoint takes no filter/pagination query params (returns the full array),
   * so search/status/type/date-range filtering and pagination are applied client-side here —
   * same behavior as before, just sourced from a real fetch instead of the mock store.
   */
  async getInvoices(params = {}) {
    try {
      const {
        search = "",
        status = "",
        statuses = null,
        invoiceType = "",
        dateField = "invoiceDate",
        dateFrom = "",
        dateTo = "",
        page = 1,
        pageSize = 10,
      } = params;

      const all = await fetchAllInvoices();

      const filtered = all.filter((invoice) => {
        if (statuses && !statuses.includes(invoice.status)) return false;
        if (status && invoice.status !== status) return false;
        if (invoiceType && invoice.invoiceType !== invoiceType) return false;
        if (!matchesSearch(invoice, search)) return false;
        if (!matchesDateRange(invoice, dateField, dateFrom, dateTo)) return false;
        return true;
      });

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(Math.max(1, page), totalPages);
      const start = (safePage - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);

      return { items, total, page: safePage, pageSize, totalPages };
    } catch (error) {
      console.error("Error in invoiceService.getInvoices:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * @param {string|number} invoiceId - route params arrive as strings; coerced to a number for
   *   the backend, which expects an int.
   * @returns {Promise<Object>}
   */
  async getInvoice(invoiceId) {
    try {
      const response = await api.get(`${AP_BASE_URL}/invoice-details/invoice/${Number(invoiceId)}`);
      return mapInvoiceRecord(response.data);
    } catch (error) {
      console.error("Error in invoiceService.getInvoice:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * Fetches a viewable reference (e.g. a presigned S3 URL) for the invoice's source document.
   * Only call this when the user explicitly asks to view the document — never on page load.
   * @param {string|number} inboundDocumentId
   * @returns {Promise<unknown>} raw response body — shape not yet documented by the backend, so
   *   callers must defensively read a URL out of it rather than assume a fixed contract.
   */
  async viewInvoice(inboundDocumentId) {
  try {
    const response = await api.get(
      `${AP_BASE_URL}/invoice-details/invoice/view/${encodeURIComponent(
        inboundDocumentId
      )}`,
      {
        responseType: "blob",
      }
    );

    return {
      blob: response.data,
      contentType:
        response.headers["content-type"] || "application/pdf",
    };
  } catch (error) {
    console.error("Error in invoiceService.viewInvoice:", error);
    throw withNormalizedStatus(error);
  }
},

  /**
   * Runs OCR/field extraction on a newly uploaded invoice document. This is the real extraction
   * operation (~30s) — there is no Redis progress tracking for it, so callers can only observe
   * its request lifecycle (pending → resolved/rejected), not sub-stage progress.
   * @param {File} file
   * @returns {Promise<Object>} raw extract-fields response (invoice_id / inbound_document_id /
   *   invoice_status / extracted_invoice) — consumed directly by InvoiceUploadPage, not mapped
   *   through mapInvoiceRecord since it isn't an InvoiceDetailsResponse.
   */
  async extractInvoiceFields(file) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post(`${AP_BASE_URL}/invoice-extract/extract-fields`, formData);
      return response.data;
    } catch (error) {
      console.error("Error in invoiceService.extractInvoiceFields:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * Queues the background validation pipeline for a just-extracted invoice. Returns immediately
   * with { job_id, status: "QUEUED" } — the per-stage validation (extraction/vendor/buyer/gst)
   * runs asynchronously on the backend and must be polled via getInvoiceValidationStatus.
   * @param {Object} extractionResult - the raw extract-fields response, forwarded as-is
   * @returns {Promise<{job_id: string, status: string}>}
   */
  async validateInvoiceFields(extractionResult) {
    try {
      const response = await api.post(`${AP_BASE_URL}/invoice-extract/validate-fields`, extractionResult);
      return response.data;
    } catch (error) {
      console.error("Error in invoiceService.validateInvoiceFields:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * Polls the Redis-backed status of a queued validation job.
   * @param {string} jobId
   * @returns {Promise<Object>} { job_id, status, current_stage, stages, is_valid,
   *   requires_manual_review, issues }
   */
  async getInvoiceValidationStatus(jobId) {
    try {
      const response = await api.get(
        `${AP_BASE_URL}/invoice-extract/validate-fields/${encodeURIComponent(jobId)}/status`,
      );
      return response.data;
    } catch (error) {
      console.error("Error in invoiceService.getInvoiceValidationStatus:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * Persists the invoice once extraction/validation have finished — the invoice does not exist
   * until this call succeeds. Takes the same payload that was sent to validateInvoiceFields.
   * @param {Object} extractionResult - the raw extract-fields response, forwarded as-is
   * @returns {Promise<Object>} { invoice_id, invoice_number, vendor_id, inbound_document_id,
   *   invoice_attachment_id, status_code, line_count, skipped_line_count, warnings }
   */
  async createInvoice(extractionResult) {
    try {
      const response = await api.post(`${AP_BASE_URL}/invoice-extract/create-invoice`, extractionResult);
      return response.data;
    } catch (error) {
      console.error("Error in invoiceService.createInvoice:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * Fetches the Redis-backed extraction cache entry (extracted_invoice + correction trail +
   * per-section confirmed flags) for a given extraction_id. Not called on every render — only
   * when the UI needs the full corrected record instead of relying on a correction response's
   * `updated` sub-object.
   * @param {string} extractionId
   * @returns {Promise<Object>} ExtractionCacheResponse
   */
  async getExtractionCache(extractionId) {
    try {
      const response = await api.get(`${AP_BASE_URL}/invoice-extract/extract-fields/${encodeURIComponent(extractionId)}`);
      return response.data;
    } catch (error) {
      console.error("Error in invoiceService.getExtractionCache:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * Stage 1 corrections: each PATCH is a sparse update (only fields present in `patch` are
   * touched) against the Redis extraction cache — never the Invoice DB. None of these trigger
   * revalidation on their own; call validateInvoiceFields again with { extraction_id } afterwards
   * to get a fresh validation job against the corrected data.
   * @param {string} extractionId
   * @param {Object} patch - subset of {name, legal_name, trade_name, gstin, pan, address, state, state_code}
   * @returns {Promise<Object>} CorrectionResponse { extraction_id, section, updated, corrections }
   */
  async correctVendorFields(extractionId, patch) {
    try {
      const response = await api.patch(`${AP_BASE_URL}/invoice-extract/extract-fields/${encodeURIComponent(extractionId)}/vendor`, patch);
      return response.data;
    } catch (error) {
      console.error("Error in invoiceService.correctVendorFields:", error);
      throw withNormalizedStatus(error);
    }
  },

  /** @see correctVendorFields - identical shape, buyer section. */
  async correctBuyerFields(extractionId, patch) {
    try {
      const response = await api.patch(`${AP_BASE_URL}/invoice-extract/extract-fields/${encodeURIComponent(extractionId)}/buyer`, patch);
      return response.data;
    } catch (error) {
      console.error("Error in invoiceService.correctBuyerFields:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * @param {string} extractionId
   * @param {Object} patch - subset of {place_of_supply, reverse_charge, tax_type, hsn_sac,
   *   cgst_rate, sgst_rate, igst_rate, ugst_rate, cess_rate}
   */
  async correctTaxFields(extractionId, patch) {
    try {
      const response = await api.patch(`${AP_BASE_URL}/invoice-extract/extract-fields/${encodeURIComponent(extractionId)}/tax`, patch);
      return response.data;
    } catch (error) {
      console.error("Error in invoiceService.correctTaxFields:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * @param {string} extractionId
   * @param {Object} patch - subset of {subtotal, taxable_amount, discount, cgst_amount,
   *   sgst_amount, igst_amount, ugst_amount, cess_amount, total_tax, grand_total}
   */
  async correctAmountsFields(extractionId, patch) {
    try {
      const response = await api.patch(`${AP_BASE_URL}/invoice-extract/extract-fields/${encodeURIComponent(extractionId)}/amounts`, patch);
      return response.data;
    } catch (error) {
      console.error("Error in invoiceService.correctAmountsFields:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * Marks a section ("vendor" | "buyer" | "tax" | "amounts") as reviewed/accepted as-is.
   * @param {string} extractionId
   * @param {"vendor"|"buyer"|"tax"|"amounts"} section
   * @returns {Promise<Object>} ExtractionCacheResponse
   */
  async confirmExtractionSection(extractionId, section) {
    try {
      const response = await api.post(`${AP_BASE_URL}/invoice-extract/extract-fields/${encodeURIComponent(extractionId)}/confirm`, { section });
      return response.data;
    } catch (error) {
      console.error("Error in invoiceService.confirmExtractionSection:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * Transitions an invoice to a new status via its numeric status_master id.
   * @param {string|number} invoiceId
   * @param {number} statusId
   */
  async updateInvoiceStatus(invoiceId, statusId) {
    try {
      const response = await api.put(
        `${AP_BASE_URL}/invoice/status-update/${Number(invoiceId)}`,
        null,
        { params: { status_id: statusId } },
      );
      return response.data;
    } catch (error) {
      console.error("Error in invoiceService.updateInvoiceStatus:", error);
      throw withNormalizedStatus(error);
    }
  },

  /**
   * Aggregate KPIs for the Invoice Management header cards, computed over the full fetched list
   * (not the current page/filter). "Paid This Month" will read 0 until the backend exposes
   * payment records — that's an honest reflection of missing data, not a bug.
   * @returns {Promise<{totalInvoicesThisMonth: number, pendingApprovalCount: number,
   *   readyForPaymentCount: number, readyForPaymentBalance: number, paidThisMonthCount: number,
   *   paidThisMonthAmount: number}>}
   */
  async getInvoiceSummary() {
    try {
      const all = await fetchAllInvoices();
      const now = new Date();
      const isThisMonth = (isoDate) => {
        if (!isoDate) return false;
        const d = new Date(isoDate);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      };

      // uploadedAt isn't returned by the backend yet — invoiceDate is the closest honest proxy
      // for "this month's invoices" available today.
      const totalInvoicesThisMonth = all.filter((invoice) => isThisMonth(invoice.invoiceDate)).length;
      const pendingApprovalCount = all.filter((invoice) => invoice.status === INVOICE_STATUS.PENDING_APPROVAL).length;

      // "Ready for payment" is a UI-level grouping over Approved invoices with an outstanding
      // balance — there is no distinct READY_FOR_PAYMENT status on the backend.
      const readyForPayment = all.filter((invoice) => invoice.status === INVOICE_STATUS.APPROVED);
      const readyForPaymentBalance = readyForPayment.reduce(
        (sum, invoice) => sum + calculateBalance(invoice.netAmount, invoice.amountPaid),
        0
      );

      const paidThisMonthInvoiceIds = new Set();
      let paidThisMonthAmount = 0;
      all.forEach((invoice) => {
        (invoice.payments || []).forEach((payment) => {
          if (isThisMonth(payment.paidAt)) {
            paidThisMonthInvoiceIds.add(invoice.id);
            paidThisMonthAmount += payment.amount;
          }
        });
      });

      return {
        totalInvoicesThisMonth,
        pendingApprovalCount,
        readyForPaymentCount: readyForPayment.length,
        readyForPaymentBalance,
        paidThisMonthCount: paidThisMonthInvoiceIds.size,
        paidThisMonthAmount,
      };
    } catch (error) {
      console.error("Error in invoiceService.getInvoiceSummary:", error);
      throw withNormalizedStatus(error);
    }
  },
};

export default invoiceService;
