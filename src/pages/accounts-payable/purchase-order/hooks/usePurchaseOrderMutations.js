import { useMutation, useQueryClient } from "@tanstack/react-query";
import purchaseOrderService from "../services/purchaseOrderService";
import { PO_LIST_KEY, PO_DETAIL_KEY } from "./usePurchaseOrders";

export const useCreatePurchaseOrder = (vendorId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => purchaseOrderService.createPurchaseOrder(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: PO_LIST_KEY(vendorId) }),
  });
};

/**
 * Uploads a PO document for an existing purchase order (Vendor Detail > PO tab, per-row "Upload"
 * action) — additional to manual PO entry, not a replacement for useCreatePurchaseOrder.
 * @param {string|number} vendorId
 */
export const useUploadPurchaseOrderDocument = (vendorId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ poId, file }) => purchaseOrderService.uploadPurchaseOrderDocument(poId, file),
    onSuccess: (_data, { poId }) => {
      qc.invalidateQueries({ queryKey: PO_LIST_KEY(vendorId) });
      qc.invalidateQueries({ queryKey: PO_DETAIL_KEY(poId) });
    },
  });
};

export default useCreatePurchaseOrder;
