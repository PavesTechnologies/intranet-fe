import { useQuery } from "@tanstack/react-query";
import purchaseCategoryService from "../services/purchaseCategoryService";

export const PURCHASE_CATEGORIES_KEY = ["accountsPayable", "systemConfig", "purchaseCategories"];
export const PURCHASE_CATEGORIES_BY_DEPARTMENT_KEY = (departmentId) => [
  ...PURCHASE_CATEGORIES_KEY,
  "byDepartment",
  departmentId,
];

/** All purchase categories, unfiltered — used for label lookups and the Departments & Categories hierarchy. */
export const usePurchaseCategories = () =>
  useQuery({
    queryKey: PURCHASE_CATEGORIES_KEY,
    queryFn: () => purchaseCategoryService.getPurchaseCategories(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });

/**
 * Purchase categories scoped to one department, via the existing department_id filter on
 * GET /master/purchase-categories — used by the PR form's dependent Category dropdown so it
 * never has to fetch-all-then-filter. Disabled until a department is chosen; the query key
 * includes departmentId so switching departments never serves stale categories from cache.
 */
export const usePurchaseCategoriesByDepartment = (departmentId) =>
  useQuery({
    queryKey: PURCHASE_CATEGORIES_BY_DEPARTMENT_KEY(departmentId),
    queryFn: () => purchaseCategoryService.getPurchaseCategories({ departmentId }),
    enabled: !!departmentId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });

export default usePurchaseCategories;
