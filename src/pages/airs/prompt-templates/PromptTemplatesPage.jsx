import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Pagination from "../../../components/Pagination/pagination";
import ConfirmationModal from "../../../components/confirmation_modal/ConfirmationModal";
import usePromptTemplateList from "./hooks/usePromptTemplateList";
import PromptTemplateToolbar from "./components/PromptTemplateToolbar";
import PromptTemplateFilters from "./components/PromptTemplateFilters";
import PromptTemplateTable from "./components/PromptTemplateTable";
import AddPromptTemplateModal from "./components/AddPromptTemplateModal";
import EditPromptTemplateModal from "./components/EditPromptTemplateModal";
import { createPromptTemplate, updatePromptTemplate, deletePromptTemplate, getPromptTemplate } from "./services/promptTemplateService";

export default function PromptTemplatesPage() {
  const navigate = useNavigate();
  const list = usePromptTemplateList();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreate = async (values) => {
    setIsSubmitting(true);
    try {
      await createPromptTemplate(values);
      toast.success("Prompt template created successfully.");
      setAddOpen(false);
      list.refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to create prompt template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = async (pt) => {
    try {
      const res = await getPromptTemplate(pt.id);
      setEditTarget(res?.data || pt);
    } catch {
      setEditTarget(pt); // fall back to the list row if the detail fetch fails
    }
  };

  const handleUpdate = async (values) => {
    setIsSubmitting(true);
    try {
      await updatePromptTemplate(editTarget.id, values);
      toast.success("Prompt template updated successfully.");
      setEditTarget(null);
      list.refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to update prompt template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePromptTemplate(deleteTarget.id);
      toast.success("Prompt template deleted successfully.");
      setDeleteTarget(null);
      list.refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to delete prompt template.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <PromptTemplateToolbar onCreate={() => setAddOpen(true)} />

      <PromptTemplateFilters
        search={list.search}
        setSearch={list.setSearch}
        taskTypeFilter={list.taskTypeFilter}
        setTaskTypeFilter={list.setTaskTypeFilter}
        statusFilter={list.statusFilter}
        setStatusFilter={list.setStatusFilter}
      />

      <PromptTemplateTable
        promptTemplates={list.promptTemplates}
        isLoading={list.isLoading}
        sortBy={list.sortBy}
        sortOrder={list.sortOrder}
        onSort={list.toggleSort}
        onView={(pt) => navigate(`/ai-screening/prompt-templates/${pt.id}/view`)}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      {!list.isLoading && list.totalCount > 0 && (
        <Pagination
          currentPage={list.currentPage}
          totalPages={list.totalPages}
          onPrevious={() => list.setCurrentPage(list.currentPage - 1)}
          onNext={() => list.setCurrentPage(list.currentPage + 1)}
        />
      )}

      <AddPromptTemplateModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />

      <EditPromptTemplateModal
        open={!!editTarget}
        promptTemplate={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        title="Delete Prompt Template"
        message="Are you sure you want to delete this prompt template?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
