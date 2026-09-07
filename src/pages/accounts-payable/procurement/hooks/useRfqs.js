import { useQuery } from "@tanstack/react-query";
import rfqService from "../services/rfqService";

export const RFQ_LIST_KEY = (filters) => ["accountsPayable", "procurement", "rfqs", filters];
export const RFQ_DETAIL_KEY = (rfqId) => ["accountsPayable", "procurement", "rfq", rfqId];
export const RFQ_VENDORS_KEY = (rfqId) => ["accountsPayable", "procurement", "rfqVendors", rfqId];
export const RFQ_QUOTATIONS_KEY = (rfqId) => [
  "accountsPayable",
  "procurement",
  "rfqQuotations",
  rfqId,
];

/** RFQs for a given PR (used by the Quotation tab's RFQ list for the selected requisition). */
export const useRfqsForPr = (prId) =>
  useQuery({
    queryKey: RFQ_LIST_KEY({ prId }),
    queryFn: () => rfqService.getRfqs({ prId, limit: 200 }),
    enabled: !!prId,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

export const useRfqDetail = (rfqId) =>
  useQuery({
    queryKey: RFQ_DETAIL_KEY(rfqId),
    queryFn: () => rfqService.getRfqById(rfqId),
    enabled: !!rfqId,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

export const useRfqVendors = (rfqId) =>
  useQuery({
    queryKey: RFQ_VENDORS_KEY(rfqId),
    queryFn: () => rfqService.getRfqVendors(rfqId),
    enabled: !!rfqId,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

export const useQuotationsForRfq = (rfqId) =>
  useQuery({
    queryKey: RFQ_QUOTATIONS_KEY(rfqId),
    queryFn: () => rfqService.getQuotationsForRfq(rfqId),
    enabled: !!rfqId,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

export default useRfqsForPr;
