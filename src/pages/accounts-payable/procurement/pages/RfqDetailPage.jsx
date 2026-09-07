import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, Eye, Download, Plus } from "lucide-react";
import PageHeader from "../../../../components/ui/PageHeader";
import Breadcrumb from "../../../../components/Breadcrumb/Breadcrumb";
import Button from "../../../../components/Button/Button";
import GenericTable from "../../../../components/Table/table";
import ConfirmationModal from "../../../../components/confirmation_modal/ConfirmationModal";
import StatusBadge from "../../../../components/status/statusbadge";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { PageCard, PageCardContent } from "../../../../components/Cards/PageCard";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency, formatDate, formatDateTime } from "../../utils/formatters";
import { AP_ROUTES } from "../../constants/routes";
import { useApPermissions } from "../../hooks/useApPermissions";
import { usePrStatuses, useQuotationStatuses, useRfqStatuses } from "../../hooks/useApLookups";
import { useRfqDetail, useQuotationsForRfq } from "../hooks/useRfqs";
import { useSendRfq, useCloseRfq } from "../hooks/useRfqMutations";
import usePurchaseRequisitionDetail from "../hooks/usePurchaseRequisitionDetail";
import useDepartments from "../../system-configuration/hooks/useDepartments";
import usePurchaseCategories from "../../system-configuration/hooks/usePurchaseCategories";
import useVendorOptions from "../hooks/useVendorOptions";
import procurementService from "../services/procurementService";
import { RFQ_TRANSITIONS } from "../constants/procurementStatus";
import PrLineEditor from "../components/PrLineEditor";
import QuotationFormModal from "../components/QuotationFormModal";
import InviteVendorsModal from "../components/InviteVendorsModal";
import RfqSendResultsPanel from "../components/RfqSendResultsPanel";
import EmptyState from "../components/EmptyState";
import Modal from "../../../../components/Modal/modal";
import { extractRfqSendResults } from "../utils/rfqSendResults";

/** One-line hint for what to do next at each RFQ status, matching RFQ_TRANSITIONS. */
const RFQ_STAGE_HINTS = {
  DRAFT: "Invite vendors, then send the RFQ once at least one vendor is invited.",
  SENT: "Waiting on vendor responses. Record quotations as they arrive, then close the RFQ once done.",
  RESPONSE_RECEIVED: "Review the quotations received so far, then close the RFQ when ready to select a vendor.",
  CLOSED: "This RFQ is closed. Continue to Vendor Selection to compare and select a quotation.",
};

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

