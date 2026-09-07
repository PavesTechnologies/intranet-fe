import { useMutation, useQueryClient } from "@tanstack/react-query";
import procurementService from "../services/procurementService";
import { PR_QUOTATIONS_KEY } from "./useQuotations";
import { PR_DETAIL_KEY } from "./usePurchaseRequisitionDetail";

export const useCreateQuotation = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => procurementService.createQuotation(prId, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: PR_QUOTATIONS_KEY(prId) });
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      qc.invalidateQueries({ queryKey: ["accountsPayable", "procurement", "purchaseRequisitions"] });
      // A quotation submitted against an RFQ can flip that RFQ SENT -> RESPONSE_RECEIVED.
      if (variables?.rfqId) {
        qc.invalidateQueries({ queryKey: ["accountsPayable", "procurement", "rfq", variables.rfqId] });
        qc.invalidateQueries({ queryKey: ["accountsPayable", "procurement", "rfqQuotations", variables.rfqId] });
        qc.invalidateQueries({ queryKey: ["accountsPayable", "procurement", "rfqs"] });
      }
    },
  });
};

export const useDeleteQuotation = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quotationId) => procurementService.deleteQuotation(quotationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_QUOTATIONS_KEY(prId) });
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
    },
  });
};
