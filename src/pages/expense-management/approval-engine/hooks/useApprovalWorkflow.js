import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approvalWorkflowApi } from "../api/approvalWorkflowApi";

// ── Query keys ──────────────────────────────────────────────────────────────
export const MY_QUEUE_KEY = (page, size) => ["approvalMyQueue", page, size];
export const MY_HISTORY_KEY = (outcome, page, size) => ["approvalMyHistory", outcome ?? "ALL", page, size];
export const APPROVAL_STATUS_KEY = (reportId) => ["approvalStatus", reportId];
export const LINE_ITEM_REVIEWS_KEY = (reportId) => ["approvalLineItemReviews", reportId];

const unwrap = (res) => (res?.data?.data !== undefined ? res.data.data : res?.data);

// ── Queries ─────────────────────────────────────────────────────────────────

/** PageResponse<ApprovalQueueItemResponse> - live-refreshed by ApprovalWebSocketProvider on 'approval-queue-updates'. */
export const useMyQueue = (page = 0, size = 20) =>
  useQuery({
    queryKey: MY_QUEUE_KEY(page, size),
    queryFn: () => approvalWorkflowApi.getMyQueue(page, size).then(unwrap),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });

/** PageResponse<ExpenseReportResponse>. outcome: "APPROVED" | "REJECTED" | undefined. */
export const useMyHistory = (outcome, page = 0, size = 20) =>
  useQuery({
    queryKey: MY_HISTORY_KEY(outcome, page, size),
    queryFn: () => approvalWorkflowApi.getMyHistory(outcome, page, size).then(unwrap),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });

/** ApprovalStatusResponse - live-refreshed on 'report-updates'. */
export const useApprovalStatus = (reportId) =>
  useQuery({
    queryKey: APPROVAL_STATUS_KEY(reportId),
    queryFn: () => approvalWorkflowApi.getApprovalStatus(reportId).then(unwrap),
    enabled: !!reportId,
    staleTime: 15_000,
  });

/** LineItemReviewResponse[] - live-refreshed on 'report-updates'. */
export const useLineItemReviews = (reportId) =>
  useQuery({
    queryKey: LINE_ITEM_REVIEWS_KEY(reportId),
    queryFn: () => approvalWorkflowApi.getLineItemReviews(reportId).then(unwrap),
    enabled: !!reportId,
    staleTime: 15_000,
  });

// ── Mutations ───────────────────────────────────────────────────────────────
// Every mutation invalidates broadly rather than trying to patch the cache in
// place - queue/history/status all key off server-resolved eligibility
// (canRecall/canCancel, eligibleForBulkApprove) that isn't safe to guess
// client-side after a write.

const invalidateApprovalCaches = (qc, reportId) => {
  qc.invalidateQueries({ queryKey: ["approvalMyQueue"] });
  qc.invalidateQueries({ queryKey: ["approvalMyHistory"] });
  if (reportId) {
    qc.invalidateQueries({ queryKey: APPROVAL_STATUS_KEY(reportId) });
    qc.invalidateQueries({ queryKey: LINE_ITEM_REVIEWS_KEY(reportId) });
  }
};

export const useSubmitReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId) => approvalWorkflowApi.submit(reportId).then(unwrap),
    onSuccess: (_data, reportId) => invalidateApprovalCaches(qc, reportId),
  });
};

export const useRecallReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId) => approvalWorkflowApi.recall(reportId).then(unwrap),
    onSuccess: (_data, reportId) => invalidateApprovalCaches(qc, reportId),
  });
};

export const useCancelReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId) => approvalWorkflowApi.cancel(reportId).then(unwrap),
    onSuccess: (_data, reportId) => invalidateApprovalCaches(qc, reportId),
  });
};

export const useReviewLineItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, lineItemId, decision, comment }) =>
      approvalWorkflowApi.reviewLineItem(reportId, lineItemId, decision, comment).then(unwrap),
    // Refresh on failure too, not just success: a rejection here (e.g. the level has already moved
    // on to Finance Verification since this queue was last fetched) means the row shown was already
    // stale - re-fetching immediately clears it instead of leaving it sitting there to be retried.
    onSettled: (_data, _err, { reportId }) => invalidateApprovalCaches(qc, reportId),
  });
};

export const useRejectReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, comment }) => approvalWorkflowApi.rejectReport(reportId, comment).then(unwrap),
    onSettled: (_data, _err, { reportId }) => invalidateApprovalCaches(qc, reportId),
  });
};

export const useBulkApprove = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId) => approvalWorkflowApi.bulkApprove(reportId).then(unwrap),
    onSettled: (_data, _err, reportId) => invalidateApprovalCaches(qc, reportId),
  });
};
