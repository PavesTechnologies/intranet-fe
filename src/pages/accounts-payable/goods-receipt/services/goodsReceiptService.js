// src/pages/accounts-payable/goods-receipt/services/goodsReceiptService.js
import api from "../../../../api/axiosInstance";
import { extractFileNameFromContentDisposition } from "../../utils/documentUpload";

const BASE = window.__APP_CONFIG__.AP_BASE_URL;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

/**
 * Goods Receipt (GRN) API. Matches Backend/API_Layer/routes/goods_receipt_route.py
 * (/goods-receipt), per the /apm/docs OpenAPI schema.
 */
export const goodsReceiptService = {
  getGoodsReceipts: async ({ vendorId, poId, skip, limit } = {}) => {
    const res = await api.get(`${BASE}/goods-receipt`, {
      params: {
        vendor_id: vendorId ?? undefined,
        po_id: poId ?? undefined,
        skip,
        limit,
      },
      headers: authHeaders(),
    });
    return res.data;
  },

  createGoodsReceipt: async (payload) => {
    const res = await api.post(`${BASE}/goods-receipt`, payload, {
      headers: authHeaders(),
    });
    return res.data;
  },

  /**
   * Uploads a GRN document for an existing goods receipt. Additional to manual GRN entry — does
   * not replace it. Per POST /apm/grn/{grn_id}/document.
   * @param {string|number} grnId
   * @param {File} file
   */
  uploadGoodsReceiptDocument: async (grnId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(`${BASE}/grn/${Number(grnId)}/document`, formData, {
      headers: authHeaders(),
    });
    return res.data;
  },

  /**
   * Fetches the GRN document for download. Per GET /apm/grn/{grn_id}/document/download.
   * @param {string|number} grnId
   * @returns {Promise<{blob: Blob, contentType: string, fileName: string|null}>}
   */
  downloadGoodsReceiptDocument: async (grnId) => {
    const res = await api.get(`${BASE}/grn/${Number(grnId)}/document/download`, {
      headers: authHeaders(),
      responseType: "blob",
    });
    return {
      blob: res.data,
      contentType: res.headers["content-type"] || "application/octet-stream",
      fileName: extractFileNameFromContentDisposition(res.headers["content-disposition"]),
    };
  },
};

export default goodsReceiptService;
