import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import Pagination from "../../../components/Pagination/pagination";
import useSkillOntologyList, { buildSkillQueryParams } from "./hooks/useSkillOntologyList";
import useUnknownSkillsList from "./hooks/useUnknownSkillsList";
import SkillToolbar from "./components/SkillToolbar";
import SkillTabs from "./components/SkillTabs";
import SkillFilters from "./components/SkillFilters";
import SkillTable from "./components/SkillTable";
import UnknownSkillTable from "./components/UnknownSkillTable";
import ErrorState from "./components/ErrorState";
import AddSkillModal from "./components/AddSkillModal";
import EditSkillModal from "./components/EditSkillModal";
import DeactivateDialog from "./components/DeactivateDialog";
import ReactivateDialog from "./components/ReactivateDialog";
import ChildHandlingDialog from "./components/ChildHandlingDialog";
import BulkImportDrawer from "./components/BulkImportDrawer";
import {
  createSkill,
  updateSkill,
  updateSkillStatus,
  getSkill,
  exportSkills,
} from "./services/skillOntologyService";
import { EMPTY_SKILL_FORM } from "./constants/skillOntologyConstants";

export default function SkillOntologyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || "verified");

  const list = useSkillOntologyList();
  const unknown = useUnknownSkillsList(activeTab === "unknown");

  const [addOpen, setAddOpen] = useState(false);
  const [addInitialValues, setAddInitialValues] = useState(null);
  const [editSkill, setEditSkill] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [reactivateTarget, setReactivateTarget] = useState(null);
  const [childHandling, setChildHandling] = useState(null); // { skill, children }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // The list's own category fetch already has these — strip the filter-only
  // "All Categories" sentinel and hand them to the Add/Edit form instead of
  // letting SkillForm fetch its own duplicate copy on every modal open.
  const formCategoryOptions = list.categoryOptions.filter((o) => o.value !== "All");

  const openAdd = () => {
    setAddInitialValues(null);
    setAddOpen(true);
  };

  // Reuses the existing Add Skill flow / createSkill API — no dedicated
  // "promote" endpoint exists, so this just pre-fills the canonical name.
  const handlePromote = (unknownSkill) => {
    setAddInitialValues({ ...EMPTY_SKILL_FORM, canonicalName: unknownSkill.rawSkill });
    setAddOpen(true);
  };

  // "Promote to Skill" from UnknownSkillDetailPage navigates back here with
  // the target skill in location state, since that page has no create-skill
  // flow of its own — reuses the exact same Add Skill drawer flow as above.
  useEffect(() => {
    if (location.state?.promoteSkill) handlePromote(location.state.promoteSkill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    setIsSubmitting(true);
    try {
      const res = await createSkill({
        canonical_name: values.canonicalName,
        category: values.category,
        aliases: values.aliases,
        parent_skill_id: values.parentSkillId || null,
        confidence: values.confidence,
      });
      toast.success(`Skill "${values.canonicalName}" created successfully.`);
      setAddOpen(false);
      list.refresh();
    } catch (err) {
      // Surfaces backend validation messages (e.g. 409 Conflict — "Skill
      // 'Java' already exists.") instead of a generic string. The dialog is
      // deliberately left open and no refresh/success toast fires here —
      // toast.success/setAddOpen(false)/list.refresh() above only run on
      // the happy path, so a rejected request never reaches them.
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to create skill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = async (skill) => {
    try {
      const res = await getSkill(skill.id);
      setEditSkill(res?.data || res);
    } catch {
      setEditSkill(skill); // fall back to the list row if the detail fetch fails
    }
  };

  const handleUpdate = async (values) => {
    setIsSubmitting(true);
    try {
      // Removing an alias isn't a smaller "aliases" array on its own — the
      // backend only drops an alias when it's also listed in remove_aliases
      // (with confirm_alias_removal), so the diff against the pre-edit list
      // has to be computed and sent explicitly.
      const removedAliases = (editSkill.aliases || []).filter((a) => !values.aliases.includes(a));
      const res = await updateSkill(editSkill.id, {
        canonical_name: values.canonicalName,
        category: values.category,
        aliases: values.aliases,
        remove_aliases: removedAliases,
        parent_skill_id: values.parentSkillId || null,
        confidence: values.confidence,
        status: values.status,
      });
      const updated = res?.data || res;
      toast.success("Skill updated successfully.");
      setEditSkill(null);
      list.updateSkillInPlace(updated); // instant feedback, no manual refresh needed
      list.refresh(); // authoritative refetch — keeps page/filters/sorting correct
    } catch (err) {
      // Surfaces backend validation messages (e.g. circular hierarchy, cannot
      // assign itself, parent skill inactive) instead of a generic string.
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to update skill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeactivate = (skill) => setDeactivateTarget(skill);

  const statusErrorMessage = (err, fallback) =>
    err?.response?.data?.message || err?.response?.data?.detail || fallback;

  // Case 3: backend rejects deactivation of a skill with child skills and
  // returns the affected children so the user can choose PROMOTE vs ROOT.
  const extractChildren = (err) => {
    const data = err?.response?.data;
    const children = data?.data?.children || data?.children;
    return Array.isArray(children) && children.length > 0 ? children : null;
  };

  const confirmDeactivate = async () => {
    setIsSubmitting(true);
    try {
      await updateSkillStatus(deactivateTarget.id, false);
      toast.success(`"${deactivateTarget.canonicalName}" deactivated.`);
      setDeactivateTarget(null);
      list.refresh();
    } catch (err) {
      const children = extractChildren(err);
      if (children) {
        setChildHandling({ skill: deactivateTarget, children });
        setDeactivateTarget(null);
      } else {
        toast.error(statusErrorMessage(err, "Failed to deactivate skill."));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitChildHandling = async (mode) => {
    setIsSubmitting(true);
    try {
      await updateSkillStatus(childHandling.skill.id, false, mode);
      toast.success(`"${childHandling.skill.canonicalName}" deactivated.`);
      setChildHandling(null);
      list.refresh();
    } catch (err) {
      toast.error(statusErrorMessage(err, "Failed to deactivate skill."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmReactivate = async () => {
    setIsSubmitting(true);
    try {
      await updateSkillStatus(reactivateTarget.id, true);
      toast.success(`"${reactivateTarget.canonicalName}" reactivated.`);
      setReactivateTarget(null);
      list.refresh();
    } catch (err) {
      toast.error(statusErrorMessage(err, "Failed to reactivate skill."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await exportSkills(
        buildSkillQueryParams({
          search: list.search,
          category: list.category,
          confidence: list.confidenceFilter,
          source: list.source,
          statusFilter: list.statusFilter,
        })
      );
      const blob = new Blob([response.data], { type: response.headers["content-type"] });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "skill_ontology.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Skill ontology exported successfully.");
    } catch {
      toast.error("Failed to export the skill ontology.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <SkillToolbar
        onRefresh={list.refresh}
        onExport={handleExport}
        onAddSkill={openAdd}
        onBulkImport={() => setBulkImportOpen(true)}
        isRefreshing={list.isLoading}
        isExporting={isExporting}
      />

      <SkillTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "verified" ? (
        <>
          <SkillFilters
            search={list.search}
            setSearch={list.setSearch}
            category={list.category}
            setCategory={list.setCategory}
            categoryOptions={list.categoryOptions}
            confidenceFilter={list.confidenceFilter}
            setConfidenceFilter={list.setConfidenceFilter}
            source={list.source}
            setSource={list.setSource}
            statusFilter={list.statusFilter}
            setStatusFilter={list.setStatusFilter}
          />

          {list.error ? (
            <ErrorState onRetry={list.refresh} message="We couldn't load the skill ontology. Please try again." />
          ) : (
            <SkillTable
              skills={list.skills}
              isLoading={list.isLoading}
              onView={(skill) => navigate(`/ai-screening/skill-ontology/${skill.id}`)}
              onEdit={openEdit}
              onDeactivate={openDeactivate}
              onReactivate={setReactivateTarget}
            />
          )}

          {!list.isLoading && !list.error && list.totalCount > 0 && (
            <div className="grid grid-cols-3 items-center mt-4">
              <span className="text-[12px] text-slate-400">{list.totalCount} skills</span>
              <div className="justify-self-center">
                <Pagination
                  currentPage={list.currentPage}
                  totalPages={list.totalPages}
                  onPrevious={() => list.setCurrentPage(list.currentPage - 1)}
                  onNext={() => list.setCurrentPage(list.currentPage + 1)}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <SkillFilters
            search={unknown.search}
            setSearch={unknown.setSearch}
            onlySearch
            searchPlaceholder="Search by raw skill text..."
          />

          {unknown.error ? (
            <ErrorState onRetry={unknown.refresh} message="We couldn't load unknown skills. Please try again." />
          ) : (
            <UnknownSkillTable
              skills={unknown.skills}
              isLoading={unknown.isLoading}
              onPromote={handlePromote}
              onBulkDone={unknown.refresh}
              onView={(skill) =>
                navigate(`/ai-screening/skill-ontology/unknown/${skill.id}`, { state: { skill } })
              }
            />
          )}

          {!unknown.isLoading && !unknown.error && unknown.totalCount > 0 && (
            <div className="grid grid-cols-3 items-center mt-4">
              <span className="text-[12px] text-slate-400">{unknown.totalCount} unknown skills</span>
              <div className="justify-self-center">
                <Pagination
                  currentPage={unknown.currentPage}
                  totalPages={unknown.totalPages}
                  onPrevious={() => unknown.setCurrentPage(unknown.currentPage - 1)}
                  onNext={() => unknown.setCurrentPage(unknown.currentPage + 1)}
                />
              </div>
            </div>
          )}
        </>
      )}

      <AddSkillModal
        open={addOpen}
        existingSkills={list.skills}
        categoryOptions={formCategoryOptions}
        initialValues={addInitialValues}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />

      <EditSkillModal
        open={!!editSkill}
        skill={editSkill}
        existingSkills={list.skills}
        categoryOptions={formCategoryOptions}
        onClose={() => setEditSkill(null)}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
      />

      <DeactivateDialog
        open={!!deactivateTarget}
        skill={deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
        isSubmitting={isSubmitting}
      />

      <ReactivateDialog
        open={!!reactivateTarget}
        skill={reactivateTarget}
        onClose={() => setReactivateTarget(null)}
        onConfirm={confirmReactivate}
        isSubmitting={isSubmitting}
      />

      <ChildHandlingDialog
        open={!!childHandling}
        skill={childHandling?.skill}
        childSkills={childHandling?.children}
        onClose={() => setChildHandling(null)}
        onConfirm={submitChildHandling}
        isSubmitting={isSubmitting}
      />

      <BulkImportDrawer open={bulkImportOpen} onClose={() => setBulkImportOpen(false)} onImported={list.refreshAll} />
    </div>
  );
}
