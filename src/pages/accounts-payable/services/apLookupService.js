// src/pages/accounts-payable/services/apLookupService.js
import api from "../../../api/axiosInstance";

const BASE = window.__APP_CONFIG__.AP_BASE_URL;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

/**
 * Shared Accounts Payable master-data lookups (country/currency/payment
 * term/vendor status/GSTIN). Not vendor-specific — other AP sub-modules
 * (invoice, payment) can reuse these as they come off mock data.
 */
export const apLookupService = {
  getCountries: async () => {
    const res = await api.get(`${BASE}/system/country`, { headers: authHeaders() });
    return res.data;
  },

  getCurrencies: async () => {
    const res = await api.get(`${BASE}/system/currency`, { headers: authHeaders() });
    return res.data;
  },

  getPaymentTerms: async () => {
    const res = await api.get(`${BASE}/master/payment-term`, { headers: authHeaders() });
    return res.data;
  },

  getVendorStatuses: async () => {
    const res = await api.get(`${BASE}/system/status`, {
      params: { module_name: "VENDOR" },
      headers: authHeaders(),
    });
    return res.data;
  },

  getPoStatuses: async () => {
    const res = await api.get(`${BASE}/system/status`, {
      params: { module_name: "PO" },
      headers: authHeaders(),
    });
    return res.data;
  },

  getPaymentStatuses: async () => {
    const res = await api.get(`${BASE}/system/status`, {
      params: { module_name: "PAYMENT" },
      headers: authHeaders(),
    });
    return res.data;
  },

  /** Purchase requisition lifecycle statuses (module_name "PURCHASE_REQUISITION"). */
  getPrStatuses: async () => {
    const res = await api.get(`${BASE}/system/status`, {
      params: { module_name: "PURCHASE_REQUISITION" },
      headers: authHeaders(),
    });
    return res.data;
  },

  /** Quotation statuses — RECEIVED / SELECTED / REJECTED only (module_name "QUOTATION"). */
  getQuotationStatuses: async () => {
    const res = await api.get(`${BASE}/system/status`, {
      params: { module_name: "QUOTATION" },
      headers: authHeaders(),
    });
    return res.data;
  },

  /** RFQ lifecycle statuses — DRAFT / SENT / RESPONSE_RECEIVED / CLOSED (module_name "RFQ"). */
  getRfqStatuses: async () => {
    const res = await api.get(`${BASE}/system/status`, {
      params: { module_name: "RFQ" },
      headers: authHeaders(),
    });
    return res.data;
  },

  getGstinDetails: async (gstin) => {
    const res = await api.get(`${BASE}/system/gstin/${encodeURIComponent(gstin)}`, {
      headers: authHeaders(),
    });

    return res.data.data.data; // returns only the GST details
  },
};

export default apLookupService;
