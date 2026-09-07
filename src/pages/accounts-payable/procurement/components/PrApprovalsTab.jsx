import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AlertTriangle } from "lucide-react";
import Button from "../../../../components/Button/Button";
import GenericTable from "../../../../components/Table/table";
import FormSelect from "../../../../components/forms/FormSelect";
import Modal from "../../../../components/Modal/modal";
import FormTextArea from "../../../../components/forms/FormTextArea";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { AP_ROUTES } from "../../constants/routes";
import { useAuth } from "../../../../contexts/AuthContext";
import { useApPermissions } from "../../hooks/useApPermissions";
import usePendingApprovals from "../hooks/usePendingApprovals";
import RequesterLabel from "./RequesterLabel";
import EmptyState from "./EmptyState";
import useDepartments from "../../system-configuration/hooks/useDepartments";
import usePurchaseCategories from "../../system-configuration/hooks/usePurchaseCategories";
import {
  useApprovePurchaseRequisition,
  useRejectPurchaseRequisition,
  useReturnPurchaseRequisition,
} from "../hooks/usePurchaseRequisitionMutations";

const ALL = "";

/**
 * Approve/reject queue — GET /purchase-requisitions/pending-approval is already
 * filtered server-side to PENDING_APPROVAL, so no client-side status filter is needed.
 */
export default function PrApprovalsTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canApprovePR, canRejectPR, canReturnPR } = useApPermissions();
  const [departmentId, setDepartmentId] = useState(ALL);
  const [decisionTarget, setDecisionTarget] = useState(null); // { pr, action: "approve" | "reject" | "return" }
  const [comment, setComment] = useState("");

  const { data: pendingPrs = [], isLoading, isError, error } = usePendingApprovals(
    departmentId || undefined,
  );
  const { data: departments = [] } = useDepartments();
  const { data: categories = [] } = usePurchaseCategories();

  const approveMutation = useApprovePurchaseRequisition(decisionTarget?.pr?.id);
  const rejectMutation = useRejectPurchaseRequisition(decisionTarget?.pr?.id);
  const returnMutation = useReturnPurchaseRequisition(decisionTarget?.pr?.id);

  const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const departmentOptions = [
    { value: ALL, label: "All Departments" },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const closeModal = () => {
    setDecisionTarget(null);
    setComment("");
  };

  const handleConfirm = async () => {
    if (!decisionTarget) return;
    if ((decisionTarget.action === "reject" || decisionTarget.action === "return") && !comment.trim()) return;

    try {
      if (decisionTarget.action === "approve") {
        await approveMutation.mutateAsync(comment.trim() || undefined);
        toast.success(`${decisionTarget.pr.pr_number} approved.`);
      } else if (decisionTarget.action === "return") {
        await returnMutation.mutateAsync(comment.trim());
        toast.success(`${decisionTarget.pr.pr_number} returned to the requester for clarification.`);
      } else {
        await rejectMutation.mutateAsync(comment.trim());
        toast.success(`${decisionTarget.pr.pr_number} rejected.`);
      }
      closeModal();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not record this decision."));
    }
  };

  const headers = [
    "PR Number",
    "Requester",
    "Department",
    "Category",
    "Priority",
    "Submitted",
    "Estimated Total",
    "Actions",
  ];
  const columns = [
    "prNumber",
    "requester",
    "department",
    "category",
    "priority",
    "submitted",
    "estimatedTotal",
    "actions",
  ];

  const rows = pendingPrs.map((pr) => ({
    prNumber: (
      <button
        type="button"
        className="font-mono text-xs font-semibold text-[#0A0082] hover:underline"
        onClick={() => navigate(AP_ROUTES.PROCUREMENT_PR_DETAIL(pr.id))}
      >
        {pr.pr_number}
      </button>
    ),
    requester: (
      <RequesterLabel
        createdBy={pr.created_by}
        isRequester={pr.created_by != null && user?.user_id != null && String(pr.created_by) === String(user.user_id)}
      />
    ),
    department: departmentNameById.get(pr.department_id) || "—",
    category: categoryNameById.get(pr.purchase_category_id) || "—",
    priority: pr.priority,
    // No dedicated submitted_at field — updated_at reflects the submit action since a PR only
    // reaches this pending-approval queue right after DRAFT -> PENDING_APPROVAL.
    submitted: formatDate(pr.updated_at || pr.created_at),
    estimatedTotal: formatCurrency(Number(pr.estimated_total) || 0),
    actions: (
      <div className="flex items-center gap-2 justify-center">
        {canReturnPR && (
          <Button variant="outline" size="small" onClick={() => setDecisionTarget({ pr, action: "return" })}>
            Return
          </Button>
        )}
        {canRejectPR && (
          <Button variant="outline" size="small" onClick={() => setDecisionTarget({ pr, action: "reject" })}>
            Reject
          </Button>
        )}
        {canApprovePR && (
          <Button variant="primary" size="small" onClick={() => setDecisionTarget({ pr, action: "approve" })}>
            Approve
          </Button>
        )}
      </div>
    ),
  }));

  return (
    <div className="space-y-4">
      <div className="w-full sm:w-56">
        <FormSelect
          label="Department"
          name="departmentId"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          options={departmentOptions}
        />
      </div>

      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getApiErrorMessage(error, "Failed to load pending approvals.")}
        </div>
      ) : isLoading ? (
        <LoadingSpinner text="Loading pending approvals..." />
      ) : pendingPrs.length === 0 ? (
        <EmptyState title="Nothing pending approval" description="Every requisition in this department is up to date." />
      ) : (
        <div className="w-full overflow-x-auto rounded-lg">
          <GenericTable headers={headers} rows={rows} columns={columns} />
        </div>
      )}

      <Modal
        isOpen={!!decisionTarget}
        onClose={closeModal}
        title={
          decisionTarget?.action === "approve"
            ? "Approve requisition"
            : decisionTarget?.action === "return"
              ? "Return requisition for clarification"
              : "Reject requisition"
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              variant={decisionTarget?.action === "approve" ? "primary" : "danger"}
              onClick={handleConfirm}
              disabled={decisionTarget?.action !== "approve" && !comment.trim()}
              loading={approveMutation.isPending || rejectMutation.isPending || returnMutation.isPending}
            >
              {decisionTarget?.action === "approve"
                ? "Confirm Approval"
                : decisionTarget?.action === "return"
                  ? "Confirm Return"
                  : "Confirm Rejection"}
            </Button>
          </div>
        }
      >
        {(decisionTarget?.action === "reject" || decisionTarget?.action === "return") && (
          <p className="mb-3 flex items-start gap-2 text-sm text-gray-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />A reason is required.
          </p>
        )}
        <FormTextArea
          label={
            decisionTarget?.action === "approve"
              ? "Comments (optional)"
              : decisionTarget?.action === "return"
                ? "Reason for return"
                : "Rejection reason"
          }
          name="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          required={decisionTarget?.action !== "approve"}
        />
      </Modal>
    </div>
  );
}
