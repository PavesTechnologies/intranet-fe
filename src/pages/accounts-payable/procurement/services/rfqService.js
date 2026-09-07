// src/pages/accounts-payable/procurement/services/rfqService.js
import api from "../../../../api/axiosInstance";

const BASE = `${window.__APP_CONFIG__.AP_BASE_URL}/rfq`;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

/**
 * RFQ (Request for Quotation) API — the sourcing step between an APPROVED purchase
 * requisition and its quotations. Matches Backend/API_Layer/routes/rfq_route.py
 * (mounted at /apm/rfq).
 */
export const rfqService = {
  createRfq: async (prId, dueDate) => {
    const res = await api.post(
      `${BASE}/`,
      { pr_id: prId, due_date: dueDate || undefined },
      { headers: authHeaders() },
    );
    return res.data;
  },

  /**
   * @param {{prId?: number, statusId?: number, skip?: number, limit?: number}} filters
   */
  getRfqs: async ({ prId, statusId, skip = 0, limit = 100 } = {}) => {
    const res = await api.get(`${BASE}/`, {
      params: {
        pr_id: prId || undefined,
        status_id: statusId || undefined,
        skip,
        limit,
      },
      headers: authHeaders(),
    });
    return res.data;
  },

  getRfqById: async (rfqId) => {
    const res = await api.get(`${BASE}/${rfqId}`, { headers: authHeaders() });
    return res.data;
  },

  inviteVendors: async (rfqId, vendorIds) => {
    const res = await api.post(
      `${BASE}/${rfqId}/vendors`,
      { vendor_ids: vendorIds },
      { headers: authHeaders() },
    );
    return res.data;
  },

  getRfqVendors: async (rfqId) => {
    const res = await api.get(`${BASE}/${rfqId}/vendors`, { headers: authHeaders() });
    return res.data;
  },

  sendRfq: async (rfqId) => {
    const res = await api.post(`${BASE}/${rfqId}/send`, null, { headers: authHeaders() });
    return res.data;
  },

  closeRfq: async (rfqId) => {
    const res = await api.post(`${BASE}/${rfqId}/close`, null, { headers: authHeaders() });
    return res.data;
  },

  getQuotationsForRfq: async (rfqId) => {
    const res = await api.get(`${BASE}/${rfqId}/quotations`, { headers: authHeaders() });
    return res.data;
  },
};

export default rfqService;
