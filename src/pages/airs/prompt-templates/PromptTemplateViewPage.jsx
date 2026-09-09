import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PencilIcon, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import Button from "../../../components/Button/Button";
import LoadingSpinner from "../../../components/LoadingSpinner";
import ConfirmationModal from "../../../components/confirmation_modal/ConfirmationModal";
import usePromptTemplateDetail from "./hooks/usePromptTemplateDetail";
import EditPromptTemplateModal from "./components/EditPromptTemplateModal";
import { deletePromptTemplate, updatePromptTemplate } from "./services/promptTemplateService";
import { renderStatusPill, getTaskTypeLabel, formatDateTime } from "./utils/promptTemplateUtils.jsx";

export default function PromptTemplateViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const detail = usePromptTemplateDetail(id);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (detail.isLoading) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading prompt template..." />
      </div>
    );
  }

  if (detail.error || !detail.promptTemplate) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen">
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <p className="text-sm font-bold text-slate-700">We couldn't load this prompt template.</p>
          <Button variant="outline" size="small" className="mt-4" onClick={() => navigate("/ai-screening/prompt-templates")}>
            Back to Prompt Templates
          </Button>
        </div>
      </div>
    );
  }

  const pt = detail.promptTemplate;

  const handleUpdate = async (values) => {
    setIsSubmitting(true);
    try {
      await updatePromptTemplate(pt.id, values);
      toast.success("Prompt template updated successfully.");
      setEditOpen(false);
      detail.refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to update prompt template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePromptTemplate(pt.id);
      toast.success("Prompt template deleted successfully.");
      navigate("/ai-screening/prompt-templates");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to delete prompt template.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/ai-screening/prompt-templates")}
              className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition shadow-sm shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="font-extrabold text-[16px] text-slate-900">{pt.name}</div>
                {renderStatusPill(pt.status)}
              </div>
              <div className="text-[12.5px] text-slate-500">
                {getTaskTypeLabel(pt.taskType)} · Updated by {pt.updatedBy || "—"}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="small" onClick={() => setEditOpen(true)}>
              <PencilIcon className="h-4 w-4 mr-1.5" /> Edit
            </Button>
            <Button variant="danger" size="small" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-4">
        <div className="flex gap-8 flex-wrap">
          {[
            ["Task Type", getTaskTypeLabel(pt.taskType)],
            ["Created At", formatDateTime(pt.createdAt)],
            ["Updated At", formatDateTime(pt.updatedAt)],
            ["Updated By", pt.updatedBy || "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[11px] text-slate-400">{label}</div>
              <div className="text-[13.5px] font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-4">
        <div className="text-[12px] font-semibold text-slate-600 mb-2">Prompt Template</div>
        <pre className="whitespace-pre-wrap break-words text-[13px] font-mono bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-800">
          {pt.promptTemplate}
        </pre>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="text-[12px] font-semibold text-slate-600 mb-2">Notes</div>
        <p className="text-[13px] text-slate-700 whitespace-pre-wrap break-words">
          {pt.notes || "—"}
        </p>
      </div>

      <EditPromptTemplateModal
        open={editOpen}
        promptTemplate={pt}
        onClose={() => setEditOpen(false)}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
      />

      <ConfirmationModal
        isOpen={deleteOpen}
        title="Delete Prompt Template"
        message="Are you sure you want to delete this prompt template?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
