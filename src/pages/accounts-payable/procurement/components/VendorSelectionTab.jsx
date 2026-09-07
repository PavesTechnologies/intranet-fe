import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { AlertTriangle, Eye, Download } from "lucide-react";
import Button from "../../../../components/Button/Button";
import GenericTable from "../../../../components/Table/table";
import FormSelect from "../../../../components/forms/FormSelect";
import FormTextArea from "../../../../components/forms/FormTextArea";
import Modal from "../../../../components/Modal/modal";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import StatusBadge from "../../../../components/status/statusbadge";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { AP_ROUTES } from "../../constants/routes";
import { useApPermissions } from "../../hooks/useApPermissions";
import { usePrStatuses, useQuotationStatuses, useRfqStatuses } from "../../hooks/useApLookups";
import { useAllPurchaseRequisitions } from "../hooks/usePurchaseRequisitions";
import { useQuotationsForPr } from "../hooks/useQuotations";
import { useRfqsForPr } from "../hooks/useRfqs";
import { useSelectVendor, useGeneratePurchaseOrder } from "../hooks/usePurchaseRequisitionMutations";
import useVendorOptions from "../hooks/useVendorOptions";
import procurementService from "../services/procurementService";
import { VENDOR_SELECTION_ELIGIBLE_PR_STATUS } from "../constants/procurementStatus";
import EmptyState from "./EmptyState";

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

