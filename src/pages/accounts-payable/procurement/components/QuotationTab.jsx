import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Plus, Eye, Download, Trash2 } from "lucide-react";
import Button from "../../../../components/Button/Button";
import GenericTable from "../../../../components/Table/table";
import FormSelect from "../../../../components/forms/FormSelect";
import ConfirmationModal from "../../../../components/confirmation_modal/ConfirmationModal";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import StatusBadge from "../../../../components/status/statusbadge";
import { PageCard, PageCardContent } from "../../../../components/Cards/PageCard";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { AP_ROUTES } from "../../constants/routes";
import { useApPermissions } from "../../hooks/useApPermissions";
import { usePrStatuses, useQuotationStatuses, useRfqStatuses } from "../../hooks/useApLookups";
import { useAllPurchaseRequisitions } from "../hooks/usePurchaseRequisitions";
import { useQuotationsForPr } from "../hooks/useQuotations";
import { useDeleteQuotation } from "../hooks/useQuotationMutations";
import { useRfqsForPr } from "../hooks/useRfqs";
import useDepartments from "../../system-configuration/hooks/useDepartments";
import usePurchaseCategories from "../../system-configuration/hooks/usePurchaseCategories";
import useVendorOptions from "../hooks/useVendorOptions";
import procurementService from "../services/procurementService";
import { QUOTATION_ELIGIBLE_PR_STATUSES } from "../constants/procurementStatus";
import QuotationFormModal from "./QuotationFormModal";
import RfqCreateModal from "./RfqCreateModal";
import EmptyState from "./EmptyState";

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{value ?? "—"}</p>
    </div>
  );
}

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

