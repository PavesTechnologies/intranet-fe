import { Eye, Download, Upload } from "lucide-react";
import Modal from "../../../../components/Modal/modal";
import Button from "../../../../components/Button/Button";
import GenericTable from "../../../../components/Table/table";
import StatusBadge from "../../../../components/status/statusbadge";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { Fonts } from "../../../../components/Fonts/Fonts";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatDate, formatCurrency } from "../../utils/formatters";
import { getDocumentAvailability } from "../../utils/documentUpload";
import { usePurchaseOrderDetail } from "../../purchase-order/hooks/usePurchaseOrders";

const DetailField = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <span className={Fonts.label}>{label}</span>
    <span className="text-sm text-gray-800">{value ?? "—"}</span>
  </div>
);

/**
 * Full PO detail, opened from a PO row in the Vendor Detail > PO tab. Fetches
 * GET /apm/purchase-order/{po_id} — the list endpoint doesn't return line items.
 * @param {object|null} po - the selected PO's list row (carries po_id/po_number for the query and
 *   for the document actions, which reuse VendorPoTab's existing handlers)
 */
const VendorPoDetailModal = ({
  po,
  isOpen,
  onClose,
  vendorName,
  currencies = [],
  poStatuses = [],
  uploadedDocs = {},
  onView,
  onDownload,
  onUpload,
  viewingPoId,
  downloadingPoId,
}) => {
  const poId = po?.po_id ?? null;
  const { purchaseOrder, poLines, isLoading, isError, error } = usePurchaseOrderDetail(poId);

  const currency = currencies.find((c) => c.currency_id === purchaseOrder?.currency_id);
  const status = poStatuses.find((s) => s.status_id === purchaseOrder?.status_id);
  const symbol = currency?.symbol || "₹";
  const docInfo = getDocumentAvailability(purchaseOrder || po || {}, uploadedDocs[poId]);

  const lineRows = poLines.map((line) => ({
    itemCode: line.item_code || "—",
    description: line.description,
    quantity: line.quantity,
    unitPrice: formatCurrency(Number(line.unit_price) || 0, symbol),
    taxAmount: formatCurrency(Number(line.tax_amount) || 0, symbol),
    lineAmount: formatCurrency(Number(line.line_amount) || 0, symbol),
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={po ? `Purchase Order — ${po.po_number}` : "Purchase Order"} size="4xl">
      {isLoading ? (
        <LoadingSpinner text="Loading PO details..." />
      ) : isError ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
          {getApiErrorMessage(error, "Unable to load this purchase order right now.")}
        </div>
      ) : purchaseOrder ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-3">
            <DetailField label="PO Number" value={purchaseOrder.po_number} />
            <DetailField label="Vendor" value={vendorName} />
            <DetailField label="Status" value={status ? <StatusBadge label={status.status_name} size="sm" /> : "—"} />
            <DetailField label="PO Date" value={formatDate(purchaseOrder.po_date)} />
            <DetailField label="Expected Delivery" value={formatDate(purchaseOrder.expected_delivery_date)} />
            <DetailField
              label="Currency"
              value={currency ? `${currency.currency_code} — ${currency.currency_name}` : "—"}
            />
          </div>

          <div>
            <span className={Fonts.label}>Line Items</span>
            <div className="mt-2 overflow-x-auto">
              <GenericTable
                headers={["Item Code", "Description", "Quantity", "Unit Price", "Tax Amount", "Line Amount"]}
                columns={["itemCode", "description", "quantity", "unitPrice", "taxAmount", "lineAmount"]}
                rows={lineRows}
              />
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 border-t border-gray-100 pt-3 text-sm">
            <div className="flex w-48 justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-800">
                {formatCurrency(Number(purchaseOrder.subtotal) || 0, symbol)}
              </span>
            </div>
            <div className="flex w-48 justify-between">
              <span className="text-gray-500">Tax</span>
              <span className="font-medium text-gray-800">
                {formatCurrency(Number(purchaseOrder.tax_amount) || 0, symbol)}
              </span>
            </div>
            <div className="flex w-48 justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(Number(purchaseOrder.total_amount) || 0, symbol)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <span className={Fonts.label}>Document</span>
            {docInfo.available ? (
              <div className="flex items-center gap-2" title={docInfo.fileName || undefined}>
                <Button size="small" variant="outline" onClick={() => onView(po)} loading={viewingPoId === poId}>
                  <Eye className="h-3.5 w-3.5" /> View
                </Button>
                <Button size="small" variant="outline" onClick={() => onDownload(po)} loading={downloadingPoId === poId}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            ) : (
              <Button size="small" variant="outline" onClick={() => onUpload(po)}>
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default VendorPoDetailModal;
