import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Search,
  Trash2,
  GitMerge,
  Sparkles,
  Plus,
  Calendar,
  Tag,
} from "lucide-react";
import Button from "../../../components/Button/Button";
import { Badge } from "../../../components/ui/badge";
import Modal from "../../../components/Modal/modal";
import Pagination from "../../../components/Pagination/pagination";
import GenericTable from "../../../components/Table/table";
import LoadingSpinner from "../../../components/LoadingSpinner";
import ErrorState from "./components/ErrorState";
import SkillForm from "./components/SkillForm";
import useUnknownSkillSuggestions from "./hooks/useUnknownSkillSuggestions";
import { deleteUnknownSkill, resolveUnknownSkill, createCanonicalSkillFromUnknown } from "./services/skillOntologyService";
import { formatDate, validateSkillForm } from "./utils/skillOntologyUtils.jsx";
import { EMPTY_SKILL_FORM } from "./constants/skillOntologyConstants";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 10; // rows per page for suggestion tabs

const MAP_TABS = [
  { id: "rapidfuzz_canonical", label: "RapidFuzz Canonical" },
  { id: "semantic_canonical", label: "Semantic Canonical" },
  { id: "rapidfuzz_alias", label: "RapidFuzz Alias" },
  { id: "semantic_alias", label: "Semantic Alias" },
];

const MAP_TYPE_OPTIONS = [
  { value: "MAP_TO_EXISTING", label: "Map to Existing Skill" },
  { value: "ADD_AS_ALIAS", label: "Add as Alias" },
];

// ─── Primitive helpers ────────────────────────────────────────────────────────

function Card({ className = "", children }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-3">
      {children}
    </div>
  );
}

function SimilarityBadge({ score }) {
  let cls = "bg-rose-50 text-rose-700 border-rose-100";
  if (score >= 85) cls = "bg-emerald-50 text-emerald-700 border-emerald-100";
  else if (score >= 70) cls = "bg-blue-50 text-blue-700 border-blue-100";
  else if (score >= 55) cls = "bg-amber-50 text-amber-700 border-amber-100";
  return (
    <Badge className={`${cls} font-semibold px-2.5 py-0.5 text-[11px]`}>
      {score}%
    </Badge>
  );
}



// ─── Action toggle button (on summary card) ────────────────────────────────

