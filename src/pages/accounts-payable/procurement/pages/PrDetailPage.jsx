import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, AlertTriangle, ArrowRight } from "lucide-react";
import PageHeader from "../../../../components/ui/PageHeader";
import Breadcrumb from "../../../../components/Breadcrumb/Breadcrumb";
import Button from "../../../../components/Button/Button";
import Modal from "../../../../components/Modal/modal";
import ConfirmationModal from "../../../../components/confirmation_modal/ConfirmationModal";
import FormTextArea from "../../../../components/forms/FormTextArea";
import StatusBadge from "../../../../components/status/statusbadge";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { PageCard, PageCardContent } from "../../../../components/Cards/PageCard";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { AP_ROUTES } from "../../constants/routes";
import { useAuth } from "../../../../contexts/AuthContext";
import { useApPermissions } from "../../hooks/useApPermissions";
import { usePrStatuses } from "../../hooks/useApLookups";
import usePurchaseRequisitionDetail from "../hooks/usePurchaseRequisitionDetail";
import useDepartments from "../../system-configuration/hooks/useDepartments";
import usePurchaseCategories from "../../system-configuration/hooks/usePurchaseCategories";
import {
  useSubmitPurchaseRequisition,
  useCancelPurchaseRequisition,
  useApprovePurchaseRequisition,
  useRejectPurchaseRequisition,
  useReturnPurchaseRequisition,
  useResubmitPurchaseRequisition,
  useGeneratePurchaseOrder,
} from "../hooks/usePurchaseRequisitionMutations";
import { usePurchaseOrderList } from "../../purchase-order/hooks/usePurchaseOrders";
import { PR_TRANSITIONS } from "../constants/procurementStatus";
import PrLineEditor from "../components/PrLineEditor";
import ProcurementWorkflowStepper from "../components/ProcurementWorkflowStepper";
import RequesterLabel from "../components/RequesterLabel";

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{value ?? "—"}</p>
    </div>
  );
}

