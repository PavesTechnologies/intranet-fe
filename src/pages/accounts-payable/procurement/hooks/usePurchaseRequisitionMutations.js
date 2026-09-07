import { useMutation, useQueryClient } from "@tanstack/react-query";
import procurementService from "../services/procurementService";
import { PR_DETAIL_KEY } from "./usePurchaseRequisitionDetail";

const invalidatePrLists = (qc) =>
  qc.invalidateQueries({ queryKey: ["accountsPayable", "procurement", "purchaseRequisitions"] });
const invalidatePendingApprovals = (qc) =>
  qc.invalidateQueries({ queryKey: ["accountsPayable", "procurement", "pendingApprovals"] });

// ── Purchase Requisition ──────────────────────────────────────────────────

export const useCreatePurchaseRequisition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => procurementService.createPurchaseRequisition(payload),
    onSuccess: () => invalidatePrLists(qc),
  });
};

export const useUpdatePurchaseRequisition = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => procurementService.updatePurchaseRequisition(prId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      invalidatePrLists(qc);
    },
  });
};

export const useDeletePurchaseRequisition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prId) => procurementService.deletePurchaseRequisition(prId),
    onSuccess: () => invalidatePrLists(qc),
  });
};

export const useSubmitPurchaseRequisition = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => procurementService.submitPurchaseRequisition(prId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      invalidatePrLists(qc);
      invalidatePendingApprovals(qc);
    },
  });
};

export const useCancelPurchaseRequisition = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => procurementService.cancelPurchaseRequisition(prId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      invalidatePrLists(qc);
      invalidatePendingApprovals(qc);
    },
  });
};

export const useApprovePurchaseRequisition = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment) => procurementService.approvePurchaseRequisition(prId, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      invalidatePrLists(qc);
      invalidatePendingApprovals(qc);
    },
  });
};

export const useRejectPurchaseRequisition = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment) => procurementService.rejectPurchaseRequisition(prId, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      invalidatePrLists(qc);
      invalidatePendingApprovals(qc);
    },
  });
};

export const useReturnPurchaseRequisition = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason) => procurementService.returnPurchaseRequisition(prId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      invalidatePrLists(qc);
      invalidatePendingApprovals(qc);
    },
  });
};

export const useResubmitPurchaseRequisition = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => procurementService.resubmitPurchaseRequisition(prId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      invalidatePrLists(qc);
      invalidatePendingApprovals(qc);
    },
  });
};

// ── Purchase Requisition Lines (DRAFT only) ───────────────────────────────

export const useAddPrLine = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => procurementService.addLine(prId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      invalidatePrLists(qc);
    },
  });
};

export const useUpdatePrLine = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, payload }) => procurementService.updateLine(prId, lineId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      invalidatePrLists(qc);
    },
  });
};

export const useDeletePrLine = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId) => procurementService.deleteLine(prId, lineId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      invalidatePrLists(qc);
    },
  });
};

// ── Vendor Selection / PO Generation ──────────────────────────────────────

export const useSelectVendor = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quotationId, reason }) => procurementService.selectVendor(prId, quotationId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      qc.invalidateQueries({ queryKey: ["accountsPayable", "procurement", "quotations", prId] });
      invalidatePrLists(qc);
    },
  });
};

export const useGeneratePurchaseOrder = (prId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => procurementService.generatePurchaseOrder(prId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_DETAIL_KEY(prId) });
      invalidatePrLists(qc);
      qc.invalidateQueries({ queryKey: ["accountsPayable", "purchaseOrder"] });
    },
  });
};