function ActionToggleButton({ icon: Icon, label, active, color, onClick }) {
  const activeStyles = {
    create: "bg-[#0A0082] text-white border-[#0A0082] shadow-md",
    map: "bg-indigo-600 text-white border-indigo-600 shadow-md",
    delete: "bg-rose-600  text-white border-rose-600  shadow-md",
  };
  const inactiveStyle =
    "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50";

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-[13px] font-semibold transition-all duration-200 ${active ? activeStyles[color] : inactiveStyle
        }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ─── Create New Canonical Skill – Modal body ──────────────────────────────────

export function CreateSkillModalBody({ rawSkill, unknownSkillId, onClose, onCreated }) {
  const [values, setValues] = useState({
    ...EMPTY_SKILL_FORM,
    canonicalName: rawSkill,
    aliases: [rawSkill],
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (field, value) => setValues((v) => ({ ...v, [field]: value }));

  const handleSubmit = async () => {
    const nextErrors = validateSkillForm(values, []);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await createCanonicalSkillFromUnknown(unknownSkillId, {
        canonical_name: values.canonicalName,
        category: values.category,
        aliases: values.aliases,
        parent_skill_id: values.parentSkillId || null,
        confidence: values.confidence,
      });
      toast.success(res?.data?.message || "Canonical skill created successfully.");
      onCreated?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to create canonical skill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Form — shared with Add/Edit Skill so canonical skills stay consistent */}
      <div className="space-y-4">
        <SkillForm values={values} errors={errors} onFieldChange={setField} />
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" size="medium" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="primary" size="medium" loading={isSubmitting} onClick={handleSubmit}>
          <Plus className="h-4 w-4" />
          Create Canonical Skill
        </Button>
      </div>
    </div>
  );
}

// ─── Map to Existing Skill – Modal body ──────────────────────────────────────
// target is the suggestion row the user clicked "Map" on: { skillId, skillName, alias }

export function MapSkillModalBody({ rawSkill, unknownSkillId, target, onClose, onMapped }) {
  const [mapType, setMapType] = useState(MAP_TYPE_OPTIONS[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!target?.skillId) {
      toast.error("Select a suggested skill from the table before mapping.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await resolveUnknownSkill(unknownSkillId, {
        canonical_skill_id: target.skillId,
        canonical_name: target.skillName,
        type: mapType,
      });
      toast.success(res?.data?.message || "Unknown Skill resolved successfully.");
      onMapped?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to resolve unknown skill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Selected skill preview */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <SectionHeading>Selected Skill</SectionHeading>
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 mb-1">Unknown Skill</div>
            <div className="text-[14px] font-bold text-slate-900">{rawSkill}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 mb-1">Canonical Skill</div>
            <div className="text-[14px] font-bold text-slate-900">
              {target?.skillName || "—"}
              {target?.alias && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
                  <Tag size={10} />
                  {target.alias}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map type */}
      <div>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Map Type</label>
        <select
          value={mapType}
          onChange={(e) => setMapType(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MAP_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" size="medium" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="primary" size="medium" loading={isSubmitting} onClick={handleConfirm}>
          <GitMerge className="h-4 w-4" />
          Confirm
        </Button>
      </div>
    </div>
  );
}

// ─── Delete Unknown Skill – Modal body ────────────────────────────────────────

export function DeleteSkillModalBody({ rawSkill, unknownSkillId, onClose, onDeleted }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteUnknownSkill(unknownSkillId);
      toast.success(res?.data?.message || "Unknown skill deleted successfully.");
      onDeleted?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to delete unknown skill.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-slate-600">
        Are you sure you want to delete <span className="font-semibold text-slate-900">"{rawSkill}"</span>? This
        action cannot be undone.
      </p>

      {/* Footer actions */}
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" size="medium" onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button variant="danger" size="medium" loading={isDeleting} onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
          Confirm
        </Button>
      </div>
    </div>
  );
}

// ─── Suggestion Tabs section (always visible on page) ────────────────────────

export function SuggestionTabsSection({ unknownSkillId, onMapClick }) {
  const [activeTab, setActiveTab] = useState("rapidfuzz_canonical");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);

  // Per-tab pages stored in a map so each tab remembers its own page
  const [pages, setPages] = useState({
    rapidfuzz_canonical: 1,
    semantic_canonical: 1,
    rapidfuzz_alias: 1,
    semantic_alias: 1,
  });

  const { dataForTab, isLoadingTab, errorForTab, ensureLoaded } =
    useUnknownSkillSuggestions(unknownSkillId);

  // Lazy-load: fires only the first time a tab is opened; cached after that.
  useEffect(() => {
    ensureLoaded(activeTab);
  }, [activeTab, ensureLoaded]);

  const isAliasTab = activeTab === "rapidfuzz_alias" || activeTab === "semantic_alias";

  const isLoading = isLoadingTab(activeTab);
  const loadError = errorForTab(activeTab);
  const rawData = dataForTab(activeTab) || [];

  const filteredData = searchQuery.trim()
    ? rawData.filter((r) => {
      const q = searchQuery.trim().toLowerCase();
      return (r.skillName || "").toLowerCase().includes(q) || (r.alias || "").toLowerCase().includes(q);
    })
    : rawData;

  const currentPage = pages[activeTab];
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const pagedData = filteredData.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const setPage = (p) =>
    setPages((prev) => ({ ...prev, [activeTab]: p }));

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchQuery("");
  };

  const handleSelect = (row) => {
    const next = {
      skillId: row.skillId,
      skillName: row.skillName,
      alias: isAliasTab ? row.alias : null,
      similarity: row.similarity,
    };
    setSelectedRow(next);
    onMapClick?.(next);
  };

  const headers = [
    "Skill Name",
    ...(isAliasTab ? ["Matched Alias"] : []),
    "Similarity %",
    "Action",
  ];
  const columns = [
    "skillName",
    ...(isAliasTab ? ["alias"] : []),
    "similarity",
    "action",
  ];

  const rows = pagedData.map((row, idx) => {
    const isSelected =
      selectedRow?.skillName === row.skillName &&
      (!isAliasTab || selectedRow?.alias === row.alias);

    return {
      id: `${row.skillName}-${row.alias || ""}-${idx}`,
      skillName: <span className="text-slate-900 font-semibold">{row.skillName}</span>,
      alias: (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
          <Tag size={10} />
          {row.alias}
        </span>
      ),
      similarity: <SimilarityBadge score={row.similarity} />,
      action: (
        <Button
          variant={isSelected ? "primary" : "outline"}
          size="small"
          onClick={() => handleSelect(row)}
        >
          {isSelected ? "Selected" : "Map"}
        </Button>
      ),
      rowClass: isSelected ? "!bg-blue-50" : undefined,
    };
  });

  return (
    <Card>
      {/* Section label + search bar */}
      <div className="flex items-center gap-3 px-5 py-2.5">
        <div className="shrink-0">
          <h2 className="text-[14px] font-bold text-slate-800">Suggestion Matches</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Review match suggestions below, then use an action above to resolve this unknown skill.
          </p>
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search canonical skills or aliases…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-[13px] outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-200 overflow-x-auto">
        {MAP_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className="px-3 py-2.5 text-[13px] font-semibold relative whitespace-nowrap shrink-0"
            style={{ color: activeTab === t.id ? "#2563EB" : "#98A1AF" }}
          >
            {t.label}
            {activeTab === t.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-blue-600" />
            )}
          </button>
        ))}
      </div>

      {/* Loading indicator — only for the active tab */}
      {isLoading && (
        <div className="py-12">
          <LoadingSpinner text="Loading suggestions…" />
        </div>
      )}

      {/* Error state — active tab only */}
      {!isLoading && loadError && (
        <ErrorState message="We couldn't load these suggestions. Please try again." />
      )}

      {/* Table */}
      {!isLoading && !loadError && (
        <>
          {pagedData.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-[12.5px]">
              No suggestions found.
            </div>
          ) : (
            <div className="p-4">
              <GenericTable headers={headers} columns={columns} rows={rows} />
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPrevious={() => setPage(Math.max(1, currentPage - 1))}
            onNext={() => setPage(Math.min(totalPages, currentPage + 1))}
          />
        </>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UnknownSkillDetailPage() {
  const { unknownSkillId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Which modal is open: "create" | "map" | "delete" | null
  const [openModal, setOpenModal] = useState(null);
  // Suggestion row the user clicked "Map" on — feeds the Map modal's payload
  const [mapTarget, setMapTarget] = useState(null);

  const skill = useMemo(
    () =>
      location.state?.skill || {
        id: unknownSkillId,
        rawSkill: "azure databricks",
        normalizedKey: "azure_databricks",
        frequency: 42,
        firstSeen: "2024-09-12T00:00:00Z",
        lastSeen: "2025-06-01T00:00:00Z",
        status: "PENDING",
      },
    [location.state, unknownSkillId]
  );

  const closeModal = () => {
    setOpenModal(null);
    setMapTarget(null);
  };

  const handleDeleted = () => {
    closeModal();
    navigate("/ai-screening/skill-ontology", { state: { tab: "unknown" } });
  };

  const handleMapped = () => {
    closeModal();
    navigate("/ai-screening/skill-ontology", { state: { tab: "unknown" } });
  };

  const handleCreated = () => {
    closeModal();
    navigate("/ai-screening/skill-ontology", { state: { tab: "unknown" } });
  };

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">

      {/* ── Summary Card ─────────────────────────────────────────────────── */}
      <Card className="p-5 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-4">

          {/* Left: back button + skill info */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <button
              onClick={() =>
                navigate("/ai-screening/skill-ontology", { state: { tab: "unknown" } })
              }
              className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition shadow-sm shrink-0"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="flex-1 min-w-0">
              {/* Title + status badges */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div className="font-extrabold text-[17px] text-slate-900">
                  {skill.rawSkill}
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                  {skill.status}
                </span>
                <Badge className="bg-amber-50 text-amber-700 border-amber-100 font-semibold px-2.5 py-0.5 text-[11px]">
                  Unverified
                </Badge>
              </div>

              {/* Meta */}
              <div className="text-[12px] text-slate-500 mb-4 flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  <span className="font-medium text-slate-700">Normalized Key: </span>
                  {skill.normalizedKey}
                </span>
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-1">
                  <Calendar size={11} className="text-slate-400" />
                  First seen {formatDate(skill.firstSeen)}
                </span>
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-1">
                  <Calendar size={11} className="text-slate-400" />
                  Last seen {formatDate(skill.lastSeen)}
                </span>
              </div>

              {/* Stat blocks */}
              <div className="flex gap-6 flex-wrap">
                {[
                  { icon: Sparkles, label: "Frequency", value: skill.frequency ?? 0, color: "text-indigo-600 bg-indigo-50" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">{label}</div>
                      <div className="text-[14px] font-bold text-slate-900">{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: action buttons — each opens its own modal */}
          <div className="flex flex-col gap-2 shrink-0">
            <ActionToggleButton
              icon={Plus}
              label="Create New Canonical Skill"
              active={openModal === "create"}
              color="create"
              onClick={() => setOpenModal("create")}
            />
            <ActionToggleButton
              icon={Trash2}
              label="Delete Unknown Skill"
              active={openModal === "delete"}
              color="delete"
              onClick={() => setOpenModal("delete")}
            />
          </div>
        </div>
      </Card>

      {/* ── Suggestion Tabs – always visible ──────────────────────────────── */}
      <div className="mb-2">
        <SuggestionTabsSection
          unknownSkillId={skill.id}
          onMapClick={(row) => {
            setMapTarget(row);
            setOpenModal("map");
          }}
        />
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Create New Canonical Skill */}
      <Modal
        isOpen={openModal === "create"}
        onClose={closeModal}
        title="Create New Canonical Skill"
        subtitle={`Resolving: "${skill.rawSkill}"`}
        size="2xl"
        animation="zoom"
        titleIcon={<Plus className="h-5 w-5" />}
        maxHeight="max-h-[90vh]"
      >
        <CreateSkillModalBody
          rawSkill={skill.rawSkill}
          unknownSkillId={skill.id}
          onClose={closeModal}
          onCreated={handleCreated}
        />
      </Modal>

      {/* Map to Existing Skill */}
      <Modal
        isOpen={openModal === "map"}
        onClose={closeModal}
        title="Map to Existing Skill"
        subtitle={`Resolving: "${skill.rawSkill}"`}
        size="2xl"
        animation="zoom"
        titleIcon={<GitMerge className="h-5 w-5" />}
        maxHeight="max-h-[90vh]"
      >
        <MapSkillModalBody
          rawSkill={skill.rawSkill}
          unknownSkillId={skill.id}
          target={mapTarget}
          onClose={closeModal}
          onMapped={handleMapped}
        />
      </Modal>

      {/* Delete Unknown Skill */}
      <Modal
        isOpen={openModal === "delete"}
        onClose={closeModal}
        title="Delete Unknown Skill"
        size="sm"
        animation="zoom"
        titleIcon={<Trash2 className="h-5 w-5 text-rose-500" />}
        maxHeight="max-h-[90vh]"
      >
        <DeleteSkillModalBody rawSkill={skill.rawSkill} unknownSkillId={skill.id} onClose={closeModal} onDeleted={handleDeleted} />
      </Modal>
    </div>
  );
}