export default function QuotationTab() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // "Create RFQ" / "Add Quotation" are the sourcing decision — intentionally gated by
  // canCreateQuotation (QUOTATION_CREATE), not a PR permission. See useApPermissions.js.
  const { canCreateQuotation, canDeleteQuotation } = useApPermissions();

  const [selectedPrId, setSelectedPrId] = useState(searchParams.get("prId") || "");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRfqCreateOpen, setIsRfqCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [docLoadingId, setDocLoadingId] = useState(null);

  const { data: allPrs = [] } = useAllPurchaseRequisitions();
  const { data: prStatuses = [] } = usePrStatuses();
  const { data: quotationStatuses = [] } = useQuotationStatuses();
  const { data: rfqStatuses = [] } = useRfqStatuses();
  const { data: departments = [] } = useDepartments();
  const { data: categories = [] } = usePurchaseCategories();
  const { vendorNameById } = useVendorOptions();

  const prStatusCodeById = new Map(prStatuses.map((s) => [s.status_id, s.status_code]));
  const quotationStatusNameById = new Map(quotationStatuses.map((s) => [s.status_id, s.status_name]));
  const rfqStatusNameById = new Map(rfqStatuses.map((s) => [s.status_id, s.status_name]));

  const eligiblePrs = useMemo(
    () =>
      allPrs.filter((pr) => QUOTATION_ELIGIBLE_PR_STATUSES.includes(prStatusCodeById.get(pr.status_id))),
    [allPrs, prStatusCodeById],
  );

  const selectedPr = eligiblePrs.find((pr) => String(pr.id) === String(selectedPrId));

  const {
    data: quotations = [],
    isLoading,
    isError,
    error,
  } = useQuotationsForPr(selectedPrId || undefined);

  const {
    data: rfqs = [],
    isLoading: isRfqsLoading,
    isError: isRfqsError,
    error: rfqsError,
  } = useRfqsForPr(selectedPrId || undefined);

  const deleteQuotation = useDeleteQuotation(selectedPrId);

  const prOptions = [
    { value: "", label: "Select a purchase requisition" },
    ...eligiblePrs.map((pr) => ({ value: String(pr.id), label: pr.pr_number })),
  ];

  const rfqNumberById = new Map(rfqs.map((rfq) => [rfq.id, rfq.rfq_number]));
  const responsesByRfqId = new Map();
  quotations.forEach((q) => {
    if (q.rfq_id == null) return;
    responsesByRfqId.set(q.rfq_id, (responsesByRfqId.get(q.rfq_id) || 0) + 1);
  });

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

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteQuotation.mutateAsync(deleteTarget.id);
      toast.success("Quotation deleted.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not delete this quotation."));
    }
  };

  const prStatusCode = selectedPr ? prStatusCodeById.get(selectedPr.status_id) : null;
  const departmentName = selectedPr ? departments.find((d) => d.id === selectedPr.department_id)?.name || "—" : "—";
  const categoryName = selectedPr
    ? categories.find((c) => c.id === selectedPr.purchase_category_id)?.name || "—"
    : "—";

  // ── RFQ list ────────────────────────────────────────────────────────────
  const rfqHeaders = ["RFQ Number", "Sourcing Method", "Invited Vendors", "Responses", "Pending", "Due Date", "Status", "Actions"];
  const rfqColumns = ["rfqNumber", "sourcingMethod", "invitedVendors", "responses", "pending", "dueDate", "status", "actions"];

  const rfqRows = rfqs.map((rfq) => {
    const invitedCount = (rfq.rfq_vendor || []).length;
    const responseCount = responsesByRfqId.get(rfq.id) || 0;
    return {
      rfqNumber: (
        <button
          type="button"
          className="font-mono text-xs font-semibold text-[#0A0082] hover:underline"
          onClick={() => navigate(AP_ROUTES.PROCUREMENT_RFQ_DETAIL(rfq.id))}
        >
          {rfq.rfq_number}
        </button>
      ),
      sourcingMethod: "RFQ",
      invitedVendors: invitedCount,
      responses: responseCount,
      pending: Math.max(invitedCount - responseCount, 0),
      dueDate: formatDate(rfq.due_date),
      status: <StatusBadge label={rfqStatusNameById.get(rfq.status_id) || "Unknown"} size="sm" />,
      actions: (
        <Button variant="outline" size="small" onClick={() => navigate(AP_ROUTES.PROCUREMENT_RFQ_DETAIL(rfq.id))}>
          Manage
        </Button>
      ),
    };
  });

  // ── Quotations table (manual entries and RFQ responses alike) ────────────
  const headers = ["Vendor", "RFQ", "Quotation No.", "Quotation Date", "Valid Until", "Total Amount", "Status", "Actions"];
  const columns = ["vendor", "rfq", "quotationNumber", "quotationDate", "validUntil", "totalAmount", "status", "actions"];

  const rows = quotations.map((q) => {
    const statusName = quotationStatusNameById.get(q.status_id) || "Unknown";
    const isReceived = quotationStatuses.find((s) => s.status_id === q.status_id)?.status_code === "RECEIVED";
    const deletable = canDeleteQuotation && isReceived && prStatusCode === "VENDOR_SELECTION";

    return {
      vendor: vendorNameById.get(q.vendor_id) || `Vendor #${q.vendor_id}`,
      rfq: q.rfq_id != null ? (rfqNumberById.get(q.rfq_id) || `RFQ #${q.rfq_id}`) : <span className="text-gray-400">Manual</span>,
      quotationNumber: q.quotation_number || "—",
      quotationDate: formatDate(q.quotation_date),
      validUntil: formatDate(q.valid_until),
      totalAmount: q.total_amount != null ? formatCurrency(Number(q.total_amount)) : "—",
      status: <StatusBadge label={statusName} size="sm" />,
      actions: (
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
          {deletable && (
            <Button
              type="button"
              variant="link"
              size="icon"
              title="Delete Quotation"
              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 rounded-md"
              onClick={() => setDeleteTarget(q)}
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      ),
    };
  });

  return (
    <div className="space-y-6">
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
          title="Select a requisition to source"
          description="Choose an approved requisition (or one already in vendor selection) to send RFQs, invite vendors, or record quotations."
        />
      ) : (
        <>
          <PageCard>
            <PageCardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="PR Number" value={selectedPr?.pr_number} />
                <Field label="Department" value={departmentName} />
                <Field label="Purchase Category" value={categoryName} />
                <Field label="Estimated Total" value={formatCurrency(Number(selectedPr?.estimated_total) || 0)} />
                <Field label="Required By" value={formatDate(selectedPr?.required_by)} />
                <Field label="Status" value={<StatusBadge label={prStatuses.find((s) => s.status_id === selectedPr?.status_id)?.status_name || "Unknown"} size="sm" />} />
              </div>
            </PageCardContent>
          </PageCard>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Requests for Quotation (RFQ)</h3>
              {canCreateQuotation && prStatusCode === "APPROVED" && rfqs.length > 0 && (
                <Button variant="outline" size="small" onClick={() => setIsRfqCreateOpen(true)} className="whitespace-nowrap">
                  <Plus size={16} />
                  Create Another RFQ
                </Button>
              )}
            </div>

            {isRfqsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {getApiErrorMessage(rfqsError, "Failed to load RFQs.")}
              </div>
            ) : isRfqsLoading ? (
              <LoadingSpinner text="Loading RFQs..." />
            ) : rfqs.length === 0 ? (
              <EmptyState
                title="No RFQ has been created for this requisition"
                description={
                  prStatusCode === "APPROVED"
                    ? "Create an RFQ to invite vendors and collect competitive quotations, or record a quotation directly below."
                    : "This requisition is no longer eligible for a new RFQ."
                }
                action={
                  canCreateQuotation && prStatusCode === "APPROVED" ? (
                    <Button variant="primary" onClick={() => setIsRfqCreateOpen(true)}>
                      <Plus size={16} />
                      Create RFQ
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="w-full overflow-x-auto rounded-lg">
                <GenericTable headers={rfqHeaders} rows={rfqRows} columns={rfqColumns} />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Quotations</h3>
                <p className="text-xs text-gray-500">Vendor quotations recorded against this requisition, from RFQs or entered manually.</p>
              </div>
              {canCreateQuotation && (
                <Button variant="outline" size="small" onClick={() => setIsCreateOpen(true)} className="whitespace-nowrap">
                  <Plus size={16} />
                  Add Quotation
                </Button>
              )}
            </div>

            {isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {getApiErrorMessage(error, "Failed to load quotations.")}
              </div>
            ) : isLoading ? (
              <LoadingSpinner text="Loading quotations..." />
            ) : quotations.length === 0 ? (
              <EmptyState
                title="No quotations received yet"
                description={
                  rfqs.length > 0
                    ? "Record a vendor's quotation once they respond to the RFQ, or add one manually."
                    : "Add a quotation manually, or create an RFQ above to invite vendors first."
                }
              />
            ) : (
              <div className="w-full overflow-x-auto rounded-lg">
                <GenericTable headers={headers} rows={rows} columns={columns} />
              </div>
            )}
          </div>
        </>
      )}

      {selectedPr && (
        <QuotationFormModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} prId={selectedPr.id} />
      )}

      {selectedPr && (
        <RfqCreateModal
          isOpen={isRfqCreateOpen}
          onClose={() => setIsRfqCreateOpen(false)}
          prId={selectedPr.id}
          onCreated={(rfqId) => navigate(AP_ROUTES.PROCUREMENT_RFQ_DETAIL(rfqId))}
        />
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        title="Delete Quotation"
        message="Delete this quotation? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleteQuotation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
}
