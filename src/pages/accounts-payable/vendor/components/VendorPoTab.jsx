import { useState } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Eye,
  Download,
  Upload,
} from "lucide-react";

import Button from "../../../../components/Button/Button";
import Modal from "../../../../components/Modal/modal";
import GenericTable from "../../../../components/Table/table";
import StatusBadge from "../../../../components/status/statusbadge";

import {
  getApiErrorMessage,
} from "../../utils/apiError";

import {
  formatDate,
  formatCurrency,
} from "../../utils/formatters";

import {
  getDocumentAvailability,
  openBlobInNewTab,
  downloadBlob,
} from "../../utils/documentUpload";

import {
  useCurrencies,
  usePoStatuses,
} from "../../hooks/useApLookups";

import {
  usePurchaseOrders,
} from "../../purchase-order/hooks/usePurchaseOrders";

import {
  useCreatePurchaseOrder,
  useUploadPurchaseOrderDocument,
} from "../../purchase-order/hooks/usePurchaseOrderMutations";

import purchaseOrderService from "../../purchase-order/services/purchaseOrderService";

import VendorPoForm, {
  DEFAULT_PO_FORM,
  DEFAULT_PO_LINE,
} from "./VendorPoForm";

import VendorDocumentUploadModal from "./VendorDocumentUploadModal";
import VendorPoDetailModal from "./VendorPoDetailModal";

const toNumber = (value) => {
  const num = Number(value);

  return Number.isFinite(num)
    ? num
    : 0;
};

const computeLineAmount = (
  quantity,
  unitPrice
) => {
  const amount =
    toNumber(quantity) *
    toNumber(unitPrice);

  return Number.isFinite(amount)
    ? amount.toFixed(2)
    : "0";
};

const validatePoForm = (
  formData,
  lines
) => {
  const errors = {};

  if (!formData.po_number?.trim()) {
    errors.po_number =
      "This field is required.";
  }

  const lineErrors =
    lines.map((line) => {
      const lineError = {};

      if (!line.description?.trim()) {
        lineError.description =
          "Required.";
      }

      if (
        !(toNumber(line.quantity) > 0)
      ) {
        lineError.quantity =
          "Must be greater than 0.";
      }

      if (
        toNumber(line.unit_price) < 0
      ) {
        lineError.unit_price =
          "Must be 0 or more.";
      }

      if (
        toNumber(line.tax_amount) < 0
      ) {
        lineError.tax_amount =
          "Must be 0 or more.";
      }

      return lineError;
    });

  return {
    errors,
    lineErrors,
  };
};

const buildPoPayload = (
  formData,
  lines,
  vendorId,
  totals
) => ({
  po_number:
    formData.po_number.trim(),

  // Keep vendor_id for PO creation.
  vendor_id: Number(vendorId),

  po_date:
    formData.po_date || null,

  expected_delivery_date:
    formData.expected_delivery_date ||
    null,

  currency_id:
    formData.currency_id
      ? Number(
          formData.currency_id
        )
      : null,

  subtotal:
    totals.subtotal,

  tax_amount:
    totals.taxAmount,

  total_amount:
    totals.totalAmount,

  lines: lines.map((line) => ({
    item_code:
      line.item_code?.trim() ||
      null,

    description:
      line.description.trim(),

    quantity:
      toNumber(
        line.quantity
      ),

    unit_price:
      toNumber(
        line.unit_price
      ),

    tax_amount:
      toNumber(
        line.tax_amount
      ),

    line_amount:
      toNumber(
        line.line_amount
      ),
  })),
});

/**
 * Vendor Detail > PO Tab
 *
 * vendorId:
 * Used for creating PO and upload mutation.
 *
 * poId:
 * Used for fetching PO data.
 */
