import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { financeVerificationApi } from "../api/financeVerificationApi";

// ── Query keys ──────────────────────────────────────────────────────────────
export const FINANCE_QUEUE_KEY = (page, size) => ["financeQueue", page, size];
export const FINANCE_STATUS_KEY = (reportId) => ["financeStatus", reportId];
export const FINANCE_REVIEWS_KEY = (reportId) => ["financeReviews", reportId];

const unwrap = (res) => (res?.data?.data !== undefined ? res.data.data : res?.data);

// ── Queries ─────────────────────────────────────────────────────────────────

/** PageResponse<FinanceQueueItemResponse> */
export const useFinanceQueue = (page = 0, size = 20) =>
  useQuery({
    queryKey: FINANCE_QUEUE_KEY(page, size),
    queryFn: () => financeVerificationApi.getMyQueue(page, size).then(unwrap),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });

/** ApprovalStatusResponse */
export const useFinanceStatus = (reportId) =>
  useQuery({
    queryKey: FINANCE_STATUS_KEY(reportId),
    queryFn: () => financeVerificationApi.getStatus(reportId).then(unwrap),
    enabled: !!reportId,
    staleTime: 15_000,
  });

/** FinanceLineItemReviewResponse[] */
export const useFinanceReviews = (reportId) =>
  useQuery({
    queryKey: FINANCE_REVIEWS_KEY(reportId),
    queryFn: () => financeVerificationApi.getReviews(reportId).then(unwrap),
    enabled: !!reportId,
    staleTime: 15_000,
  });

// ── Mutations ───────────────────────────────────────────────────────────────

const invalidateFinanceCaches = (qc, reportId) => {
  qc.invalidateQueries({ queryKey: ["financeQueue"] });
  if (reportId) {
    qc.invalidateQueries({ queryKey: FINANCE_STATUS_KEY(reportId) });
    qc.invalidateQueries({ queryKey: FINANCE_REVIEWS_KEY(reportId) });
  }
};

export const useVerifyLineItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, lineItemId }) =>
      financeVerificationApi.verifyLineItem(reportId, lineItemId).then(unwrap),
    // Refresh on failure too - a rejected verify (e.g. eligibility changed since this queue was
    // last fetched) means the row shown was already stale, so re-fetch clears it immediately.
    onSettled: (_data, _err, { reportId }) => invalidateFinanceCaches(qc, reportId),
  });
};

export const useQueryLineItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, lineItemId, reason }) =>
      financeVerificationApi.queryLineItem(reportId, lineItemId, reason).then(unwrap),
    onSettled: (_data, _err, { reportId }) => invalidateFinanceCaches(qc, reportId),
  });
};