export default function PrDetailPage() {
  const { prId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canEditPR, canSubmitPR, canCancelPR, canApprovePR, canRejectPR, canReturnPR, canGeneratePO } =
    useApPermissions();

  const { data: pr, isLoading, isError, error } = usePurchaseRequisitionDetail(prId);
  const { data: departments = [] } = useDepartments();
  const { data: categories = [] } = usePurchaseCategories();
  const { data: prStatuses = [] } = usePrStatuses();
  const { purchaseOrders } = usePurchaseOrderList({ limit: 200 });

  const submitMutation = useSubmitPurchaseRequisition(prId);
  const cancelMutation = useCancelPurchaseRequisition(prId);
  const approveMutation = useApprovePurchaseRequisition(prId);
  const rejectMutation = useRejectPurchaseRequisition(prId);
  const returnMutation = useReturnPurchaseRequisition(prId);
  const resubmitMutation = useResubmitPurchaseRequisition(prId);
  const generatePoMutation = useGeneratePurchaseOrder(prId);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [returnComment, setReturnComment] = useState("");

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text="Loading purchase requisition..." />
      </div>
    );
  }

  if (isError || !pr) {
    const notFound = error?.response?.status === 404;
    return (
      <div className="p-6">
        <PageHeader title="Purchase Requisition" />
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-gray-700">
            {notFound ? "Purchase requisition not found" : "Something went wrong"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {notFound
              ? "This requisition doesn't exist or may have been removed."
              : getApiErrorMessage(error, "Unable to load this requisition right now.")}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(AP_ROUTES.PROCUREMENT)}>
            Back to Procurement
          </Button>
        </div>
      </div>
    );
  }

  const statusCode = prStatuses.find((s) => s.status_id === pr.status_id)?.status_code;
  const statusName = prStatuses.find((s) => s.status_id === pr.status_id)?.status_name || "Unknown";
  const departmentName = departments.find((d) => d.id === pr.department_id)?.name || "—";
  const categoryName = categories.find((c) => c.id === pr.purchase_category_id)?.name || "—";
  const allowedNext = new Set(PR_TRANSITIONS[statusCode] || []);

  const isDraft = statusCode === "DRAFT";
  const isPendingApproval = statusCode === "PENDING_APPROVAL";
  const isReturned = statusCode === "RETURNED";
  const isRequester = pr.created_by != null && user?.user_id != null && String(pr.created_by) === String(user.user_id);
  const canSubmit = isDraft && allowedNext.has("PENDING_APPROVAL") && (pr.purchase_requisition_line || []).length > 0;
  const canCancel = allowedNext.has("CANCELLED");
  const canReturn = isPendingApproval && canReturnPR && allowedNext.has("RETURNED");
  const canResubmit =
    isReturned &&
    isRequester &&
    canSubmitPR &&
    allowedNext.has("PENDING_APPROVAL") &&
    (pr.purchase_requisition_line || []).length > 0;
  const linesEditable = (isDraft || (isReturned && isRequester)) && canEditPR;
  const canGenerate =
    canGeneratePO &&
    statusCode === "VENDOR_SELECTION" &&
    allowedNext.has("PO_GENERATED") &&
    pr.selected_vendor_id != null &&
    pr.selected_quotation_id != null;

  const relatedPo = purchaseOrders.find((po) => po.pr_id === pr.id);

  const handleSubmit = async () => {
    try {
      await submitMutation.mutateAsync();
      toast.success(`${pr.pr_number} submitted for approval.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not submit this requisition."));
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync();
      toast.success(`${pr.pr_number} cancelled.`);
      setCancelOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not cancel this requisition."));
    }
  };

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync(approveComment.trim() || undefined);
      toast.success(`${pr.pr_number} approved.`);
      setApproveOpen(false);
      setApproveComment("");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not approve this requisition."));
    }
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) return;
    try {
      await rejectMutation.mutateAsync(rejectComment.trim());
      toast.success(`${pr.pr_number} rejected.`);
      setRejectOpen(false);
      setRejectComment("");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not reject this requisition."));
    }
  };

  const handleReturn = async () => {
    if (!returnComment.trim()) return;
    try {
      await returnMutation.mutateAsync(returnComment.trim());
      toast.success(`${pr.pr_number} returned to the requester for clarification.`);
      setReturnOpen(false);
      setReturnComment("");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not return this requisition."));
    }
  };

  const handleResubmit = async () => {
    try {
      await resubmitMutation.mutateAsync();
      toast.success(`${pr.pr_number} resubmitted for approval.`);
      setResubmitOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not resubmit this requisition."));
    }
  };

  const handleGeneratePo = async () => {
    try {
      const result = await generatePoMutation.mutateAsync();
      toast.success("Purchase order generated.");
      navigate(AP_ROUTES.PROCUREMENT_PO_DETAIL(result.po_id));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not generate the purchase order."));
    }
  };

  return (
    <div className="p-6">
      <Breadcrumb items={[{ label: "Procurement", to: AP_ROUTES.PROCUREMENT }, { label: pr.pr_number }]} />

      <PageHeader
        title={pr.pr_number}
        subtitle={`${departmentName} · ${categoryName}`}
        actions={
          <Button variant="outline" onClick={() => navigate(AP_ROUTES.PROCUREMENT)}>
            <ArrowLeft className="h-4 w-4" /> Back to Procurement
          </Button>
        }
      />

      <div className="mb-4">
        <ProcurementWorkflowStepper prStatusCode={statusCode} />
      </div>

      {isReturned && (
        <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Returned for clarification</p>
              <p className="mt-1 text-sm text-orange-700">
                {pr.approval_comment || "The approver returned this requisition without a written reason."}
              </p>
              {isRequester && (
                <p className="mt-2 text-xs text-orange-700">
                  Update the requisition below, then use <span className="font-semibold">Resubmit</span> to send it
                  back for approval.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <PageCard className="mb-4">
        <PageCardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <StatusBadge label={statusName} />
            <div className="flex flex-wrap gap-2">
              {isDraft && canSubmitPR && (
                <Button variant="primary" onClick={handleSubmit} loading={submitMutation.isPending} loadingText="Submitting...">
                  Submit for Approval
                </Button>
              )}
              {canResubmit && (
                <Button variant="primary" onClick={() => setResubmitOpen(true)}>
                  Resubmit
                </Button>
              )}
              {canCancel && canCancelPR && (
                <Button variant="outline" onClick={() => setCancelOpen(true)}>
                  Cancel Requisition
                </Button>
              )}
              {canGenerate && (
                <Button variant="primary" onClick={handleGeneratePo} loading={generatePoMutation.isPending} loadingText="Generating...">
                  Generate Purchase Order
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Requester" value={<RequesterLabel createdBy={pr.created_by} isRequester={isRequester} />} />
            <Field label="Department" value={departmentName} />
            <Field label="Purchase Category" value={categoryName} />
            <Field label="Priority" value={pr.priority} />
            <Field label="Estimated Total" value={formatCurrency(Number(pr.estimated_total) || 0)} />
            <Field label="Required By" value={formatDate(pr.required_by)} />
            <Field label="Delivery Location" value={pr.delivery_location} />
            <Field label="Created" value={formatDate(pr.created_at)} />
            <Field label="Last Updated" value={formatDate(pr.updated_at)} />
          </div>

          {pr.justification && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Justification</p>
              <p className="mt-1 text-sm text-gray-700">{pr.justification}</p>
            </div>
          )}
        </PageCardContent>
      </PageCard>

      <PageCard className="mb-4">
        <PageCardContent>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">PR Lines</h3>
          <PrLineEditor prId={pr.id} lines={pr.purchase_requisition_line} editable={linesEditable} />
        </PageCardContent>
      </PageCard>

      {(pr.approved_by || isPendingApproval) && (
        <PageCard className="mb-4">
          <PageCardContent>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Approval</h3>

            {isPendingApproval && (canApprovePR || canRejectPR || canReturnPR) && (
              <div className="mb-4 flex flex-wrap justify-end gap-2">
                {canReturn && canReturnPR && (
                  <Button variant="outline" onClick={() => setReturnOpen(true)}>
                    Return for Clarification
                  </Button>
                )}
                {canRejectPR && (
                  <Button variant="outline" onClick={() => setRejectOpen(true)}>
                    Reject
                  </Button>
                )}
                {canApprovePR && (
                  <Button variant="primary" onClick={() => setApproveOpen(true)}>
                    Approve
                  </Button>
                )}
              </div>
            )}

            {pr.approved_by ? (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Decision</dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900">
                    {statusCode === "REJECTED"
                      ? "Rejected"
                      : statusCode === "RETURNED"
                        ? "Returned for Clarification"
                        : "Approved"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Decided At</dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900">{formatDate(pr.approved_at)}</dd>
                </div>
                {pr.approval_comment && (
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      {statusCode === "RETURNED" ? "Return Reason" : "Comment"}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-700">{pr.approval_comment}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm italic text-gray-500">Awaiting a decision.</p>
            )}
          </PageCardContent>
        </PageCard>
      )}

      {["APPROVED", "VENDOR_SELECTION"].includes(statusCode) && (
        <PageCard className="mb-4">
          <PageCardContent>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">RFQ &amp; Vendor Selection</h3>
            <p className="mb-3 text-sm text-gray-600">
              {statusCode === "APPROVED"
                ? (pr.quotation || []).length > 0
                  ? `${(pr.quotation || []).length} quotation(s) received so far.`
                  : "This requisition is approved and ready to be sourced."
                : `${(pr.quotation || []).length} quotation(s) received — select a vendor to continue.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to={`${AP_ROUTES.PROCUREMENT}?tab=quotation&prId=${pr.id}`}>
                <Button variant={statusCode === "APPROVED" ? "primary" : "outline"}>
                  {statusCode === "APPROVED" ? (
                    <>
                      Continue to RFQ / Sourcing <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    "View Quotations"
                  )}
                </Button>
              </Link>
              {statusCode === "VENDOR_SELECTION" && (
                <Link to={`${AP_ROUTES.PROCUREMENT}?tab=vendorSelection&prId=${pr.id}`}>
                  <Button variant="primary">Vendor Selection</Button>
                </Link>
              )}
            </div>
          </PageCardContent>
        </PageCard>
      )}

      {statusCode === "PO_GENERATED" && relatedPo && (
        <PageCard>
          <PageCardContent>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Purchase Order</h3>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-gray-700">{relatedPo.po_number}</span>
              <Button variant="outline" onClick={() => navigate(AP_ROUTES.PROCUREMENT_PO_DETAIL(relatedPo.po_id))}>
                View Purchase Order
              </Button>
            </div>
          </PageCardContent>
        </PageCard>
      )}

      <ConfirmationModal
        isOpen={cancelOpen}
        title="Cancel Requisition"
        message={`Cancel ${pr.pr_number}? This cannot be undone.`}
        confirmText="Cancel Requisition"
        cancelText="Keep Requisition"
        isLoading={cancelMutation.isPending}
        onConfirm={handleCancel}
        onCancel={() => setCancelOpen(false)}
        variant="danger"
      />

      <Modal
        isOpen={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve requisition"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleApprove} loading={approveMutation.isPending}>
              Confirm Approval
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-gray-700">
          Approve <span className="font-semibold">{pr.pr_number}</span> for{" "}
          <span className="font-semibold">{formatCurrency(Number(pr.estimated_total) || 0)}</span>?
        </p>
        <FormTextArea
          label="Comments (optional)"
          name="approveComment"
          value={approveComment}
          onChange={(e) => setApproveComment(e.target.value)}
          rows={2}
        />
      </Modal>

      <Modal
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject requisition"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={!rejectComment.trim()}
              loading={rejectMutation.isPending}
            >
              Confirm Rejection
            </Button>
          </div>
        }
      >
        <p className="mb-3 flex items-start gap-2 text-sm text-gray-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          Reject <span className="font-semibold">{pr.pr_number}</span>. A reason is required.
        </p>
        <FormTextArea
          label="Rejection reason"
          name="rejectComment"
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          placeholder="Explain why this requisition is being rejected..."
          rows={3}
          required
        />
      </Modal>

      <Modal
        isOpen={returnOpen}
        onClose={() => setReturnOpen(false)}
        title="Return for clarification"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReturn}
              disabled={!returnComment.trim()}
              loading={returnMutation.isPending}
            >
              Confirm Return
            </Button>
          </div>
        }
      >
        <p className="mb-3 flex items-start gap-2 text-sm text-gray-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          Return <span className="font-semibold">{pr.pr_number}</span> to the requester for clarification. A reason
          is required.
        </p>
        <FormTextArea
          label="Reason for return"
          name="returnComment"
          value={returnComment}
          onChange={(e) => setReturnComment(e.target.value)}
          placeholder="Explain what needs to be clarified or corrected..."
          rows={3}
          required
        />
      </Modal>

      <ConfirmationModal
        isOpen={resubmitOpen}
        title="Resubmit Requisition"
        message={`Resubmit ${pr.pr_number} for approval?`}
        confirmText="Resubmit"
        cancelText="Cancel"
        isLoading={resubmitMutation.isPending}
        onConfirm={handleResubmit}
        onCancel={() => setResubmitOpen(false)}
        variant="primary"
      />
    </div>
  );
}