const VendorPoTab = ({
  vendorId,
  poId,
  vendorName,
}) => {
  const [
    isModalOpen,
    setIsModalOpen,
  ] = useState(false);

  const [
    formData,
    setFormData,
  ] = useState(
    DEFAULT_PO_FORM
  );

  const [
    lines,
    setLines,
  ] = useState([
    {
      ...DEFAULT_PO_LINE,
    },
  ]);

  const [
    errors,
    setErrors,
  ] = useState({});

  const [
    lineErrors,
    setLineErrors,
  ] = useState([]);

  const [
    uploadTarget,
    setUploadTarget,
  ] = useState(null);

  const [
    uploadedDocs,
    setUploadedDocs,
  ] = useState({});

  const [
    viewingPoId,
    setViewingPoId,
  ] = useState(null);

  const [
    downloadingPoId,
    setDownloadingPoId,
  ] = useState(null);

  const [
    detailPo,
    setDetailPo,
  ] = useState(null);

  /*
   * Fetch PO data using poId.
   *
   * This will result in:
   *
   * /apm/purchase-order?po_id=15
   */
  const {
    purchaseOrders,
    isLoading,
    isError,
    error,
  } = usePurchaseOrders(
    poId
  );

  const {
    data: currencies = [],
  } = useCurrencies();

  const {
    data: poStatuses = [],
  } = usePoStatuses();

  /*
   * Keep vendorId for creation.
   */
  const createMutation =
    useCreatePurchaseOrder(
      vendorId
    );

  /*
   * Keep vendorId for upload mutation.
   */
  const uploadMutation =
    useUploadPurchaseOrderDocument(
      vendorId
    );

  const currencyOptions =
    currencies.map((c) => ({
      value: c.currency_id,
      label: `${c.currency_code} — ${c.currency_name}`,
    }));

  const openAdd = () => {
    setFormData(
      DEFAULT_PO_FORM
    );

    setLines([
      {
        ...DEFAULT_PO_LINE,
      },
    ]);

    setErrors({});

    setLineErrors([]);

    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    const {
      name,
      value,
    } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handleLineChange = (
    index,
    field,
    value
  ) => {
    setLines((prev) =>
      prev.map(
        (line, i) => {
          if (i !== index) {
            return line;
          }

          const nextLine = {
            ...line,
            [field]: value,
          };

          if (
            field === "quantity" ||
            field === "unit_price"
          ) {
            nextLine.line_amount =
              computeLineAmount(
                nextLine.quantity,
                nextLine.unit_price
              );
          }

          return nextLine;
        }
      )
    );
  };

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        ...DEFAULT_PO_LINE,
      },
    ]);
  };

  const handleRemoveLine = (
    index
  ) => {
    setLines((prev) =>
      prev.filter(
        (_, i) => i !== index
      )
    );
  };

  const totals = lines.reduce(
    (acc, line) => ({
      subtotal:
        acc.subtotal +
        toNumber(
          line.line_amount
        ),

      taxAmount:
        acc.taxAmount +
        toNumber(
          line.tax_amount
        ),
    }),
    {
      subtotal: 0,
      taxAmount: 0,
    }
  );

  totals.totalAmount =
    totals.subtotal +
    totals.taxAmount;

  const selectedCurrencySymbol =
    currencies.find(
      (c) =>
        c.currency_id ===
        Number(
          formData.currency_id
        )
    )?.symbol || "₹";

  const handleSubmit =
    async () => {
      const {
        errors: nextErrors,
        lineErrors:
          nextLineErrors,
      } = validatePoForm(
        formData,
        lines
      );

      setErrors(
        nextErrors
      );

      setLineErrors(
        nextLineErrors
      );

      const hasLineErrors =
        nextLineErrors.some(
          (lineError) =>
            Object.keys(
              lineError
            ).length > 0
        );

      if (
        Object.keys(
          nextErrors
        ).length > 0 ||
        hasLineErrors
      ) {
        return;
      }

      /*
       * PO creation uses vendorId.
       */
      const payload =
        buildPoPayload(
          formData,
          lines,
          vendorId,
          totals
        );

      try {
        await createMutation.mutateAsync(
          payload
        );

        toast.success(
          "Purchase order created."
        );

        setIsModalOpen(false);
      } catch (err) {
        toast.error(
          getApiErrorMessage(
            err,
            "Failed to create purchase order."
          )
        );
      }
    };

  const openUploadModal = (
    po
  ) => {
    setUploadTarget(po);
  };

  const closeUploadModal =
    () => {
      if (
        uploadMutation.isPending
      ) {
        return;
      }

      setUploadTarget(null);
    };

  const handleUploadSubmit =
    async (file) => {
      const poId =
        uploadTarget.po_id;

      try {
        await uploadMutation.mutateAsync(
          {
            poId,
            file,
          }
        );

        setUploadedDocs(
          (prev) => ({
            ...prev,
            [poId]: {
              fileName:
                file.name,
            },
          })
        );

        toast.success(
          "PO document uploaded successfully."
        );

        setUploadTarget(null);
      } catch (err) {
        toast.error(
          getApiErrorMessage(
            err,
            "Failed to upload PO document."
          )
        );

        throw err;
      }
    };

  const handleView =
    async (po) => {
      setViewingPoId(
        po.po_id
      );

      try {
        const {
          blob,
          contentType,
        } =
          await purchaseOrderService.viewPurchaseOrderDocument(
            po.po_id
          );

        openBlobInNewTab(
          new Blob(
            [blob],
            {
              type:
                contentType,
            }
          )
        );
      } catch (err) {
        toast.error(
          getApiErrorMessage(
            err,
            "Could not load the PO document."
          )
        );
      } finally {
        setViewingPoId(null);
      }
    };

  const handleDownload =
    async (po) => {
      setDownloadingPoId(
        po.po_id
      );

      try {
        const {
          blob,
          contentType,
          fileName,
        } =
          await purchaseOrderService.downloadPurchaseOrderDocument(
            po.po_id
          );

        downloadBlob(
          new Blob(
            [blob],
            {
              type:
                contentType,
            }
          ),
          fileName ||
            `${
              po.po_number ||
              "purchase-order"
            }.pdf`
        );
      } catch (err) {
        toast.error(
          getApiErrorMessage(
            err,
            "Could not download the PO document."
          )
        );
      } finally {
        setDownloadingPoId(
          null
        );
      }
    };

  const rows =
    purchaseOrders.map(
      (po) => {
        const status =
          poStatuses.find(
            (s) =>
              s.status_id ===
              po.status_id
          );

        const currency =
          currencies.find(
            (c) =>
              c.currency_id ===
              po.currency_id
          );

        const symbol =
          currency?.symbol ||
          "₹";

        const docInfo =
          getDocumentAvailability(
            po,
            uploadedDocs[
              po.po_id
            ]
          );

        return {
          poNumber: (
            <button
              type="button"
              onClick={() =>
                setDetailPo(
                  po
                )
              }
              className="font-medium text-[#0A0082] hover:underline"
            >
              {po.po_number}
            </button>
          ),

          poDate:
            formatDate(
              po.po_date
            ),

          expectedDelivery:
            formatDate(
              po.expected_delivery_date
            ),

          currency:
            currency?.currency_code ||
            "—",

          status: status ? (
            <StatusBadge
              label={
                status.status_name
              }
              size="sm"
            />
          ) : (
            "—"
          ),

          subtotal:
            formatCurrency(
              Number(
                po.subtotal
              ) || 0,
              symbol
            ),

          tax:
            formatCurrency(
              Number(
                po.tax_amount
              ) || 0,
              symbol
            ),

          total:
            formatCurrency(
              Number(
                po.total_amount
              ) || 0,
              symbol
            ),

          document:
            docInfo.available ? (
              <div
                className="flex items-center justify-center gap-1.5"
                title={
                  docInfo.fileName ||
                  undefined
                }
              >
                <Button
                  size="small"
                  variant="outline"
                  onClick={() =>
                    handleView(
                      po
                    )
                  }
                  loading={
                    viewingPoId ===
                    po.po_id
                  }
                  aria-label="View PO document"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>

                <Button
                  size="small"
                  variant="outline"
                  onClick={() =>
                    handleDownload(
                      po
                    )
                  }
                  loading={
                    downloadingPoId ===
                    po.po_id
                  }
                  aria-label="Download PO document"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="small"
                variant="outline"
                onClick={() =>
                  openUploadModal(
                    po
                  )
                }
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
            ),
        };
      }
    );

  if (isError) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
        {getApiErrorMessage(
          error,
          "Unable to load purchase orders right now."
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          onClick={openAdd}
        >
          <Plus className="h-4 w-4" />
          Add PO
        </Button>
      </div>

      {!isLoading &&
      purchaseOrders.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          No purchase orders found.
        </div>
      ) : (
        <GenericTable
          headers={[
            "PO Number",
            "PO Date",
            "Expected Delivery",
            "Currency",
            "Status",
            "Subtotal",
            "Tax",
            "Total",
            "Document",
          ]}
          columns={[
            "poNumber",
            "poDate",
            "expectedDelivery",
            "currency",
            "status",
            "subtotal",
            "tax",
            "total",
            "document",
          ]}
          rows={rows}
          loading={isLoading}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() =>
          setIsModalOpen(false)
        }
        title="Add PO"
        size="3xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setIsModalOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              onClick={
                handleSubmit
              }
              loading={
                createMutation.isPending
              }
              loadingText="Saving..."
            >
              Save
            </Button>
          </div>
        }
      >
        <VendorPoForm
          vendorName={
            vendorName
          }
          formData={formData}
          errors={errors}
          onChange={
            handleChange
          }
          currencyOptions={
            currencyOptions
          }
          lines={lines}
          lineErrors={
            lineErrors
          }
          onLineChange={
            handleLineChange
          }
          onAddLine={
            handleAddLine
          }
          onRemoveLine={
            handleRemoveLine
          }
          totals={totals}
          currencySymbol={
            selectedCurrencySymbol
          }
        />
      </Modal>

      <VendorDocumentUploadModal
        isOpen={
          !!uploadTarget
        }
        onClose={
          closeUploadModal
        }
        title={
          uploadTarget
            ? `Upload Document — PO ${uploadTarget.po_number}`
            : "Upload Document"
        }
        onUpload={
          handleUploadSubmit
        }
        isUploading={
          uploadMutation.isPending
        }
      />

      <VendorPoDetailModal
        po={detailPo}
        isOpen={
          !!detailPo
        }
        onClose={() =>
          setDetailPo(null)
        }
        vendorName={
          vendorName
        }
        currencies={
          currencies
        }
        poStatuses={
          poStatuses
        }
        uploadedDocs={
          uploadedDocs
        }
        onView={
          handleView
        }
        onDownload={
          handleDownload
        }
        onUpload={
          openUploadModal
        }
        viewingPoId={
          viewingPoId
        }
        downloadingPoId={
          downloadingPoId
        }
      />
    </div>
  );
};

export default VendorPoTab;