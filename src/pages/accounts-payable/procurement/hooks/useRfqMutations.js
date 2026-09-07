import { useMutation, useQueryClient } from "@tanstack/react-query";
import rfqService from "../services/rfqService";
import { RFQ_DETAIL_KEY, RFQ_VENDORS_KEY } from "./useRfqs";
import { PR_DETAIL_KEY } from "./usePurchaseRequisitionDetail";

const invalidateRfqLists = (qc) =>
  qc.invalidateQueries({ queryKey: ["accountsPayable", "procurement", "rfqs"] });

export const useCreateRfq = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dueDate) => rfqService.createRfq(prId, dueDate),
    onSuccess: () => {
      invalidateRfqLists(qc);
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
    },
  });
};

export const useInviteVendors = (rfqId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vendorIds) => rfqService.inviteVendors(rfqId, vendorIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RFQ_DETAIL_KEY(rfqId) });
      qc.invalidateQueries({ queryKey: RFQ_VENDORS_KEY(rfqId) });
      invalidateRfqLists(qc);
    },
  });
};

export const useSendRfq = (rfqId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rfqService.sendRfq(rfqId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RFQ_DETAIL_KEY(rfqId) });
      invalidateRfqLists(qc);
    },
  });
};

export const useCloseRfq = (rfqId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rfqService.closeRfq(rfqId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RFQ_DETAIL_KEY(rfqId) });
      invalidateRfqLists(qc);
    },
  });
};
