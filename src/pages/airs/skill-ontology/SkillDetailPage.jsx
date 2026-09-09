import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, PencilIcon, Ban, RotateCcw, Network } from "lucide-react";
import { toast } from "react-toastify";
import Button from "../../../components/Button/Button";
import LoadingSpinner from "../../../components/LoadingSpinner";
import useSkillDetail from "./hooks/useSkillDetail";
import UsageStats from "./components/UsageStats";
import EmbeddingStatus from "./components/EmbeddingStatus";
import AliasEditor from "./components/AliasEditor";
import ErrorState from "./components/ErrorState";
import EditSkillModal from "./components/EditSkillModal";
import DeactivateDialog from "./components/DeactivateDialog";
import ReactivateDialog from "./components/ReactivateDialog";
import ChildHandlingDialog from "./components/ChildHandlingDialog";
import { renderStatusPill, renderVerificationBadge, formatDate, findAliasConflict, getSourceLabel } from "./utils/skillOntologyUtils.jsx";
import { updateSkill as updateSkillApi, updateSkillStatus } from "./services/skillOntologyService";

const TABS = [
  { id: "aliases", label: "Aliases" },
  { id: "hierarchy", label: "Hierarchy" },
];

export default function SkillDetailPage() {
  const { skillId } = useParams();
  const navigate = useNavigate();
  const detail = useSkillDetail(skillId);

  const [tab, setTab] = useState("aliases");
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [childHandling, setChildHandling] = useState(null); // { children }
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (detail.isLoading) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading skill..." />
      </div>
    );
  }

  if (detail.error || !detail.skill) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen">
        <ErrorState
          title="Skill not found"
          message="We couldn't load this skill. It may have been removed."
          onRetry={detail.refresh}
        />
      </div>
    );
  }

  const skill = detail.skill;

  const openDeactivate = () => setDeactivateOpen(true);

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
      await updateSkillStatus(skill.id, false);
      toast.success(`"${skill.canonicalName}" deactivated.`);
      setDeactivateOpen(false);
      detail.refresh(); // also refreshes the Hierarchy tab's parent/children
    } catch (err) {
      const children = extractChildren(err);
      if (children) {
        setChildHandling({ children });
        setDeactivateOpen(false);
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
      await updateSkillStatus(skill.id, false, mode);
      toast.success(`"${skill.canonicalName}" deactivated.`);
      setChildHandling(null);
      detail.refresh();
    } catch (err) {
      toast.error(statusErrorMessage(err, "Failed to deactivate skill."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmReactivate = async () => {
    setIsSubmitting(true);
    try {
      await updateSkillStatus(skill.id, true);
      toast.success(`"${skill.canonicalName}" reactivated.`);
      setReactivateOpen(false);
      detail.refresh();
    } catch (err) {
      toast.error(statusErrorMessage(err, "Failed to reactivate skill."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (values) => {
    setIsSubmitting(true);
    try {
      // Removing an alias isn't a smaller "aliases" array on its own — the
      // backend only drops an alias when it's also listed in remove_aliases
      // (with confirm_alias_removal), so the diff against the pre-edit list
      // has to be computed and sent explicitly.
      const removedAliases = (skill.aliases || []).filter((a) => !values.aliases.includes(a));
      const res = await updateSkillApi(skill.id, {
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
      setEditOpen(false);
      detail.applyUpdate(updated); // instant feedback, no manual refresh needed
      detail.refresh(); // authoritative refetch — also refreshes the Hierarchy tab's parent/children
    } catch (err) {
      // Surfaces backend validation messages (e.g. circular hierarchy, cannot
      // assign itself, parent skill inactive) instead of a generic string.
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to update skill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/ai-screening/skill-ontology")}
              className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition shadow-sm shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="font-extrabold text-[16px] text-slate-900">{skill.canonicalName}</div>
                {renderStatusPill(skill.status)}
                {renderVerificationBadge(skill.confidence)}
              </div>
              <div className="text-[12.5px] text-slate-500">
                {skill.category} · Source: {getSourceLabel(skill.source)} · Last seen {formatDate(skill.lastSeen)}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="small" onClick={() => setEditOpen(true)}>
              <PencilIcon className="h-4 w-4 mr-1.5" /> Edit
            </Button>
            {skill.status === "ACTIVE" ? (
              <Button variant="danger" size="small" onClick={openDeactivate}>
                <Ban className="h-4 w-4 mr-1.5" /> Deactivate
              </Button>
            ) : (
              <Button variant="primary" size="small" onClick={() => setReactivateOpen(true)}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Reactivate
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-6 mt-4 flex-wrap">
          {[
            ["Parent skill", skill.parentSkillName || "None"],
            ["Occurrence count", skill.occurrenceCount ?? 0],
            ["Last seen", formatDate(skill.lastSeen)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[11px] text-slate-400">{label}</div>
              <div className="text-[13.5px] font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <UsageStats jdCount={skill.jdCount} candidateCount={skill.candidateCount} />
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center">
          <EmbeddingStatus status={skill.embeddingStatus} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-1 px-5 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 py-2.5 text-[13px] font-semibold relative"
              style={{ color: tab === t.id ? "#2563EB" : "#98A1AF" }}
            >
              {t.label}
              {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-blue-600" />}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "aliases" && (
            <AliasEditor
              aliases={detail.aliasNames}
              onAdd={detail.addAlias}
              onRemove={detail.removeAlias}
              disabled={detail.isMutatingAlias}
              conflictChecker={(alias) => findAliasConflict(alias, [skill], skill.id)}
            />
          )}

          {tab === "hierarchy" && (
            <div className="space-y-4">
              <div>
                <div className="text-[12px] font-semibold text-slate-600 mb-1.5">Parent</div>
                {skill.parentSkillName ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                    <Network size={14} className="text-slate-400" />
                    <span className="text-[13px] font-semibold text-slate-900">{skill.parentSkillName}</span>
                  </div>
                ) : (
                  <p className="text-[12px] text-slate-400">This is a top-level skill.</p>
                )}
              </div>
              <div>
                <div className="text-[12px] font-semibold text-slate-600 mb-1.5">
                  Children ({(skill.children || []).length})
                </div>
                {(skill.children || []).length === 0 ? (
                  <p className="text-[12px] text-slate-400">No child skills.</p>
                ) : (
                  <div className="space-y-1.5">
                    {skill.children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => navigate(`/ai-screening/skill-ontology/${child.id}`)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition text-left"
                      >
                        <span className="text-[13px] font-semibold text-slate-900">{child.canonicalName}</span>
                        {renderVerificationBadge(child.confidence)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <EditSkillModal
        open={editOpen}
        skill={{
          id: skill.id,
          canonicalName: skill.canonicalName,
          category: skill.category,
          aliases: detail.aliasNames,
          parentSkillId: skill.parentSkillId,
          parentSkillName: skill.parentSkillName,
          confidence: skill.confidence,
          status: skill.status,
        }}
        existingSkills={[]}
        onClose={() => setEditOpen(false)}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
      />

      <DeactivateDialog
        open={deactivateOpen}
        skill={skill}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={confirmDeactivate}
        isSubmitting={isSubmitting}
      />

      <ReactivateDialog
        open={reactivateOpen}
        skill={skill}
        onClose={() => setReactivateOpen(false)}
        onConfirm={confirmReactivate}
        isSubmitting={isSubmitting}
      />

      <ChildHandlingDialog
        open={!!childHandling}
        skill={skill}
        childSkills={childHandling?.children}
        onClose={() => setChildHandling(null)}
        onConfirm={submitChildHandling}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
