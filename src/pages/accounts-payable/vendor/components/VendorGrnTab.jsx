import { useState } from "react";
import { toast } from "react-toastify";
import { Plus, Download, Upload } from "lucide-react";
import Button from "../../../../components/Button/Button";
import Modal from "../../../../components/Modal/modal";
import GenericTable from "../../../../components/Table/table";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatDate } from "../../utils/formatters";
import { getDocumentAvailability, downloadBlob } from "../../utils/documentUpload";
import { usePurchaseOrders, usePurchaseOrderDetail } from "../../purchase-order/hooks/usePurchaseOrders";
import { useGoodsReceipts } from "../../goods-receipt/hooks/useGoodsReceipts";
import { useCreateGoodsReceipt, useUploadGoodsReceiptDocument } from "../../goods-receipt/hooks/useGoodsReceiptMutations";
import goodsReceiptService from "../../goods-receipt/services/goodsReceiptService";
import VendorGrnForm, { DEFAULT_GRN_FORM, DEFAULT_GRN_LINE } from "./VendorGrnForm";
import VendorDocumentUploadModal from "./VendorDocumentUploadModal";

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const validateGrnForm = (lines) =>
  lines.map((line) => {
    const lineError = {};
    if (!line.description?.trim()) lineError.description = "Required.";
    if (!(toNumber(line.received_quantity) > 0)) lineError.received_quantity = "Must be greater than 0.";
    return lineError;
  });

const buildGrnPayload = (formData, lines, vendorId) => ({
  vendor_id: Number(vendorId),
  po_id: formData.po_id ? Number(formData.po_id) : null,
  grn_number: formData.grn_number?.trim() || null,
  receipt_date: formData.receipt_date || null,
  lines: lines.map((line) => ({
    po_line_id: line.po_line_id ? Number(line.po_line_id) : null,
    item_code: line.item_code?.trim() || null,
    description: line.description.trim(),
    received_quantity: toNumber(line.received_quantity),
  })),
});

/**
 * Goods Receipts for the selected vendor — Vendor Detail > GRN tab.
 * @param {string} vendorId
 * @param {string} vendorName
 */
