import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, Eye, Download } from "lucide-react";
import PageHeader from "../../../../components/ui/PageHeader";
import Breadcrumb from "../../../../components/Breadcrumb/Breadcrumb";
import Button from "../../../../components/Button/Button";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import StatusBadge from "../../../../components/status/statusbadge";
import GenericTable from "../../../../components/Table/table";
import { PageCard, PageCardContent } from "../../../../components/Cards/PageCard";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { AP_ROUTES } from "../../constants/routes";
import { usePoStatuses } from "../../hooks/useApLookups";
import { usePurchaseOrderDetail } from "../../purchase-order/hooks/usePurchaseOrders";
import usePurchaseRequisitionDetail from "../hooks/usePurchaseRequisitionDetail";
import { useQuotationDetail } from "../hooks/useQuotations";
import useVendorOptions from "../hooks/useVendorOptions";
import procurementService from "../services/procurementService";

function openBlob(blob, contentType, mode) {
  const file = new Blob([blob], { type: contentType });
  const url = URL.createObjectURL(file);
  if (mode === "download") {
    const link = document.createElement("a");
    link.href = url;
    link.download = "quotation";
    link.click();
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{value ?? "—"}</p>
    </div>
  );
}

export default function PurchaseOrderDetailPage() {
  const { poId } = useParams();
  const navigate = useNavigate();

  const { purchaseOrder: po, isLoading, isError, error } = usePurchaseOrderDetail(poId);
  const { data: poStatuses = [] } = usePoStatuses();
  const { vendorNameById } = useVendorOptions();
  const { data: pr } = usePurchaseRequisitionDetail(po?.pr_id);
  const { data: selectedQuotation } = useQuotationDetail(pr?.selected_quotation_id);
  const [docLoading, setDocLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text="Loading purchase order..." />
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div className="p-6">
        <PageHeader title="Purchase Order" />
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-gray-700">Something went wrong</p>
          <p className="mt-1 text-sm text-gray-500">
            {getApiErrorMessage(error, "Unable to load this purchase order right now.")}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(AP_ROUTES.PROCUREMENT)}>
            Back to Procurement
          </Button>
        </div>
      </div>
    );
  }

  const statusName = poStatuses.find((s) => s.status_id === po.status_id)?.status_name || "Unknown";
  const lines = po.purchase_order_line || [];

  const handleViewQuotation = async () => {
    if (!selectedQuotation) return;
    setDocLoading(true);
    try {
      const { blob, contentType } = await procurementService.viewQuotationDocument(selectedQuotation.id);
      openBlob(blob, contentType, "view");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not load the quotation document."));
    } finally {
      setDocLoading(false);
    }
  };

  const handleDownloadQuotation = async () => {
    if (!selectedQuotation) return;
    setDocLoading(true);
    try {
      const { blob, contentType } = await procurementService.downloadQuotationDocument(selectedQuotation.id);
      openBlob(blob, contentType, "download");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not download the quotation document."));
    } finally {
      setDocLoading(false);
    }
  };

  const headers = ["Item", "Description", "UOM", "Qty", "Unit Price", "Tax", "Total"];
  const columns = ["item", "description", "uom", "qty", "unitPrice", "tax", "total"];
  const rows = lines.map((line) => ({
    item: <span className="font-medium text-gray-900">{line.item_name}</span>,
    description: line.description || "—",
    uom: line.uom || "—",
    qty: String(line.quantity),
    unitPrice: formatCurrency(Number(line.unit_price) || 0),
    tax: formatCurrency(Number(line.tax_amount) || 0),
    total: formatCurrency(Number(line.total_amount) || 0),
  }));

  return (
    <div className="p-6">
      <Breadcrumb items={[{ label: "Procurement", to: AP_ROUTES.PROCUREMENT }, { label: po.po_number }]} />

      <PageHeader
        title={po.po_number}
        subtitle={`Vendor: ${vendorNameById.get(po.vendor_id) || `#${po.vendor_id}`}`}
        actions={
          <Button variant="outline" onClick={() => navigate(AP_ROUTES.PROCUREMENT)}>
            <ArrowLeft className="h-4 w-4" /> Back to Procurement
          </Button>
        }
      />

      <PageCard className="mb-4">
        <PageCardContent>
          <div className="mb-4">
            <StatusBadge label={statusName} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field
              label="Purchase Requisition"
              value={
                <button
                  type="button"
                  className="text-[#0A0082] hover:underline"
                  onClick={() => navigate(AP_ROUTES.PROCUREMENT_PR_DETAIL(po.pr_id))}
                >
                  {pr?.pr_number || "View requisition"}
                </button>
              }
            />
            <Field label="PO Date" value={formatDate(po.po_date)} />
            <Field label="Expected Delivery" value={formatDate(po.expected_delivery_date)} />
            <Field label="Delivery Location" value={po.delivery_location} />
            <Field label="Payment Terms" value={po.payment_terms} />
            <Field label="Delivery Terms" value={po.delivery_terms} />
            <Field label="Subtotal" value={formatCurrency(Number(po.subtotal) || 0)} />
            <Field label="Tax Amount" value={formatCurrency(Number(po.tax_amount) || 0)} />
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4">
            <Field label="Total Amount" value={formatCurrency(Number(po.total_amount) || 0)} />
          </div>
        </PageCardContent>
      </PageCard>

      {selectedQuotation && (
        <PageCard className="mb-4">
          <PageCardContent>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Selected Quotation</h3>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Vendor" value={vendorNameById.get(selectedQuotation.vendor_id) || `#${selectedQuotation.vendor_id}`} />
                <Field label="Quotation No." value={selectedQuotation.quotation_number} />
                <Field
                  label="Quotation Amount"
                  value={selectedQuotation.total_amount != null ? formatCurrency(Number(selectedQuotation.total_amount)) : "—"}
                />
                <Field label="Valid Until" value={formatDate(selectedQuotation.valid_until)} />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="small" onClick={handleViewQuotation} loading={docLoading}>
                  <Eye size={14} /> View
                </Button>
                <Button variant="outline" size="small" onClick={handleDownloadQuotation} loading={docLoading}>
                  <Download size={14} /> Download
                </Button>
              </div>
            </div>
          </PageCardContent>
        </PageCard>
      )}

      <PageCard>
        <PageCardContent>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">PO Lines</h3>
          {lines.length === 0 ? (
            <p className="text-sm italic text-gray-500">No lines on this purchase order.</p>
          ) : (
            <div className="w-full overflow-x-auto rounded-lg">
              <GenericTable headers={headers} rows={rows} columns={columns} />
            </div>
          )}
        </PageCardContent>
      </PageCard>
    </div>
  );
}
