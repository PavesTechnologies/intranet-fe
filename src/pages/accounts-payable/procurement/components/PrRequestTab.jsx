import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import Button from "../../../../components/Button/Button";
import GenericTable from "../../../../components/Table/table";
import SearchInput from "../../../../components/filter/Searchbar";
import FormSelect from "../../../../components/forms/FormSelect";
import Pagination from "../../../../components/Pagination/pagination";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import StatusBadge from "../../../../components/status/statusbadge";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { AP_ROUTES } from "../../constants/routes";
import { useApPermissions } from "../../hooks/useApPermissions";
import { usePrStatuses } from "../../hooks/useApLookups";
import usePurchaseRequisitions from "../hooks/usePurchaseRequisitions";
import useDepartments from "../../system-configuration/hooks/useDepartments";
import usePurchaseCategories from "../../system-configuration/hooks/usePurchaseCategories";
import PrCreateModal from "./PrCreateModal";
import EmptyState from "./EmptyState";

const ALL = "";
const DEFAULT_FILTERS = { departmentId: ALL, purchaseCategoryId: ALL, statusId: ALL, search: "" };

export default function PrRequestTab() {
  const navigate = useNavigate();
  const { canCreatePR } = useApPermissions();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const {
    purchaseRequisitions,
    isLoading,
    isError,
    error,
    page,
    setPage,
    totalPages,
  } = usePurchaseRequisitions(filters);
  const { data: departments = [] } = useDepartments();
  const { data: categories = [] } = usePurchaseCategories();
  const { data: prStatuses = [] } = usePrStatuses();

  const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const statusNameById = new Map(prStatuses.map((s) => [s.status_id, s.status_name]));

  const departmentOptions = [
    { value: ALL, label: "All Departments" },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];
  const categoryOptions = [
    { value: ALL, label: "All Categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];
  const statusOptions = [
    { value: ALL, label: "All Statuses" },
    ...prStatuses.map((s) => ({ value: s.status_id, label: s.status_name })),
  ];

  const headers = ["PR Number", "Department", "Category", "Priority", "Estimated Total", "Status", "Created", "Actions"];
  const columns = ["prNumber", "department", "category", "priority", "estimatedTotal", "status", "created", "actions"];

  const rows = purchaseRequisitions.map((pr) => ({
    prNumber: <span className="font-mono text-xs font-semibold text-gray-700">{pr.pr_number}</span>,
    department: departmentNameById.get(pr.department_id) || "—",
    category: categoryNameById.get(pr.purchase_category_id) || "—",
    priority: pr.priority,
    estimatedTotal: formatCurrency(Number(pr.estimated_total) || 0),
    status: <StatusBadge label={statusNameById.get(pr.status_id) || "Unknown"} size="sm" />,
    created: formatDate(pr.created_at),
    actions: (
      <Button variant="outline" size="small" onClick={() => navigate(AP_ROUTES.PROCUREMENT_PR_DETAIL(pr.id))}>
        View
      </Button>
    ),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="w-full sm:w-52">
            <FormSelect
              label="Department"
              name="departmentId"
              value={filters.departmentId}
              onChange={(e) => setFilters((prev) => ({ ...prev, departmentId: e.target.value }))}
              options={departmentOptions}
            />
          </div>
          <div className="w-full sm:w-52">
            <FormSelect
              label="Purchase Category"
              name="purchaseCategoryId"
              value={filters.purchaseCategoryId}
              onChange={(e) => setFilters((prev) => ({ ...prev, purchaseCategoryId: e.target.value }))}
              options={categoryOptions}
            />
          </div>
          <div className="w-full sm:w-48">
            <FormSelect
              label="Status"
              name="statusId"
              value={filters.statusId}
              onChange={(e) => setFilters((prev) => ({ ...prev, statusId: e.target.value }))}
              options={statusOptions}
            />
          </div>
          <div className="w-full sm:w-64">
            <SearchInput
              onSearch={(search) => setFilters((prev) => ({ ...prev, search }))}
              placeholder="Search by PR number..."
            />
          </div>
        </div>

        {canCreatePR && (
          <Button variant="primary" onClick={() => setIsCreateOpen(true)} className="whitespace-nowrap">
            <Plus size={16} />
            New Requisition
          </Button>
        )}
      </div>

      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getApiErrorMessage(error, "Failed to load purchase requisitions.")}
        </div>
      ) : isLoading ? (
        <LoadingSpinner text="Loading purchase requisitions..." />
      ) : purchaseRequisitions.length === 0 ? (
        <EmptyState
          title="No purchase requisitions found"
          description={canCreatePR ? "Raise a new requisition to get started." : "No requisitions match the current filters."}
          action={
            canCreatePR ? (
              <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
                <Plus size={16} />
                New Requisition
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="w-full overflow-x-auto rounded-lg">
            <GenericTable headers={headers} rows={rows} columns={columns} />
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>
      )}

      <PrCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(id) => navigate(AP_ROUTES.PROCUREMENT_PR_DETAIL(id))}
      />
    </div>
  );
}