const VendorGrnTab = ({ vendorId, vendorName }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_GRN_FORM);
  const [lines, setLines] = useState([{ ...DEFAULT_GRN_LINE }]);
  const [lineErrors, setLineErrors] = useState([]);

  // Upload GRN Document — an additional option alongside manual entry above, scoped to a single
  // existing GRN row (the upload API requires an existing grn_id).
  const [uploadTarget, setUploadTarget] = useState(null); // the GRN row being uploaded to, or null
  const [uploadedDocs, setUploadedDocs] = useState({}); // grn_id -> { fileName } — immediate feedback before refetch lands
  const [downloadingGrnId, setDownloadingGrnId] = useState(null);

  const { goodsReceipts, isLoading, isError, error } = useGoodsReceipts(vendorId);
  const { purchaseOrders } = usePurchaseOrders(vendorId);
  const { poLines } = usePurchaseOrderDetail(formData.po_id || null);
  const createMutation = useCreateGoodsReceipt(vendorId);
  const uploadMutation = useUploadGoodsReceiptDocument(vendorId);

  const hasPo = !!formData.po_id;

  const poOptions = purchaseOrders.map((po) => ({ value: po.po_id, label: po.po_number }));
  const poLineOptions = poLines.map((line) => ({
    value: line.po_line_id,
    label: `${line.item_code ? `${line.item_code} — ` : ""}${line.description} (Qty: ${line.quantity})`,
  }));

  const openAdd = () => {
    setFormData(DEFAULT_GRN_FORM);
    setLines([{ ...DEFAULT_GRN_LINE }]);
    setLineErrors([]);
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "po_id") {
      // A different PO has a different set of lines — drop stale po_line_id references.
      setLines((prev) => prev.map((line) => ({ ...line, po_line_id: "" })));
    }
  };

  const handleLineChange = (index, field, value) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const nextLine = { ...line, [field]: value };
        if (field === "po_line_id" && value) {
          const matchedPoLine = poLines.find((l) => String(l.po_line_id) === String(value));
          if (matchedPoLine) {
            nextLine.item_code = matchedPoLine.item_code || "";
            nextLine.description = matchedPoLine.description || "";
          }
        }
        return nextLine;
      }),
    );
  };

  const handleAddLine = () => setLines((prev) => [...prev, { ...DEFAULT_GRN_LINE }]);

  const handleRemoveLine = (index) => setLines((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    const nextLineErrors = validateGrnForm(lines);
    setLineErrors(nextLineErrors);
    if (nextLineErrors.some((le) => Object.keys(le).length > 0)) return;

    const payload = buildGrnPayload(formData, lines, vendorId);

    try {
      await createMutation.mutateAsync(payload);
      toast.success("Goods receipt created.");
      setIsModalOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to create goods receipt."));
    }
  };

  const openUploadModal = (grn) => setUploadTarget(grn);
  const closeUploadModal = () => {
    if (uploadMutation.isPending) return;
    setUploadTarget(null);
  };

  const handleUploadSubmit = async (file) => {
    const grnId = uploadTarget.grn_id;
    try {
      await uploadMutation.mutateAsync({ grnId, file });
      setUploadedDocs((prev) => ({ ...prev, [grnId]: { fileName: file.name } }));
      toast.success("GRN document uploaded successfully.");
      setUploadTarget(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to upload GRN document."));
      throw err; // keep the modal open with the file selected so the user can retry
    }
  };

  const handleDownload = async (grn) => {
    setDownloadingGrnId(grn.grn_id);
    try {
      const { blob, contentType, fileName } = await goodsReceiptService.downloadGoodsReceiptDocument(grn.grn_id);
      downloadBlob(new Blob([blob], { type: contentType }), fileName || `${grn.grn_number || "goods-receipt"}.pdf`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not download the GRN document."));
    } finally {
      setDownloadingGrnId(null);
    }
  };

  const rows = goodsReceipts.map((grn) => {
    const docInfo = getDocumentAvailability(grn, uploadedDocs[grn.grn_id]);
    return {
      grnNumber: grn.grn_number || "—",
      receiptDate: formatDate(grn.receipt_date),
      poReference: grn.po?.po_number || "—",
      lineCount: grn.goods_receipt_line?.length ?? 0,
      document: docInfo.available ? (
        <Button
          size="small"
          variant="outline"
          onClick={() => handleDownload(grn)}
          loading={downloadingGrnId === grn.grn_id}
          title={docInfo.fileName || undefined}
        >
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      ) : (
        <Button size="small" variant="outline" onClick={() => openUploadModal(grn)}>
          <Upload className="h-3.5 w-3.5" /> Upload
        </Button>
      ),
    };
  });

  if (isError) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
        {getApiErrorMessage(error, "Unable to load goods receipts right now.")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add GRN
        </Button>
      </div>

      {!isLoading && goodsReceipts.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          No goods receipts found for this vendor.
        </div>
      ) : (
        <GenericTable
          headers={["GRN Number", "Receipt Date", "PO Reference", "Line Count", "Document"]}
          columns={["grnNumber", "receiptDate", "poReference", "lineCount", "document"]}
          rows={rows}
          loading={isLoading}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add GRN"
        size="3xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={createMutation.isPending} loadingText="Saving...">
              Save
            </Button>
          </div>
        }
      >
        <VendorGrnForm
          vendorName={vendorName}
          formData={formData}
          onChange={handleChange}
          poOptions={poOptions}
          poLineOptions={poLineOptions}
          hasPo={hasPo}
          lines={lines}
          lineErrors={lineErrors}
          onLineChange={handleLineChange}
          onAddLine={handleAddLine}
          onRemoveLine={handleRemoveLine}
        />
      </Modal>

      <VendorDocumentUploadModal
        isOpen={!!uploadTarget}
        onClose={closeUploadModal}
        title={uploadTarget ? `Upload Document — GRN ${uploadTarget.grn_number || uploadTarget.grn_id}` : "Upload Document"}
        onUpload={handleUploadSubmit}
        isUploading={uploadMutation.isPending}
      />
    </div>
  );
};

export default VendorGrnTab;
