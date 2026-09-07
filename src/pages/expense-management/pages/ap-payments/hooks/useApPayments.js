import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apPaymentApi } from "@/pages/accounts-payable/services/apPaymentApi";

/**
 * Wraps the existing accounts-payable apPaymentApi (GET /xms/ap-payments/queue,
 * GET /xms/ap-payments/{reportId}, POST /xms/ap-payments/{reportId}/complete) rather than
 * re-declaring the same axios calls here - those three endpoints belong to this same
 * expense-management-service backend regardless of which frontend module surfaces them, so this
 * file is only the react-query wiring (matching the useApprovalWorkflow.js / useFinanceVerification.js
 * hook convention used elsewhere in Expense Management), not a second API client.
 */

export const AP_QUEUE_KEY = (page, size) => ["apPaymentQueue", page, size];
export const AP_DETAILS_KEY = (reportId) => ["apPaymentDetails", reportId];

const unwrap = (res) => (res?.data?.data !== undefined ? res.data.data : res?.data);

/** PageResponse<ApPaymentQueueItemResponse> - reportStatus=APPROVED AND paymentRoutingStatus=APPROVED_FOR_PAYMENT, enforced server-side. */
export const useApPaymentQueue = (page = 0, size = 20) =>
  useQuery({
    queryKey: AP_QUEUE_KEY(page, size),
    queryFn: () => apPaymentApi.getQueue(page, size).then(unwrap),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });

/** ApPaymentDetailsResponse (report + line items + approval status), only fetched once a row is opened. */
export const useApPaymentDetails = (reportId) =>
  useQuery({
    queryKey: AP_DETAILS_KEY(reportId),
    queryFn: () => apPaymentApi.getDetails(reportId).then(unwrap),
    enabled: !!reportId,
    staleTime: 15_000,
  });

export const useCompletePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId) => apPaymentApi.completePayment(reportId).then(unwrap),
    // Refresh on failure too - e.g. a duplicate-completion attempt means this row was already
    // stale (someone else completed it first), so re-fetching clears it immediately.
    onSettled: (_data, _err, reportId) => {
      qc.invalidateQueries({ queryKey: ["apPaymentQueue"] });
      qc.invalidateQueries({ queryKey: AP_DETAILS_KEY(reportId) });
    },
  });
};
