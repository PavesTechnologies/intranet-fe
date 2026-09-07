import { useQuery } from "@tanstack/react-query";
import apLookupService from "../services/apLookupService";

// Master data changes rarely — cache aggressively (mirrors the
// useProjectStatuses precedent in Projects/MyWork/hooks/useMyWork.js).
const MASTER_DATA_OPTIONS = {
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
  retry: 1,
};

export const COUNTRIES_KEY = ["accountsPayable", "lookups", "countries"];
export const CURRENCIES_KEY = ["accountsPayable", "lookups", "currencies"];
export const PAYMENT_TERMS_KEY = ["accountsPayable", "lookups", "paymentTerms"];
export const VENDOR_STATUSES_KEY = ["accountsPayable", "lookups", "vendorStatuses"];
export const PO_STATUSES_KEY = ["accountsPayable", "lookups", "poStatuses"];
export const PAYMENT_STATUSES_KEY = ["accountsPayable", "lookups", "paymentStatuses"];
export const PR_STATUSES_KEY = ["accountsPayable", "lookups", "prStatuses"];
export const QUOTATION_STATUSES_KEY = ["accountsPayable", "lookups", "quotationStatuses"];
export const RFQ_STATUSES_KEY = ["accountsPayable", "lookups", "rfqStatuses"];

export const useCountries = () =>
  useQuery({
    queryKey: COUNTRIES_KEY,
    queryFn: apLookupService.getCountries,
    ...MASTER_DATA_OPTIONS,
  });

export const useCurrencies = () =>
  useQuery({
    queryKey: CURRENCIES_KEY,
    queryFn: apLookupService.getCurrencies,
    ...MASTER_DATA_OPTIONS,
  });

export const usePaymentTerms = () =>
  useQuery({
    queryKey: PAYMENT_TERMS_KEY,
    queryFn: apLookupService.getPaymentTerms,
    ...MASTER_DATA_OPTIONS,
  });

export const useVendorStatuses = () =>
  useQuery({
    queryKey: VENDOR_STATUSES_KEY,
    queryFn: apLookupService.getVendorStatuses,
    ...MASTER_DATA_OPTIONS,
  });

/** Purchase Order lifecycle statuses (module_name "PO" — OPEN/CLOSED/CANCELLED). */
export const usePoStatuses = () =>
  useQuery({
    queryKey: PO_STATUSES_KEY,
    queryFn: apLookupService.getPoStatuses,
    ...MASTER_DATA_OPTIONS,
  });

export const usePaymentStatuses = () =>
  useQuery({
    queryKey: PAYMENT_STATUSES_KEY,
    queryFn: apLookupService.getPaymentStatuses,
    ...MASTER_DATA_OPTIONS,
  });

/** Purchase requisition lifecycle statuses (module_name "PURCHASE_REQUISITION"). */
export const usePrStatuses = () =>
  useQuery({
    queryKey: PR_STATUSES_KEY,
    queryFn: apLookupService.getPrStatuses,
    ...MASTER_DATA_OPTIONS,
  });

/** Quotation statuses — RECEIVED / SELECTED / REJECTED (module_name "QUOTATION"). */
export const useQuotationStatuses = () =>
  useQuery({
    queryKey: QUOTATION_STATUSES_KEY,
    queryFn: apLookupService.getQuotationStatuses,
    ...MASTER_DATA_OPTIONS,
  });

/** RFQ lifecycle statuses — DRAFT / SENT / RESPONSE_RECEIVED / CLOSED (module_name "RFQ"). */
export const useRfqStatuses = () =>
  useQuery({
    queryKey: RFQ_STATUSES_KEY,
    queryFn: apLookupService.getRfqStatuses,
    ...MASTER_DATA_OPTIONS,
  });

/**
 * Convenience aggregate for forms/filters that need several lookups at once.
 * Returns raw arrays plus `value -> label` option lists for FormSelect/FilterListbox.
 */
export const useApLookups = () => {
  const countries = useCountries();
  const currencies = useCurrencies();
  const paymentTerms = usePaymentTerms();
  const vendorStatuses = useVendorStatuses();
  const paymentStatuses = usePaymentStatuses();

  const countryOptions = (countries.data || []).map((c) => ({
    value: c.country_id,
    label: c.country_name,
  }));
  const currencyOptions = (currencies.data || []).map((c) => ({
    value: c.currency_id,
    label: `${c.currency_code} — ${c.currency_name}`,
  }));
  const paymentTermOptions = (paymentTerms.data || []).map((p) => ({
    value: p.payment_term_id,
    label: p.term_name,
  }));
  const vendorStatusOptions = (vendorStatuses.data || []).map((s) => ({
    value: s.status_id,
    label: s.status_name,
  }));
  const paymentStatusOptions = (paymentStatuses.data || []).map((s) => ({
    value: s.status_id,
    label: s.status_name,
  }));

  return {
    countries: countries.data || [],
    currencies: currencies.data || [],
    paymentTerms: paymentTerms.data || [],
    vendorStatuses: vendorStatuses.data || [],
    paymentStatuses: paymentStatuses.data || [],
    countryOptions,
    currencyOptions,
    paymentTermOptions,
    vendorStatusOptions,
    paymentStatusOptions,
    isLoading:
      countries.isLoading ||
      currencies.isLoading ||
      paymentTerms.isLoading ||
      vendorStatuses.isLoading ||
      paymentStatuses.isLoading,
  };
};

export default useApLookups;