export default function VendorSelectionTab() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canSelectVendor, canGeneratePO } = useApPermissions();

  const [selectedPrId, setSelectedPrId] = useState(searchParams.get("prId") || "");
  const [confirmTarget, setConfirmTarget] = useState(null); // quotation being selected
  const [selectionReason, setSelectionReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [docLoadingId, setDocLoadingId] = useState(null);

  const { data: allPrs = [] } = useAllPurchaseRequisitions();
  const { data: prStatuses = [] } = usePrStatuses();
  const { data: quotationStatuses = [] } = useQuotationStatuses();
  const { data: rfqStatuses = [] } = useRfqStatuses();
  const { vendorNameById } = useVendorOptions();

  const prStatusCodeById = new Map(prStatuses.map((s) => [s.status_id, s.status_code]));
  const quotationStatusCodeById = new Map(quotationStatuses.map((s) => [s.status_id, s.status_code]));
  const quotationStatusNameById = new Map(quotationStatuses.map((s) => [s.status_id, s.status_name]));
  const rfqStatusCodeById = new Map(rfqStatuses.map((s) => [s.status_id, s.status_code]));

  const eligiblePrs = useMemo(
    () => allPrs.filter((pr) => prStatusCodeById.get(pr.status_id) === VENDOR_SELECTION_ELIGIBLE_PR_STATUS),
    [allPrs, prStatusCodeById],
  );

  const selectedPr = allPrs.find((pr) => String(pr.id) === String(selectedPrId));

  const { data: quotations = [], isLoading, isError, error } = useQuotationsForPr(selectedPrId || undefined);
  const { data: rfqs = [] } = useRfqsForPr(selectedPrId || undefined);
  const rfqStatusCodeByRfqId = new Map(rfqs.map((rfq) => [rfq.id, rfqStatusCodeById.get(rfq.status_id)]));
  const rfqNumberById = new Map(rfqs.map((rfq) => [rfq.id, rfq.rfq_number]));
  const rfqStatusNameById = new Map(rfqStatuses.map((s) => [s.status_id, s.status_name]));
  const rfqStatusIdByRfqId = new Map(rfqs.map((rfq) => [rfq.id, rfq.status_id]));

  const selectVendor = useSelectVendor(selectedPrId);
  const generatePo = useGeneratePurchaseOrder(selectedPrId);

  const prOptions = [
    { value: "", label: "Select a purchase requisition" },
    ...eligiblePrs.map((pr) => ({ value: String(pr.id), label: pr.pr_number })),
  ];

  const isEligible = selectedPr && prStatusCodeById.get(selectedPr.status_id) === VENDOR_SELECTION_ELIGIBLE_PR_STATUS;
  const hasSelection = selectedPr?.selected_vendor_id != null && selectedPr?.selected_quotation_id != null;

  const handleSelectConfirm = async () => {
    if (!confirmTarget || !selectionReason.trim()) {
      setReasonTouched(true);
      return;
    }
    try {
      // quotation_id identifies the winning quotation; select-vendor derives the vendor from it
      // server-side — never send vendor_id here, the two ids are not interchangeable.
      await selectVendor.mutateAsync({ quotationId: confirmTarget.id, reason: selectionReason.trim() });
      toast.success("Vendor selected for this requisition.");
      setConfirmTarget(null);
      setSelectionReason("");
      setReasonTouched(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not select this vendor."));
    }
  };

  const handleGeneratePo = async () => {
    try {
      const result = await generatePo.mutateAsync();
      toast.success("Purchase order generated.");
      navigate(AP_ROUTES.PROCUREMENT_PO_DETAIL(result.po_id));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not generate the purchase order."));
    }
  };

  const handleView = async (quotationId) => {
    setDocLoadingId(quotationId);
    try {
      const { blob, contentType } = await procurementService.viewQuotationDocument(quotationId);
      openBlob(blob, contentType, "view");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not load the quotation document."));
    } finally {
      setDocLoadingId(null);
    }
  };

  const handleDownload = async (quotationId) => {
    setDocLoadingId(quotationId);
    try {
      const { blob, contentType } = await procurementService.downloadQuotationDocument(quotationId);
      openBlob(blob, contentType, "download");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not download the quotation document."));
    } finally {
      setDocLoadingId(null);
    }
  };

  const headers = [
    "Vendor",
    "RFQ",
    "Quotation No.",
    "Amount",
    "Delivery Days",
    "Payment Terms",
    "Valid Until",
    "Quotation Status",
    "Document",
    "Action",
  ];
  const columns = [
    "vendor",
    "rfq",
    "quotationNumber",
    "amount",
    "deliveryDays",
    "paymentTerms",
    "validUntil",
    "status",
    "document",
    "action",
  ];

  const rows = quotations.map((q) => {
    const statusCode = quotationStatusCodeById.get(q.status_id);
    const isThisSelected = selectedPr?.selected_quotation_id === q.id;
    // A quotation sourced through an RFQ can only be selected once that RFQ is CLOSED
    // (ProcurementService.select_vendor); a manually-recorded quotation has no such gate.
    const rfqClosedOrNotApplicable = q.rfq_id == null || rfqStatusCodeByRfqId.get(q.rfq_id) === "CLOSED";
    const canSelectThis = canSelectVendor && isEligible && statusCode === "RECEIVED" && !hasSelection && rfqClosedOrNotApplicable;
    const blockedByOpenRfq = statusCode === "RECEIVED" && !hasSelection && !rfqClosedOrNotApplicable;

    return {
      vendor: vendorNameById.get(q.vendor_id) || `Vendor #${q.vendor_id}`,
      rfq:
        q.rfq_id != null ? (
          <div className="leading-tight">
            <p className="font-mono text-xs font-semibold text-gray-700">{rfqNumberById.get(q.rfq_id) || `#${q.rfq_id}`}</p>
            <p className="text-[11px] text-gray-400">{rfqStatusNameById.get(rfqStatusIdByRfqId.get(q.rfq_id)) || ""}</p>
          </div>
        ) : (
          <span className="text-gray-400">Manual</span>
        ),
      quotationNumber: q.quotation_number || "—",
      amount: q.total_amount != null ? formatCurrency(Number(q.total_amount)) : "—",
      deliveryDays: q.delivery_days != null ? q.delivery_days : "—",
      paymentTerms: q.payment_terms || "—",
      validUntil: formatDate(q.valid_until),
      status: <StatusBadge label={quotationStatusNameById.get(q.status_id) || "Unknown"} size="sm" />,
      document: (
        <div className="flex items-center gap-1 justify-center">
          <Button
            type="button"
            variant="link"
            size="icon"
            title="View Document"
            className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 rounded-md"
            onClick={() => handleView(q.id)}
            disabled={docLoadingId === q.id}
          >
            <Eye size={16} />
          </Button>
          <Button
            type="button"
            variant="link"
            size="icon"
            title="Download Document"
            className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-50 rounded-md"
            onClick={() => handleDownload(q.id)}
            disabled={docLoadingId === q.id}
          >
            <Download size={16} />
          </Button>
        </div>
      ),
      action:
        isThisSelected ? (
          <span className="text-xs font-semibold text-emerald-700">Selected</span>
        ) : canSelectThis ? (
          <Button variant="outline" size="small" onClick={() => setConfirmTarget(q)}>
            Select
          </Button>
        ) : blockedByOpenRfq ? (
          <span className="text-xs text-amber-600" title="Close the RFQ before selecting this quotation.">
            RFQ not closed
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    };
  });

  return (
    <div className="space-y-4">
      <div className="w-full sm:w-80">
        <FormSelect
          label="Purchase Requisition"
          name="prId"
          value={selectedPrId}
          onChange={(e) => setSelectedPrId(e.target.value)}
          options={prOptions}
        />
      </div>

      {!selectedPrId ? (
        <EmptyState
          title="Select a requisition to compare quotations"
          description="Only requisitions currently in Vendor Selection are eligible."
        />
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getApiErrorMessage(error, "Failed to load quotations.")}
        </div>
      ) : isLoading ? (
        <LoadingSpinner text="Loading quotations..." />
      ) : quotations.length === 0 ? (
        <EmptyState
          title="No quotations to compare yet"
          description="Quotations recorded against this requisition's RFQs will appear here for comparison."
        />
      ) : (
        <div className="w-full overflow-x-auto rounded-lg">
          <GenericTable headers={headers} rows={rows} columns={columns} />
        </div>
      )}

      {hasSelection && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-emerald-700">Vendor selected.</span>
            {selectedPr?.selection_reason && (
              <span className="ml-2 text-gray-500">Reason: {selectedPr.selection_reason}</span>
            )}
          </div>
          {canGeneratePO && (
            <Button variant="primary" onClick={handleGeneratePo} loading={generatePo.isPending} loadingText="Generating...">
              Generate Purchase Order
            </Button>
          )}
        </div>
      )}

      <Modal
        isOpen={!!confirmTarget}
        onClose={() => {
          setConfirmTarget(null);
          setSelectionReason("");
          setReasonTouched(false);
        }}
        title="Select Vendor"
        size="sm"
        closeOnBackdrop={false}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmTarget(null);
                setSelectionReason("");
                setReasonTouched(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSelectConfirm} loading={selectVendor.isPending}>
              Confirm Selection
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-gray-700">
          Select <span className="font-semibold">{confirmTarget ? vendorNameById.get(confirmTarget.vendor_id) : ""}</span> as
          the vendor for <span className="font-semibold">{selectedPr?.pr_number || "this requisition"}</span>? Other
          received quotations will be marked rejected.
        </p>
        <p className="mb-3 flex items-start gap-2 text-sm text-gray-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />A selection reason is required.
        </p>
        <FormTextArea
          label="Selection reason"
          name="selectionReason"
          value={selectionReason}
          onChange={(e) => setSelectionReason(e.target.value)}
          placeholder="Why was this vendor chosen?"
          rows={3}
          required
        />
        {reasonTouched && !selectionReason.trim() && (
          <p className="mt-1 text-xs text-red-500">A selection reason is required.</p>
        )}
      </Modal>
    </div>
  );
}
