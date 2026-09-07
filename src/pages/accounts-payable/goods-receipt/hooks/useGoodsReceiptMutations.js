import { useMutation, useQueryClient } from "@tanstack/react-query";
import goodsReceiptService from "../services/goodsReceiptService";
import { GRN_LIST_KEY } from "./useGoodsReceipts";

export const useCreateGoodsReceipt = (vendorId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => goodsReceiptService.createGoodsReceipt(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: GRN_LIST_KEY(vendorId) }),
  });
};

/**
 * Uploads a GRN document for an existing goods receipt (Vendor Detail > GRN tab, per-row "Upload"
 * action) — additional to manual GRN entry, not a replacement for useCreateGoodsReceipt.
 * @param {string|number} vendorId
 */
export const useUploadGoodsReceiptDocument = (vendorId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ grnId, file }) => goodsReceiptService.uploadGoodsReceiptDocument(grnId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: GRN_LIST_KEY(vendorId) }),
  });
};

export default useCreateGoodsReceipt;
