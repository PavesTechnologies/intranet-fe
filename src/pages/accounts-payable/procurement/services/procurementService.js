// src/pages/accounts-payable/procurement/services/procurementService.js
import api from "../../../../api/axiosInstance";

const BASE = `${window.__APP_CONFIG__.AP_BASE_URL}/procurement`;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

/**
 * Procurement API (Purchase Requisition -> Quotation -> Vendor Selection -> Purchase Order).
 * Matches Backend/API_Layer/routes/procurement_route.py. RFQ endpoints live in
 * ./rfqService.js (Backend/API_Layer/routes/rfq_route.py, mounted at /apm/rfq).
 */
export const procurementService = {
  // ── Purchase Requisition ────────────────────────────────────────────────

  createPurchaseRequisition: async (payload) => {
    const res = await api.post(`${BASE}/purchase-requisitions`, payload, {
      headers: authHeaders(),
    });
    return res.data;
  },

  /**
   * @param {{departmentId?: number, purchaseCategoryId?: number, statusId?: number,
   *   createdBy?: string, search?: string, skip?: number, limit?: number}} filters
   */
  getPurchaseRequisitions: async ({
    departmentId,
    purchaseCategoryId,
    statusId,
    createdBy,
    search,
    skip = 0,
    limit = 100,
  } = {}) => {
    const res = await api.get(`${BASE}/purchase-requisitions`, {
      params: {
        // "" is FormSelect's "All" sentinel, not a real filter value — || (not ??)
        // so it's dropped from the query string instead of being sent as department_id=
        // (FastAPI then 422s trying to parse "" as an int).
        department_id: departmentId || undefined,
        purchase_category_id: purchaseCategoryId || undefined,
        status_id: statusId || undefined,
        created_by: createdBy || undefined,
        search: search || undefined,
        skip,
        limit,
      },
      headers: authHeaders(),
    });
    return res.data;
  },

  getPendingApprovalPurchaseRequisitions: async (departmentId) => {
    const res = await api.get(`${BASE}/purchase-requisitions/pending-approval`, {
      params: { department_id: departmentId || undefined },
      headers: authHeaders(),
    });
    return res.data;
  },

  getPurchaseRequisitionById: async (prId) => {
    const res = await api.get(`${BASE}/purchase-requisitions/${prId}`, {
      headers: authHeaders(),
    });
    return res.data;
  },

  updatePurchaseRequisition: async (prId, payload) => {
    const res = await api.put(`${BASE}/purchase-requisitions/${prId}`, payload, {
      headers: authHeaders(),
    });
    return res.data;
  },

  deletePurchaseRequisition: async (prId) => {
    const res = await api.delete(`${BASE}/purchase-requisitions/${prId}`, {
      headers: authHeaders(),
    });
    return res.data;
  },

  submitPurchaseRequisition: async (prId) => {
    const res = await api.post(`${BASE}/purchase-requisitions/${prId}/submit`, null, {
      headers: authHeaders(),
    });
    return res.data;
  },

  cancelPurchaseRequisition: async (prId) => {
    const res = await api.post(`${BASE}/purchase-requisitions/${prId}/cancel`, null, {
      headers: authHeaders(),
    });
    return res.data;
  },

  approvePurchaseRequisition: async (prId, comment) => {
    const res = await api.post(
      `${BASE}/purchase-requisitions/${prId}/approve`,
      { comment: comment || undefined },
      { headers: authHeaders() },
    );
    return res.data;
  },

  rejectPurchaseRequisition: async (prId, comment) => {
    const res = await api.post(
      `${BASE}/purchase-requisitions/${prId}/reject`,
      { comment },
      { headers: authHeaders() },
    );
    return res.data;
  },

  returnPurchaseRequisition: async (prId, reason) => {
    const res = await api.post(
      `${BASE}/purchase-requisitions/${prId}/return`,
      { reason },
      { headers: authHeaders() },
    );
    return res.data;
  },

  resubmitPurchaseRequisition: async (prId) => {
    const res = await api.post(`${BASE}/purchase-requisitions/${prId}/resubmit`, null, {
      headers: authHeaders(),
    });
    return res.data;
  },

  // ── Purchase Requisition Lines (DRAFT only) ─────────────────────────────

  addLine: async (prId, payload) => {
    const res = await api.post(`${BASE}/purchase-requisitions/${prId}/lines`, payload, {
      headers: authHeaders(),
    });
    return res.data;
  },

  updateLine: async (prId, lineId, payload) => {
    const res = await api.put(
      `${BASE}/purchase-requisitions/${prId}/lines/${lineId}`,
      payload,
      { headers: authHeaders() },
    );
    return res.data;
  },

  deleteLine: async (prId, lineId) => {
    const res = await api.delete(`${BASE}/purchase-requisitions/${prId}/lines/${lineId}`, {
      headers: authHeaders(),
    });
    return res.data;
  },

  // ── Quotation ────────────────────────────────────────────────────────────

  /**
   * Multipart create — the backend requires a file. Content-Type/boundary is left to the
   * axios instance's request interceptor (it strips the default JSON header for FormData).
   * @param {{vendorId: number, quotationNumber?: string, quotationDate?: string,
   *   validUntil?: string, totalAmount?: number, rfqId?: number, deliveryDays?: number,
   *   paymentTerms?: string, file: File}} data
   */
  createQuotation: async (
    prId,
    { vendorId, quotationNumber, quotationDate, validUntil, totalAmount, rfqId, deliveryDays, paymentTerms, file },
  ) => {
    const formData = new FormData();
    formData.append("vendor_id", vendorId);
    if (quotationNumber) formData.append("quotation_number", quotationNumber);
    if (quotationDate) formData.append("quotation_date", quotationDate);
    if (validUntil) formData.append("valid_until", validUntil);
    if (totalAmount !== undefined && totalAmount !== null && totalAmount !== "") {
      formData.append("total_amount", totalAmount);
    }
    if (rfqId !== undefined && rfqId !== null && rfqId !== "") formData.append("rfq_id", rfqId);
    if (deliveryDays !== undefined && deliveryDays !== null && deliveryDays !== "") {
      formData.append("delivery_days", deliveryDays);
    }
    if (paymentTerms) formData.append("payment_terms", paymentTerms);
    formData.append("file", file);

    const res = await api.post(`${BASE}/purchase-requisitions/${prId}/quotations`, formData);
    return res.data;
  },

  getQuotationsForPr: async (prId) => {
    const res = await api.get(`${BASE}/purchase-requisitions/${prId}/quotations`, {
      headers: authHeaders(),
    });
    return res.data;
  },

  getQuotationById: async (quotationId) => {
    const res = await api.get(`${BASE}/quotations/${quotationId}`, { headers: authHeaders() });
    return res.data;
  },

  viewQuotationDocument: async (quotationId) => {
    const res = await api.get(`${BASE}/quotations/${quotationId}/document/view`, {
      responseType: "blob",
    });
    return { blob: res.data, contentType: res.headers["content-type"] || "application/octet-stream" };
  },

  downloadQuotationDocument: async (quotationId) => {
    const res = await api.get(`${BASE}/quotations/${quotationId}/document/download`, {
      responseType: "blob",
    });
    return { blob: res.data, contentType: res.headers["content-type"] || "application/octet-stream" };
  },

  deleteQuotation: async (quotationId) => {
    const res = await api.delete(`${BASE}/quotations/${quotationId}`, { headers: authHeaders() });
    return res.data;
  },

  // ── Vendor Selection ─────────────────────────────────────────────────────

  selectVendor: async (prId, quotationId, reason) => {
    const res = await api.post(
      `${BASE}/purchase-requisitions/${prId}/select-vendor`,
      { quotation_id: quotationId, reason: reason || undefined },
      { headers: authHeaders() },
    );
    return res.data;
  },

  // ── Purchase Order Generation ────────────────────────────────────────────

  generatePurchaseOrder: async (prId) => {
    const res = await api.post(`${BASE}/purchase-requisitions/${prId}/generate-po`, null, {
      headers: authHeaders(),
    });
    return res.data;
  },
};

export default procurementService;
