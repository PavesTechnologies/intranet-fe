// src/pages/accounts-payable/system-configuration/services/purchaseCategoryService.js
import api from "../../../../api/axiosInstance";

const BASE = window.__APP_CONFIG__.AP_BASE_URL;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

/**
 * Purchase Category Master API (AP System Configuration). Matches
 * Backend/API_Layer/routes/master_purchase_category_route.py.
 */
export const purchaseCategoryService = {
  /**
   * @param {{departmentId?: number}} [filters] - department_id is an existing, optional
   *   server-side filter on this endpoint (verified against the live OpenAPI schema); omitted
   *   entirely it behaves exactly as before and returns every category.
   */
  getPurchaseCategories: async ({ departmentId } = {}) => {
    const res = await api.get(`${BASE}/master/purchase-categories`, {
      params: { department_id: departmentId || undefined },
      headers: authHeaders(),
    });
    return res.data;
  },

  getPurchaseCategoryById: async (categoryId) => {
    const res = await api.get(`${BASE}/master/purchase-categories/${categoryId}`, {
      headers: authHeaders(),
    });
    return res.data;
  },

  createPurchaseCategory: async (payload) => {
    const res = await api.post(`${BASE}/master/purchase-categories`, payload, {
      headers: authHeaders(),
    });
    return res.data;
  },

  updatePurchaseCategory: async (categoryId, payload) => {
    const res = await api.put(`${BASE}/master/purchase-categories/${categoryId}`, payload, {
      headers: authHeaders(),
    });
    return res.data;
  },

  deletePurchaseCategory: async (categoryId) => {
    const res = await api.delete(`${BASE}/master/purchase-categories/${categoryId}`, {
      headers: authHeaders(),
    });
    return res.data;
  },
};

export default purchaseCategoryService;
