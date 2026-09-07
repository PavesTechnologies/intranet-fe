import { useQuery } from "@tanstack/react-query";
import vendorService from "../../vendor/services/vendorService";
import { useVendorStatuses } from "../../hooks/useApLookups";

export const VENDOR_OPTIONS_KEY = ["accountsPayable", "procurement", "vendorOptions"];

/**
 * Active vendors for the quotation vendor selector — the backend rejects a quotation for
 * any vendor whose status isn't ACTIVE (ProcurementService._require_active_vendor), so this
 * mirrors that rule client-side purely for a cleaner dropdown; the backend still enforces it.
 */
export const useVendorOptions = () => {
  const vendorsQuery = useQuery({
    queryKey: VENDOR_OPTIONS_KEY,
    queryFn: () => vendorService.getVendors({ limit: 200 }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
  const { data: vendorStatuses = [] } = useVendorStatuses();

  const activeStatusId = vendorStatuses.find((s) => s.status_code === "ACTIVE")?.status_id;
  const vendors = vendorsQuery.data || [];
  const activeVendors = activeStatusId ? vendors.filter((v) => v.status_id === activeStatusId) : vendors;
  const vendorNameById = new Map(vendors.map((v) => [v.vendor_id, v.vendor_name]));

  return {
    vendors,
    activeVendors,
    vendorNameById,
    vendorOptions: activeVendors.map((v) => ({ value: v.vendor_id, label: v.vendor_name })),
    isLoading: vendorsQuery.isLoading,
    isError: vendorsQuery.isError,
    error: vendorsQuery.error,
  };
};

export default useVendorOptions;
