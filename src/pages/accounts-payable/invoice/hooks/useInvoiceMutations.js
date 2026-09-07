import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceService } from "../services/invoiceService";
import { INVOICE_DETAIL_KEY } from "./useInvoiceDetail";
import { INVOICE_SUMMARY_KEY } from "./useInvoiceSummary";

/**
 * Returns the invalidation promise so callers can `await` it in `onSuccess` — invalidateQueries
 * resolves once its matching *active* queries have actually refetched, not just when they're
 * marked stale. Awaiting it there keeps the mutation pending until the invoice list/detail have
 * genuinely reloaded, instead of letting the UI (e.g. closing a confirm dialog) move on first.
 *
 * Exported for InvoiceUploadPage, which invalidates once the extract-fields/validate-fields
 * pipeline reaches a terminal state — not automatically here, since neither mutation alone
 * reflects the invoice's final persisted state.
 */
export function invalidateInvoices(queryClient, invoiceId) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["accountsPayable", "invoices"] }),
    queryClient.invalidateQueries({ queryKey: INVOICE_SUMMARY_KEY }),
    invoiceId ? queryClient.invalidateQueries({ queryKey: INVOICE_DETAIL_KEY(invoiceId) }) : null,
  ]);
}

/**
 * Stage 1 of the upload pipeline: the real OCR/field extraction request (~30s, no backend
 * progress tracking). See InvoiceUploadPage for orchestration with useValidateInvoiceFieldsMutation
 * and useInvoiceValidationProgress.
 * @param {File} file
 */
export function useExtractInvoiceFieldsMutation() {
  return useMutation({
    mutationFn: (file) => invoiceService.extractInvoiceFields(file),
  });
}

/**
 * Stage 2 of the upload pipeline: queues background field validation for the invoice just
 * extracted by useExtractInvoiceFieldsMutation. Resolves immediately with { job_id, status:
 * "QUEUED" } — actual per-stage progress comes from useInvoiceValidationProgress.
 * @param {Object} extractionResult - raw extract-fields response
 */
export function useValidateInvoiceFieldsMutation() {
  return useMutation({
    mutationFn: (extractionResult) => invoiceService.validateInvoiceFields(extractionResult),
  });
}

/**
 * Stage 3 of the upload pipeline: persists the invoice once the user confirms the processing
 * result ("Save Invoice"). The invoice isn't created until this succeeds — extract-fields and
 * validate-fields never persist anything on their own.
 * @param {Object} extractionResult - the same raw extract-fields response sent to validate-fields
 */
export function useCreateInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (extractionResult) => invoiceService.createInvoice(extractionResult),
    onSuccess: (data) => invalidateInvoices(queryClient, data?.invoice_id),
  });
}

/**
 * Stage 1 field corrections (Vendor/Buyer/Tax/Amounts). Each is a sparse PATCH against the
 * backend's Redis extraction cache — never persisted to the Invoice DB and never revalidated
 * automatically. Callers must re-run useValidateInvoiceFieldsMutation with { extraction_id }
 * afterwards to get a fresh validation job against the corrected data.
 */
export function useCorrectVendorMutation() {
  return useMutation({
    mutationFn: ({ extractionId, patch }) => invoiceService.correctVendorFields(extractionId, patch),
  });
}

export function useCorrectBuyerMutation() {
  return useMutation({
    mutationFn: ({ extractionId, patch }) => invoiceService.correctBuyerFields(extractionId, patch),
  });
}

export function useCorrectTaxMutation() {
  return useMutation({
    mutationFn: ({ extractionId, patch }) => invoiceService.correctTaxFields(extractionId, patch),
  });
}

export function useCorrectAmountsMutation() {
  return useMutation({
    mutationFn: ({ extractionId, patch }) => invoiceService.correctAmountsFields(extractionId, patch),
  });
}

export function useConfirmExtractionSectionMutation() {
  return useMutation({
    mutationFn: ({ extractionId, section }) => invoiceService.confirmExtractionSection(extractionId, section),
  });
}

/**
 * Direct status transition via PUT /apm/invoice/status-update/{invoice_id}?status_id={status_id}.
 * Used by the Invoice Management row action that moves an invoice from OCR Review Pending to
 * Pending Approval without going through the OCR Review Queue's field-correction flow.
 */
export function useUpdateInvoiceStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, statusId }) => invoiceService.updateInvoiceStatus(invoiceId, statusId),
    onSuccess: (_data, { invoiceId }) => invalidateInvoices(queryClient, invoiceId),
  });
}
