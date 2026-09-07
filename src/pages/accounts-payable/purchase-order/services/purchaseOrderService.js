// src/pages/accounts-payable/purchase-order/services/purchaseOrderService.js

import api from "../../../../api/axiosInstance";
import {
  extractFileNameFromContentDisposition,
} from "../../utils/documentUpload";

const BASE =
  window.__APP_CONFIG__.AP_BASE_URL;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem(
    "token"
  )}`,
});

/**
 * Purchase Order API.
 *
 * GET  /apm/purchase-order
 * GET  /apm/purchase-order/{po_id}
 * POST /apm/purchase-order
 * PUT  /apm/purchase-order/{po_id}
 * DELETE /apm/purchase-order/{po_id}
 * PATCH /apm/purchase-order/{po_id}/status
 * POST /apm/purchase-order/{po_id}/document
 * GET  /apm/purchase-order/{po_id}/document/view
 * GET  /apm/purchase-order/{po_id}/document/download
 */
export const purchaseOrderService = {
  /**
   * Get purchase orders.
   *
   * The Vendor PO tab uses:
   *
   * GET /apm/purchase-order?po_id=15
   */
  getPurchaseOrders: async ({
    poId,
    statusId,
    search,
    skip,
    limit,
  } = {}) => {
    const res = await api.get(
      `${BASE}/purchase-order`,
      {
        params: {
          po_id:
            poId ?? undefined,

          status_id:
            statusId ?? undefined,

          search:
            search || undefined,

          skip,
          limit,
        },

        headers: authHeaders(),
      }
    );

    return res.data;
  },

  /**
   * Get a single purchase order by ID.
   *
   * GET /apm/purchase-order/{po_id}
   */
  getPurchaseOrderById: async (
    poId
  ) => {
    const res = await api.get(
      `${BASE}/purchase-order/${Number(
        poId
      )}`,
      {
        headers: authHeaders(),
      }
    );

    return res.data;
  },

  /**
   * Create purchase order.
   *
   * POST /apm/purchase-order
   */
  createPurchaseOrder: async (
    payload
  ) => {
    const res = await api.post(
      `${BASE}/purchase-order`,
      payload,
      {
        headers: authHeaders(),
      }
    );

    return res.data;
  },

  /**
   * Upload purchase order document.
   *
   * POST /apm/purchase-order/{po_id}/document
   */
  uploadPurchaseOrderDocument: async (
    poId,
    file
  ) => {
    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    const res = await api.post(
      `${BASE}/purchase-order/${Number(
        poId
      )}/document`,
      formData,
      {
        headers: authHeaders(),
      }
    );

    return res.data;
  },

  /**
   * View purchase order document.
   *
   * GET /apm/purchase-order/{po_id}/document/view
   */
  viewPurchaseOrderDocument:
    async (poId) => {
      const res = await api.get(
        `${BASE}/purchase-order/${Number(
          poId
        )}/document/view`,
        {
          headers:
            authHeaders(),

          responseType:
            "blob",
        }
      );

      return {
        blob: res.data,

        contentType:
          res.headers[
            "content-type"
          ] ||
          "application/pdf",

        fileName:
          extractFileNameFromContentDisposition(
            res.headers[
              "content-disposition"
            ]
          ),
      };
    },

  /**
   * Download purchase order document.
   *
   * GET /apm/purchase-order/{po_id}/document/download
   */
  downloadPurchaseOrderDocument:
    async (poId) => {
      const res = await api.get(
        `${BASE}/purchase-order/${Number(
          poId
        )}/document/download`,
        {
          headers:
            authHeaders(),

          responseType:
            "blob",
        }
      );

      return {
        blob: res.data,

        contentType:
          res.headers[
            "content-type"
          ] ||
          "application/octet-stream",

        fileName:
          extractFileNameFromContentDisposition(
            res.headers[
              "content-disposition"
            ]
          ),
      };
    },
};

export default purchaseOrderService;