export default function RfqDetailPage() {
  const { rfqId } = useParams();
  const navigate = useNavigate();
  // RFQ workflow (send/close/invite vendors/record a quotation) is all part of the sourcing
  // decision — intentionally gated by canCreateQuotation (QUOTATION_CREATE), not a PR
  // permission. There is no dedicated RFQ_* permission in the UMS matrix. See useApPermissions.js.
  const { canCreateQuotation } = useApPermissions();

  const { data: rfq, isLoading, isError, error } = useRfqDetail(rfqId);
  const { data: rfqStatuses = [] } = useRfqStatuses();
  const { data: prStatuses = [] } = usePrStatuses();
  const { data: quotationStatuses = [] } = useQuotationStatuses();
  const { data: pr } = usePurchaseRequisitionDetail(rfq?.pr_id);
  const { data: departments = [] } = useDepartments();
  const { data: categories = [] } = usePurchaseCategories();
  const { vendors, vendorNameById } = useVendorOptions();
  const { data: rfqQuotations = [] } = useQuotationsForRfq(rfqId);

  const sendRfq = useSendRfq(rfqId);
  const closeRfq = useCloseRfq(rfqId);

  const [sendOpen, setSendOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [docLoadingId, setDocLoadingId] = useState(null);
  const [sendResults, setSendResults] = useState(null);

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text="Loading RFQ..." />
      </div>
    );
  }

  if (isError || !rfq) {
    const notFound = error?.response?.status === 404;
    return (
      <div className="p-6">
        <PageHeader title="RFQ" />
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-gray-700">{notFound ? "RFQ not found" : "Something went wrong"}</p>
          <p className="mt-1 text-sm text-gray-500">
            {notFound ? "This RFQ doesn't exist or may have been removed." : getApiErrorMessage(error, "Unable to load this RFQ right now.")}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(AP_ROUTES.PROCUREMENT)}>
            Back to Procurement
          </Button>
        </div>
      </div>
    );
  }

  const statusCode = rfqStatuses.find((s) => s.status_id === rfq.status_id)?.status_code;
  const statusName = rfqStatuses.find((s) => s.status_id === rfq.status_id)?.status_name || "Unknown";
  const allowedNext = new Set(RFQ_TRANSITIONS[statusCode] || []);

  const prStatusCode = pr ? prStatuses.find((s) => s.status_id === pr.status_id)?.status_code : null;
  const departmentName = pr ? departments.find((d) => d.id === pr.department_id)?.name || "—" : "—";
  const categoryName = pr ? categories.find((c) => c.id === pr.purchase_category_id)?.name || "—" : "—";

  const invitedVendors = rfq.rfq_vendor || [];
  const invitedVendorIds = invitedVendors.map((v) => v.vendor_id);
  const quotationByVendorId = new Map(rfqQuotations.map((q) => [q.vendor_id, q]));

  const canSend = canCreateQuotation && statusCode === "DRAFT" && allowedNext.has("SENT") && invitedVendors.length > 0;
  const canClose = canCreateQuotation && allowedNext.has("CLOSED");
  const canInvite = canCreateQuotation && (statusCode === "DRAFT" || statusCode === "SENT");
  const canAddQuotation = canCreateQuotation && statusCode !== "CLOSED" && invitedVendors.length > 0;
  const backToQuotationTab = pr ? `${AP_ROUTES.PROCUREMENT}?tab=quotation&prId=${pr.id}` : AP_ROUTES.PROCUREMENT;

  const handleSend = async () => {
    try {
      const result = await sendRfq.mutateAsync();
      setSendOpen(false);
      // Only the backend response tells us whether it sent per-vendor results — never assume
      // a shape it didn't actually return.
      const results = extractRfqSendResults(result);
      if (results) {
        setSendResults(results);
      } else {
        toast.success(`${rfq.rfq_number} sent to invited vendors.`);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not send this RFQ."));
    }
  };

  const handleCloseRfq = async () => {
    try {
      await closeRfq.mutateAsync();
      toast.success(`${rfq.rfq_number} closed.`);
      setCloseOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not close this RFQ."));
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

  const vendorHeaders = ["Vendor", "Email", "Invited At", "Response", "Quotation No."];
  const vendorColumns = ["vendor", "email", "invitedAt", "response", "quotationNumber"];
  const vendorRows = invitedVendors.map((iv) => {
    const vendor = vendors.find((v) => v.vendor_id === iv.vendor_id);
    const quotation = quotationByVendorId.get(iv.vendor_id);
    return {
      vendor: vendorNameById.get(iv.vendor_id) || `Vendor #${iv.vendor_id}`,
      email: vendor?.email || "—",
      invitedAt: formatDateTime(iv.invited_at),
      response: quotation ? (
        <span className="text-xs font-semibold text-emerald-700">Responded</span>
      ) : (
        <span className="text-xs text-gray-400">Awaiting response</span>
      ),
      quotationNumber: quotation ? quotation.quotation_number || "—" : <span className="text-gray-400">—</span>,
    };
  });

  const quotationHeaders = [
    "Vendor",
    "Quotation No.",
    "Quotation Date",
    "Valid Until",
    "Total Amount",
    "Delivery Days",
    "Payment Terms",
    "Status",
    "Actions",
  ];
  const quotationColumns = [
    "vendor",
    "quotationNumber",
    "quotationDate",
    "validUntil",
    "totalAmount",
    "deliveryDays",
    "paymentTerms",
    "status",
    "actions",
  ];
  const quotationRows = rfqQuotations.map((q) => ({
    vendor: vendorNameById.get(q.vendor_id) || `Vendor #${q.vendor_id}`,
    quotationNumber: q.quotation_number || "—",
    quotationDate: formatDate(q.quotation_date),
    validUntil: formatDate(q.valid_until),
    totalAmount: q.total_amount != null ? formatCurrency(Number(q.total_amount)) : "—",
    deliveryDays: q.delivery_days != null ? q.delivery_days : "—",
    paymentTerms: q.payment_terms || "—",
    status: (
      <StatusBadge
        label={quotationStatuses.find((s) => s.status_id === q.status_id)?.status_name || "Unknown"}
        size="sm"
      />
    ),
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
      </div>
    ),
  }));

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          { label: "Procurement", to: AP_ROUTES.PROCUREMENT },
          ...(pr ? [{ label: pr.pr_number, to: backToQuotationTab }] : []),
          { label: rfq.rfq_number },
        ]}
      />

      <PageHeader
        title={rfq.rfq_number}
        subtitle={pr ? `${departmentName} · ${categoryName}` : undefined}
        actions={
          <Button variant="outline" onClick={() => navigate(backToQuotationTab)}>
            <ArrowLeft className="h-4 w-4" /> Back to Quotation
          </Button>
        }
      />

      <PageCard className="mb-4">
        <PageCardContent>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <StatusBadge label={statusName} />
            <div className="flex flex-wrap gap-2">
              {canSend && (
                <Button variant="primary" onClick={() => setSendOpen(true)}>
                  Send RFQ
                </Button>
              )}
              {canClose && (
                <Button variant="outline" onClick={() => setCloseOpen(true)}>
                  Close RFQ
                </Button>
              )}
              {statusCode === "CLOSED" && pr && (
                <Link to={`${AP_ROUTES.PROCUREMENT}?tab=vendorSelection&prId=${pr.id}`}>
                  <Button variant="primary">Continue to Vendor Selection</Button>
                </Link>
              )}
            </div>
          </div>

          {RFQ_STAGE_HINTS[statusCode] && (
            <p className="mb-2 text-sm text-gray-500">{RFQ_STAGE_HINTS[statusCode]}</p>
          )}

          {statusCode === "DRAFT" && invitedVendors.length === 0 && (
            <p className="mb-2 text-sm text-amber-600">
              Invite at least one vendor before this RFQ can be sent.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Due Date" value={formatDate(rfq.due_date)} />
            <Field label="Sent At" value={rfq.sent_at ? formatDateTime(rfq.sent_at) : "—"} />
            <Field label="Closed At" value={rfq.closed_at ? formatDateTime(rfq.closed_at) : "—"} />
            <Field label="Created" value={formatDateTime(rfq.created_at)} />
          </div>
        </PageCardContent>
      </PageCard>

      {pr && (
        <PageCard className="mb-4">
          <PageCardContent>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Purchase Requisition Summary</h3>
              <Link to={AP_ROUTES.PROCUREMENT_PR_DETAIL(pr.id)} className="text-xs font-semibold text-[#0A0082] hover:underline">
                View {pr.pr_number}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="PR Number" value={pr.pr_number} />
              <Field label="Department" value={departmentName} />
              <Field label="Purchase Category" value={categoryName} />
              <Field label="Estimated Total" value={formatCurrency(Number(pr.estimated_total) || 0)} />
            </div>
            {pr.justification && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Justification</p>
                <p className="mt-1 text-sm text-gray-700">{pr.justification}</p>
              </div>
            )}
          </PageCardContent>
        </PageCard>
      )}

      {pr && (
        <PageCard className="mb-4">
          <PageCardContent>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Requested Items</h3>
            <PrLineEditor prId={pr.id} lines={pr.purchase_requisition_line} editable={false} />
          </PageCardContent>
        </PageCard>
      )}

      <PageCard className="mb-4">
        <PageCardContent>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-700">Invited Vendors</h3>
            {canInvite && (
              <Button variant="primary" size="small" onClick={() => setInviteOpen(true)}>
                <Plus size={14} /> Invite Vendors
              </Button>
            )}
          </div>
          {invitedVendors.length === 0 ? (
            <EmptyState
              title="No vendors invited yet"
              description="Invite active vendors to this RFQ before it can be sent."
            />
          ) : (
            <div className="w-full overflow-x-auto rounded-lg">
              <GenericTable headers={vendorHeaders} rows={vendorRows} columns={vendorColumns} />
            </div>
          )}
        </PageCardContent>
      </PageCard>

      <PageCard>
        <PageCardContent>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-700">Received Quotations</h3>
            {canAddQuotation && (
              <Button variant="primary" size="small" onClick={() => setQuotationOpen(true)}>
                <Plus size={14} /> Add Quotation
              </Button>
            )}
          </div>
          {rfqQuotations.length === 0 ? (
            <EmptyState
              title="No quotations received yet"
              description="Record a quotation as vendors respond to this RFQ."
            />
          ) : (
            <div className="w-full overflow-x-auto rounded-lg">
              <GenericTable headers={quotationHeaders} rows={quotationRows} columns={quotationColumns} />
            </div>
          )}
        </PageCardContent>
      </PageCard>

      <ConfirmationModal
        isOpen={sendOpen}
        title="Send RFQ"
        message={`Send ${rfq.rfq_number} to ${invitedVendors.length} invited vendor(s)? This cannot be undone.`}
        confirmText="Send RFQ"
        cancelText="Cancel"
        isLoading={sendRfq.isPending}
        onConfirm={handleSend}
        onCancel={() => setSendOpen(false)}
        variant="primary"
      />

      <ConfirmationModal
        isOpen={closeOpen}
        title="Close RFQ"
        message={`Close ${rfq.rfq_number}? No further quotations can be added once it is closed, and vendor selection will become available.`}
        confirmText="Close RFQ"
        cancelText="Cancel"
        isLoading={closeRfq.isPending}
        onConfirm={handleCloseRfq}
        onCancel={() => setCloseOpen(false)}
        variant="primary"
      />

      <Modal
        isOpen={!!sendResults}
        onClose={() => setSendResults(null)}
        title="RFQ send results"
        size="sm"
        footer={
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setSendResults(null)}>
              Done
            </Button>
          </div>
        }
      >
        {sendResults && <RfqSendResultsPanel results={sendResults} />}
      </Modal>

      {pr && (
        <InviteVendorsModal
          isOpen={inviteOpen}
          onClose={() => setInviteOpen(false)}
          rfqId={rfq.id}
          excludeVendorIds={invitedVendorIds}
        />
      )}

      {pr && (
        <QuotationFormModal
          isOpen={quotationOpen}
          onClose={() => setQuotationOpen(false)}
          prId={pr.id}
          rfqId={rfq.id}
          invitedVendorIds={invitedVendorIds}
        />
      )}
    </div>
  );
}
