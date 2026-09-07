import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/Button/Button";
import GenericTable from "../../../../components/Table/table";
import FormSelect from "../../../../components/forms/FormSelect";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import StatusBadge from "../../../../components/status/statusbadge";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { AP_ROUTES } from "../../constants/routes";
import { usePoStatuses } from "../../hooks/useApLookups";
import { usePurchaseOrderList } from "../../purchase-order/hooks/usePurchaseOrders";
import { useAllPurchaseRequisitions } from "../hooks/usePurchaseRequisitions";
import useVendorOptions from "../hooks/useVendorOptions";
import EmptyState from "./EmptyState";

const ALL = "";

/**
 * Read-only — purchase orders are only ever created here via a PR's "Generate Purchase
 * Order" action (Backend/Business_Layer/services/procurement_service.py), so there is no
 * manual create form on this tab.
 */
export default function PurchaseOrdersTab() {
  const navigate = useNavigate();
  const [statusId, setStatusId] = useState(ALL);

  const { purchaseOrders, isLoading, isError, error } = usePurchaseOrderList({
    statusId: statusId || undefined,
    limit: 200,
  });
  const { data: poStatuses = [] } = usePoStatuses();
  const { data: allPrs = [] } = useAllPurchaseRequisitions();
  const { vendorNameById } = useVendorOptions();

  const statusNameById = new Map(poStatuses.map((s) => [s.status_id, s.status_name]));
  const prNumberById = new Map(allPrs.map((pr) => [pr.id, pr.pr_number]));

  const statusOptions = [
    { value: ALL, label: "All Statuses" },
    ...poStatuses.map((s) => ({ value: s.status_id, label: s.status_name })),
  ];

  const headers = ["PO Number", "PR Number", "Vendor", "PO Date", "PO Amount", "PO Status", "Actions"];
  const columns = ["poNumber", "prReference", "vendor", "poDate", "totalAmount", "status", "actions"];

  const rows = purchaseOrders.map((po) => ({
    poNumber: <span className="font-mono text-xs font-semibold text-gray-700">{po.po_number}</span>,
    prReference: prNumberById.get(po.pr_id) || `PR #${po.pr_id}`,
    vendor: vendorNameById.get(po.vendor_id) || `Vendor #${po.vendor_id}`,
    poDate: formatDate(po.po_date),
    totalAmount: formatCurrency(Number(po.total_amount) || 0),
    status: <StatusBadge label={statusNameById.get(po.status_id) || "Unknown"} size="sm" />,
    actions: (
      <Button variant="outline" size="small" onClick={() => navigate(AP_ROUTES.PROCUREMENT_PO_DETAIL(po.po_id))}>
        View
      </Button>
    ),
  }));

  return (
    <div className="space-y-4">
      <div className="w-full sm:w-56">
        <FormSelect
          label="Status"
          name="statusId"
          value={statusId}
          onChange={(e) => setStatusId(e.target.value)}
          options={statusOptions}
        />
      </div>

      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getApiErrorMessage(error, "Failed to load purchase orders.")}
        </div>
      ) : isLoading ? (
        <LoadingSpinner text="Loading purchase orders..." />
      ) : purchaseOrders.length === 0 ? (
        <EmptyState
          title="No purchase orders yet"
          description="A purchase order is created from a requisition once a vendor has been selected."
        />
      ) : (
        <div className="w-full overflow-x-auto rounded-lg">
          <GenericTable headers={headers} rows={rows} columns={columns} />
        </div>
      )}
    </div>
  );
}
