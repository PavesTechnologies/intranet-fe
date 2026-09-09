import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAirsStore } from "./airsStore";
import { getJDById, exportSingleJD, downloadJDById, getJDSkills, getJDUnknownSkills } from "../service/jdservice";
import { useAuth } from "../../../contexts/AuthContext";
import {
  ArrowLeft,
  Briefcase,
  Download,
  Clock,
  GitBranch,
  GitMerge,
  History,
  Activity,
  Layers,
  Settings,
  AlertTriangle,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  Edit2,
  RefreshCw,
  Eye,
  FileText,
  Search,
  Calendar
} from "lucide-react";
import { toast } from "react-toastify";
import LoadingSpinner from "../../../components/LoadingSpinner";
import Button from "../../../components/Button/Button";
import Modal from "../../../components/ui/Modal";
import SkillActionModal from "../../../components/Modal/modal";
import FormInput from "../../../components/forms/FormInput";
import NewCampaignForm from "../campaigns/components/NewCampaignForm";
import { createCampaign, getAllCampaigns, getPipelineSummary, formatApiError } from "../campaigns/services/campaignservice";
import Pagination from "../../../components/Pagination/pagination";
import GenericTable from "../../../components/Table/table";
import {
  CreateSkillModalBody,
  MapSkillModalBody,
  DeleteSkillModalBody,
  SuggestionTabsSection,
} from "../skill-ontology/UnknownSkillDetailPage";
import { bulkApproveUnknownSkills, bulkDeleteUnknownSkills } from "../skill-ontology/services/skillOntologyService";

const DEFAULT_CAMPAIGN_FORM = {
  name: "",
  max_candidates: 1,
  deadline: "",
  weight_deterministic: 30,
  weight_semantic: 40,
  weight_ai: 30,
  semantic_threshold: 0.65,
  ai_threshold: 50,
  deterministic_threshold: 70,
  hiring_manager_id: "",
  recruiter_id: "",
  prompt_template_id: "",
  ai_evaluate_prompt_id: "",
};

const STATUS_BADGE = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PAUSED: "bg-amber-50 text-amber-700",
  CLOSED: "bg-slate-100 text-slate-600",
  DRAFT: "bg-slate-100 text-slate-700",
};

// Title-case a status enum for display, e.g. "ACTIVE" -> "Active"
const statusLabel = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—";

// extracted_json's certification/skill entries are sometimes plain strings and
// sometimes objects (e.g. { name, importance }) depending on the parser
// version — pull out a renderable label either way instead of passing the
// raw value (possibly an object) straight into JSX.
const entryLabel = (entry) =>
  typeof entry === "string" ? entry : entry?.name || entry?.skill_name || entry?.skill || "";

// Reduce a pipeline-summary payload into the three headline counts the card shows.
const deriveCampaignStats = (summary) => {
  const stageCount = (key) =>
    (summary?.stages || []).find((s) => s.stage === key)?.count ?? 0;
  return {
    candidates: summary?.total_candidates ?? 0,
    shortlisted: stageCount("SHORTLISTED"),
    selected: stageCount("SELECTED"),
  };
};

export default function JdDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { jds, campaigns, updateJd, restoreJdVersion, addCampaign } = useAirsStore();
  const { hasRole } = useAuth();
  const isHRAdmin = hasRole(["HR_ADMIN"]);
  const canViewPipeline = hasRole(["HR_ADMIN", "RECRUITER"]);

  const jd = jds.find((j) => j.id === id);

  const [jdDetail, setJdDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    const fetchJd = async () => {
      setIsLoading(true);
      try {
        const res = await getJDById(id);
        const data = res.data
        if (data) {
          setJdDetail(data);
        }
      } catch (err) {
        toast.error("Failed to load job description from server.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchJd();
  }, [id]);

  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadJD = async () => {
    try {
      setIsDownloading(true);

      const response = await downloadJDById(currentJd.id);

      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/octet-stream",
      });

      const url = window.URL.createObjectURL(blob);

      let filename = "Job_Description";

      const disposition = response.headers["content-disposition"];

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);

        if (match) {
          filename = match[1];
        }
      }

      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

      toast.success("Job Description downloaded successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to download Job Description.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportJD = async () => {
    try {
      setIsExporting(true);

      const response = await exportSingleJD(currentJd.id);

      const blob = new Blob([response.data], {
        type:
          response.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);

      let filename = "Job_Description.xlsx";

      const disposition =
        response.headers["content-disposition"];

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);

        if (match) {
          filename = match[1];
        }
      }

      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

      toast.success("Job Description exported successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export Job Description.");
    } finally {
      setIsExporting(false);
    }
  };

  // Tabs: overview, skills, campaigns, versions, audit
  const [activeTab, setActiveTab] = useState("overview");

  const [dbCampaigns, setDbCampaigns] = useState([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [campaignSearchQuery, setCampaignSearchQuery] = useState("");
  const [campaignCurrentPage, setCampaignCurrentPage] = useState(1);
  const campaignsPerPage = 6;

  const filteredCampaigns = useMemo(() => {
    return dbCampaigns.filter(c => {
      const query = campaignSearchQuery.toLowerCase();
      return (
        (c.name || "").toLowerCase().includes(query) ||
        (c.jd_title || "").toLowerCase().includes(query) ||
        (c.hiring_manager || "").toLowerCase().includes(query)
      );
    });
  }, [dbCampaigns, campaignSearchQuery]);

  const paginatedCampaigns = useMemo(() => {
    const startIndex = (campaignCurrentPage - 1) * campaignsPerPage;
    return filteredCampaigns.slice(startIndex, startIndex + campaignsPerPage);
  }, [filteredCampaigns, campaignCurrentPage]);

  const totalCampaignPages = useMemo(() => {
    return Math.ceil(filteredCampaigns.length / campaignsPerPage) || 1;
  }, [filteredCampaigns]);

  // Real candidate metrics per card come from the pipeline-summary endpoint —
  // fetched only for the campaigns visible on the current page, and cached by
  // id so paging back and forth doesn't re-hit the API.
  //   value === undefined -> not fetched yet (loading placeholder)
  //   value === null       -> unavailable (e.g. role can't see the pipeline)
  //   value === object     -> real { candidates, shortlisted, selected }
  const [campaignPipelineStats, setCampaignPipelineStats] = useState({});
  useEffect(() => {
    if (!canViewPipeline) return;
    const missing = paginatedCampaigns
      .map((c) => c.id)
      .filter((cid) => cid && !(cid in campaignPipelineStats));
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(missing.map(async (cid) => {
        try {
          const res = await getPipelineSummary(cid);
          return [cid, deriveCampaignStats(res?.data ?? res)];
        } catch {
          return [cid, null];
        }
      }));
      if (!cancelled) {
        setCampaignPipelineStats((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    })();

    return () => { cancelled = true; };
  }, [paginatedCampaigns, campaignPipelineStats, canViewPipeline]);

  const fetchDbCampaigns = async () => {
    setIsLoadingCampaigns(true);
    try {
      const res = await getAllCampaigns({jd_id: id, show_closed: true});
      if (res?.success && res.data) {
        setDbCampaigns(res.data);
      }
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      toast.error("Failed to load campaigns.");
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  const SKILLS_PAGE_SIZE = 10;

  const [jdSkillsData, setJdSkillsData] = useState([]);
  const [jdUnknownSkillsData, setJdUnknownSkillsData] = useState([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [isLoadingUnknownSkills, setIsLoadingUnknownSkills] = useState(false);

  // Unknown Skill resolution actions — Create / Map / Delete — reuse the same
  // modal bodies, endpoints, and suggestion-tab UI as the Skill Ontology
  // Unknown Skill detail page.
  const [unknownSkillModal, setUnknownSkillModal] = useState(null); // "create" | "suggestions" | "confirmMap" | "delete" | null
  const [activeUnknownSkill, setActiveUnknownSkill] = useState(null);
  const [unknownSkillMapTarget, setUnknownSkillMapTarget] = useState(null);

  const closeUnknownSkillModal = () => {
    setUnknownSkillModal(null);
    setActiveUnknownSkill(null);
    setUnknownSkillMapTarget(null);
  };

  const handleUnknownSkillResolved = () => {
    closeUnknownSkillModal();
    fetchJdUnknownSkills();
  };

  // Bulk Approve / Reject — same bulk endpoints as the Skill Ontology Unknown
  // Skills table, applied across the full unknown-skills list for this JD
  // (not just the current page), keyed by unknown_skill_id.
  const [selectedUnknownSkillIds, setSelectedUnknownSkillIds] = useState(new Set());
  const [bulkConfirmAction, setBulkConfirmAction] = useState(null); // "approve" | "delete" | null
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  useEffect(() => {
    setSelectedUnknownSkillIds((prev) => {
      const visibleIds = new Set(jdUnknownSkillsData.map((s) => s.unknown_skill_id));
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [jdUnknownSkillsData]);

  const allUnknownSkillsSelected =
    jdUnknownSkillsData.length > 0 &&
    jdUnknownSkillsData.every((s) => selectedUnknownSkillIds.has(s.unknown_skill_id));

  const toggleSelectAllUnknownSkills = () => {
    setSelectedUnknownSkillIds(
      allUnknownSkillsSelected ? new Set() : new Set(jdUnknownSkillsData.map((s) => s.unknown_skill_id))
    );
  };

  const toggleUnknownSkillSelection = (unknownSkillId) => {
    setSelectedUnknownSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(unknownSkillId)) next.delete(unknownSkillId);
      else next.add(unknownSkillId);
      return next;
    });
  };

  const closeBulkConfirm = () => {
    if (isBulkSubmitting) return;
    setBulkConfirmAction(null);
  };

  const handleConfirmBulkUnknownSkillAction = async () => {
    const ids = Array.from(selectedUnknownSkillIds);
    setIsBulkSubmitting(true);
    try {
      const action = bulkConfirmAction === "approve" ? bulkApproveUnknownSkills : bulkDeleteUnknownSkills;
      const res = await action(ids);
      const { message, failed = 0, results = [] } = res?.data || {};
      toast.success(message || "Bulk action completed.");
      if (failed > 0) {
        const firstFailure = results.find((r) => !r.success);
        toast.error(`${failed} of ${ids.length} failed${firstFailure ? `: ${firstFailure.message}` : "."}`);
      }
      setSelectedUnknownSkillIds(new Set());
      setBulkConfirmAction(null);
      fetchJdUnknownSkills();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Bulk action failed.");
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // Pagination state — JD Skills
  const [skillsCurrentPage, setSkillsCurrentPage] = useState(1);
  const skillsTotalPages = Math.max(1, Math.ceil(jdSkillsData.length / SKILLS_PAGE_SIZE));
  const paginatedSkills = jdSkillsData.slice(
    (skillsCurrentPage - 1) * SKILLS_PAGE_SIZE,
    skillsCurrentPage * SKILLS_PAGE_SIZE
  );

  // Pagination state — JD Unknown Skills
  const [unknownSkillsCurrentPage, setUnknownSkillsCurrentPage] = useState(1);
  const unknownSkillsTotalPages = Math.max(1, Math.ceil(jdUnknownSkillsData.length / SKILLS_PAGE_SIZE));
  const paginatedUnknownSkills = jdUnknownSkillsData.slice(
    (unknownSkillsCurrentPage - 1) * SKILLS_PAGE_SIZE,
    unknownSkillsCurrentPage * SKILLS_PAGE_SIZE
  );

  const jdSkillsHeaders = [
    <div key="canonical" className="w-full flex justify-start select-none">Canonical Skill</div>,
    <div key="tier" className="w-full flex justify-center select-none">Match Tier</div>,
    <div key="confidence" className="w-full flex justify-center select-none">Confidence</div>,
    <div key="mandatory" className="w-full flex justify-center select-none">Mandatory</div>,
    <div key="status" className="w-full flex justify-center select-none">Status</div>,
    <div key="createdAt" className="w-full flex justify-center select-none">Created Date</div>
  ];

  const jdSkillsColumns = [
    "canonical_name",
    "match_tier",
    "confidence",
    "mandatory",
    "status",
    "created_at"
  ];

  const jdSkillsRows = useMemo(() => {
    return paginatedSkills.map((sk) => {
      return {
        canonical_name: (
          <div className="w-full flex justify-start font-bold text-slate-900">
            {sk.canonical_name}
          </div>
        ),
        match_tier: (
          <div className="w-full flex justify-center">
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100 text-[9px]">
              {sk.match_tier}
            </span>
          </div>
        ),
        confidence: (
          <div className="w-full flex justify-center font-bold text-slate-700">
            {Math.round((sk.confidence || 0) * 100)}%
          </div>
        ),
        mandatory: (
          <div className="w-full flex justify-center">
            <span
              className={`text-[9px] px-2 py-0.5 rounded font-bold border ${
                sk.mandatory
                  ? "bg-blue-50 text-blue-700 border-blue-100"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {sk.mandatory ? "True" : "False"}
            </span>
          </div>
        ),
        status: (
          <div className="w-full flex justify-center">
            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-100">
              {sk.verification_status}
            </span>
          </div>
        ),
        created_at: (
          <div className="w-full flex justify-center text-slate-500">
            {sk.created_at ? sk.created_at.split("T")[0] : ""}
          </div>
        ),
        rowClass: "hover:bg-slate-50/50 transition",
      };
    });
  }, [paginatedSkills, skillsCurrentPage, jdSkillsData]);

  const jdUnknownSkillsHeaders = [
    <div key="select" className="w-full flex justify-center select-none">
      <input
        type="checkbox"
        checked={allUnknownSkillsSelected}
        onChange={toggleSelectAllUnknownSkills}
        className="h-3.5 w-3.5 cursor-pointer accent-indigo-600"
      />
    </div>,
    <div key="rawSkill" className="w-full flex justify-start select-none">Raw Skill</div>,
    <div key="mandatory" className="w-full flex justify-center select-none">Mandatory</div>,
    <div key="status" className="w-full flex justify-center select-none">Status</div>,
    <div key="createdAt" className="w-full flex justify-center select-none">Created Date</div>,
    <div key="action" className="w-full flex justify-center select-none">Action</div>
  ];

  const jdUnknownSkillsColumns = [
    "select",
    "raw_text",
    "mandatory",
    "status",
    "created_at",
    "action"
  ];

  const jdUnknownSkillsRows = useMemo(() => {
    return paginatedUnknownSkills.map((sk) => {
      return {
        select: (
          <div className="w-full flex justify-center">
            <input
              type="checkbox"
              checked={selectedUnknownSkillIds.has(sk.unknown_skill_id)}
              onChange={() => toggleUnknownSkillSelection(sk.unknown_skill_id)}
              className="h-3.5 w-3.5 cursor-pointer accent-indigo-600"
            />
          </div>
        ),
        raw_text: (
          <div className="w-full flex justify-start font-bold text-slate-900">
            {sk.raw_text}
          </div>
        ),
        mandatory: (
          <div className="w-full flex justify-center">
            <span
              className={`text-[9px] px-2 py-0.5 rounded font-bold border ${
                sk.mandatory
                  ? "bg-blue-50 text-blue-700 border-blue-100"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {sk.mandatory ? "True" : "False"}
            </span>
          </div>
        ),
        status: (
          <div className="w-full flex justify-center">
            <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-100">
              {sk.status}
            </span>
          </div>
        ),
        created_at: (
          <div className="w-full flex justify-center text-slate-500">
            {sk.created_at ? sk.created_at.split("T")[0] : ""}
          </div>
        ),
        action: (
          <div className="w-full flex justify-center gap-1.5">
            <Button
              variant="outline"
              size="small"
              title="Create New Canonical Skill"
              onClick={() => {
                setActiveUnknownSkill(sk);
                setUnknownSkillModal("create");
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="small"
              title="Map to Existing Skill"
              onClick={() => {
                setActiveUnknownSkill(sk);
                setUnknownSkillMapTarget(null);
                setUnknownSkillModal("suggestions");
              }}
            >
              <GitMerge className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="danger"
              size="small"
              title="Delete Unknown Skill"
              onClick={() => {
                setActiveUnknownSkill(sk);
                setUnknownSkillModal("delete");
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
        rowClass: "hover:bg-slate-50/50 transition",
      };
    });
  }, [paginatedUnknownSkills, unknownSkillsCurrentPage, jdUnknownSkillsData, selectedUnknownSkillIds]);

  const fetchJdSkills = async () => {
    setIsLoadingSkills(true);
    setSkillsCurrentPage(1);
    try {
      const res = await getJDSkills(id);
      if (res?.success && res.data) {
        setJdSkillsData(res.data);
      }
    } catch (err) {
      console.error("Failed to load JD skills:", err);
    } finally {
      setIsLoadingSkills(false);
    }
  };

  const fetchJdUnknownSkills = async () => {
    setIsLoadingUnknownSkills(true);
    setUnknownSkillsCurrentPage(1);
    try {
      const res = await getJDUnknownSkills(id);
      if (res?.success && res.data) {
        setJdUnknownSkillsData(res.data);
      }
    } catch (err) {
      console.error("Failed to load JD unknown skills:", err);
    } finally {
      setIsLoadingUnknownSkills(false);
    }
  };

  useEffect(() => {
    if (activeTab === "campaigns") {
      fetchDbCampaigns();
    } else if (activeTab === "jd_skills") {
      fetchJdSkills();
    } else if (activeTab === "jd_unknown_skills") {
      fetchJdUnknownSkills();
    }
  }, [activeTab]);

  // Skills Editing state
  const [editingSkillIdx, setEditingSkillIdx] = useState(null);
  const [editedSkillWeight, setEditedSkillWeight] = useState(0);
  const [editedSkillConfidence, setEditedSkillConfidence] = useState(0);

  // Version Comparing state
  const [compareVersionNumber, setCompareVersionNumber] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [restoreConfirmVersion, setRestoreConfirmVersion] = useState(null);

  // Campaign Initiation state
  const [linkCampaignModalOpen, setLinkCampaignModalOpen] = useState(false);
  const [isSubmittingCampaign, setIsSubmittingCampaign] = useState(false);
  const [campaignForm, setCampaignForm] = useState(DEFAULT_CAMPAIGN_FORM);

  if (isLoading) {
    return (
      <div className="text-center min-h-screen flex flex-col justify-center items-center">
        <LoadingSpinner text="Job Description details..."></LoadingSpinner>
      </div>
    );
  }

  const currentJd = jdDetail || jd;

  if (!currentJd) {
    return (
      <div className="p-8 text-center bg-[#F8FAFC] min-h-screen flex flex-col justify-center items-center">
        <AlertTriangle className="h-12 w-12 text-rose-500 mb-4" />
        <h2 className="text-lg font-bold text-slate-800">Job Description Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">The requested JD does not exist or has been deleted.</p>
        <Link to="/ai-screening/jds" className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg">
          Back to Library
        </Link>
      </div>
    );
  }

  const version = currentJd.version || currentJd.version_number || 1;
  const title = currentJd.title || "";
  const rawText = currentJd.rawText || currentJd.raw_text || "";
  const jurisdiction = currentJd.jurisdiction || "";
  const experience = currentJd.experience || (currentJd.min_experience_years !== null && currentJd.min_experience_years !== undefined ? `${currentJd.min_experience_years} years` : "Not Specified");
  const education = currentJd.education || (currentJd.education_criteria ? `${currentJd.education_criteria.degree || ""} in ${currentJd.education_criteria.field || ""}` : "Not Specified");
  const source = currentJd.source || (currentJd.source_format === "TEXT" ? "Manual" : currentJd.source_format === "PDF" ? "PDF Upload" : currentJd.source_format === "DOCX" ? "DOCX Upload" : currentJd.source_format || "Manual");
  const status = currentJd.status || currentJd.is_verified || (currentJd.is_active_version ? "Ready" : "Closed");
  const isJdCampaignEligible = currentJd.is_active_version && (currentJd.is_verified || "").toUpperCase() === "VERIFIED";
  const createdBy = currentJd.createdBy || currentJd.created_by || "System";
  const createdDate = currentJd.createdDate || (currentJd.created_at ? currentJd.created_at.split('T')[0] : "");
  const updatedDate = currentJd.updatedDate || (currentJd.updated_at ? currentJd.updated_at.split('T')[0] : createdDate);
  const confidence = currentJd.confidence !== undefined ? currentJd.confidence : null;
  const campaignCount = currentJd.campaignCount !== undefined ? currentJd.campaignCount : 0;
  const historyList = currentJd.history || [];

  // Skills mapper
  const skillsList = (() => {
    if (currentJd.skills) return currentJd.skills;
    let rawSkills = currentJd.parsed_skills || currentJd.required_skills || [];
    if (rawSkills && typeof rawSkills === "object" && !Array.isArray(rawSkills)) {
      const required = Array.isArray(rawSkills.required) ? rawSkills.required : [];
      const preferred = Array.isArray(rawSkills.preferred) ? rawSkills.preferred : [];
      const reqMapped = required.map(sk => {
        if (typeof sk === "string") return { name: sk, mandatory: true, verified: true, weight: 15, confidence: 90, mappedTo: sk, mappingType: "Alias" };
        return {
          name: sk.name || sk.skill_name || sk.skill || "",
          mandatory: true,
          verified: sk.verified !== undefined ? sk.verified : true,
          weight: sk.weight !== undefined ? sk.weight : 15,
          confidence: sk.confidence !== undefined ? sk.confidence : 90,
          mappedTo: sk.mappedTo || sk.mapped_to || sk.name || sk.skill || "",
          mappingType: sk.mappingType || sk.mapping_type || "Alias"
        };
      });
      const prefMapped = preferred.map(sk => {
        if (typeof sk === "string") return { name: sk, mandatory: false, verified: true, weight: 15, confidence: 90, mappedTo: sk, mappingType: "Alias" };
        return {
          name: sk.name || sk.skill_name || sk.skill || "",
          mandatory: false,
          verified: sk.verified !== undefined ? sk.verified : true,
          weight: sk.weight !== undefined ? sk.weight : 15,
          confidence: sk.confidence !== undefined ? sk.confidence : 90,
          mappedTo: sk.mappedTo || sk.mapped_to || sk.name || sk.skill || "",
          mappingType: sk.mappingType || sk.mapping_type || "Alias"
        };
      });
      return [...reqMapped, ...prefMapped];
    }
    if (!Array.isArray(rawSkills)) {
      rawSkills = [];
    }
    return rawSkills.map((sk) => {
      if (typeof sk === "string") {
        return {
          name: sk,
          mandatory: false,
          verified: true,
          weight: 15,
          confidence: 90,
          mappedTo: sk,
          mappingType: "Alias"
        };
      }
      return {
        name: sk.name || sk.skill_name || sk.skill || "",
        mandatory: sk.mandatory || sk.is_mandatory || false,
        verified: sk.verified !== undefined ? sk.verified : true,
        weight: sk.weight !== undefined ? sk.weight : 15,
        confidence: sk.confidence !== undefined ? sk.confidence : 90,
        mappedTo: sk.mappedTo || sk.mapped_to || sk.name || sk.skill || "",
        mappingType: sk.mappingType || sk.mapping_type || "Alias"
      };
    });
  })();

  // --- Skills Tab Handlers ---
  const handleToggleVerifySkill = (index) => {
    const updatedSkills = [...skillsList];
    updatedSkills[index].verified = !updatedSkills[index].verified;
    setJdDetail(prev => ({ ...prev, skills: updatedSkills }));
    updateJd(id, { skills: updatedSkills });
    toast.success(`Skill '${updatedSkills[index].name}' verification status toggled.`);
  };

  const handleDeleteSkill = (index) => {
    const updatedSkills = skillsList.filter((_, idx) => idx !== index);
    setJdDetail(prev => ({ ...prev, skills: updatedSkills }));
    updateJd(id, { skills: updatedSkills });
    toast.success("Skill removed from JD profile.");
  };

  const handleEditSkillStart = (index) => {
    setEditingSkillIdx(index);
    setEditedSkillWeight(skillsList[index].weight);
    setEditedSkillConfidence(skillsList[index].confidence);
  };

  const handleEditSkillSave = (index) => {
    const updatedSkills = [...skillsList];
    updatedSkills[index].weight = Number(editedSkillWeight);
    updatedSkills[index].confidence = Number(editedSkillConfidence);
    setJdDetail(prev => ({ ...prev, skills: updatedSkills }));
    updateJd(id, { skills: updatedSkills });
    setEditingSkillIdx(null);
    toast.success("Skill parameters updated successfully.");
  };

  const handleReplaceSkill = (index) => {
    const newName = prompt("Replace skill with standard canonical name:", skillsList[index].name);
    if (!newName) return;

    const updatedSkills = [...skillsList];
    updatedSkills[index].name = newName;
    updatedSkills[index].mappedTo = newName;
    updatedSkills[index].verified = true;
    updatedSkills[index].mappingType = "Alias";

    setJdDetail(prev => ({ ...prev, skills: updatedSkills }));
    updateJd(id, { skills: updatedSkills });
    toast.success(`Replaced with canonical: ${newName}`);
  };

  // --- Campaign Handlers ---
  const handleCampaignFormChange = (e) => {
    const { name, value } = e.target;
    setCampaignForm(prev => ({ ...prev, [name]: value }));
  };

  const handleInitiateCampaign = async () => {
    const trimmedName = campaignForm.name.trim();
    if (!trimmedName) {
      toast.error("Campaign name cannot be empty.");
      return;
    }
    if (trimmedName.length > 255) {
      toast.error("Campaign name must be 255 characters or fewer.");
      return;
    }
    if (!campaignForm.hiring_manager_id.trim()) {
      toast.error("Please enter a hiring manager ID.");
      return;
    }
    if (!campaignForm.recruiter_id.trim()) {
      toast.error("Please enter a recruiter ID.");
      return;
    }
    if (!String(campaignForm.prompt_template_id).trim()) {
      toast.error("Please select a Resume Parsing Prompt.");
      return;
    }
    if (!String(campaignForm.ai_evaluate_prompt_id || "").trim()) {
      toast.error("Please select an AI Evaluation Prompt.");
      return;
    }
    if (campaignForm.max_candidates !== "" && campaignForm.max_candidates !== null && Number(campaignForm.max_candidates) <= 0) {
      toast.error("Max candidates must be greater than 0.");
      return;
    }
    const weightsSum = Number(campaignForm.weight_deterministic) + Number(campaignForm.weight_semantic) + Number(campaignForm.weight_ai);
    if (Math.abs(weightsSum - 100) > 0.01) {
      toast.error("Scoring weights must sum to 100.00");
      return;
    }

    const payload = {
      name: trimmedName,
      jd_id: id,
      max_candidates: campaignForm.max_candidates === "" || campaignForm.max_candidates === null ? null : Number(campaignForm.max_candidates),
      deadline: campaignForm.deadline ? new Date(campaignForm.deadline).toISOString() : null,
      weight_deterministic: Number(campaignForm.weight_deterministic),
      weight_semantic: Number(campaignForm.weight_semantic),
      weight_ai: Number(campaignForm.weight_ai),
      semantic_threshold: Number(campaignForm.semantic_threshold),
      ai_threshold: Number(campaignForm.ai_threshold),
      deterministic_threshold: Number(campaignForm.deterministic_threshold),
      hiring_manager_id: campaignForm.hiring_manager_id.trim(),
      recruiter_id: campaignForm.recruiter_id.trim(),
      prompt_template_id: String(campaignForm.prompt_template_id || "").trim(),
      ai_evaluate_prompt_id: String(campaignForm.ai_evaluate_prompt_id || "").trim(),
    };

    setIsSubmittingCampaign(true);
    try {
      const response = await createCampaign(payload);
      if (response?.success === false) {
        toast.error(response.message || "Failed to initiate campaign.");
        return;
      }
      const created = response?.data || response;
      const nextCount = campaignCount + 1;
      setJdDetail(prev => ({ ...prev, campaignCount: nextCount }));
      addCampaign({
        id: created?.id || created?.campaign_id || `CMP-${String(campaigns.length + 1).padStart(3, "0")}`,
        name: payload.name,
        status: "Active",
        candidates: 0,
        createdDate: new Date().toISOString().split("T")[0]
      });
      toast.success(response?.message || "Campaign initiated successfully.");
      setLinkCampaignModalOpen(false);
      setCampaignForm(DEFAULT_CAMPAIGN_FORM);
      fetchDbCampaigns();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to initiate campaign."));
    } finally {
      setIsSubmittingCampaign(false);
    }
  };

  // --- Versioning Compare diff simulator ---
  const getDiffText = (oldText, newText) => {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");

    // Simplistic diff render for prototype showing green/red lines
    return (
      <div className="grid grid-cols-2 gap-4 text-xs font-mono h-[350px] overflow-y-auto border rounded-lg bg-slate-50 p-4">
        {/* Old Version Column */}
        <div className="space-y-1 border-r pr-4">
          <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-2">Older Version</h4>
          {oldLines.map((line, i) => {
            const hasChanged = !newLines.includes(line);
            return (
              <div key={i} className={`p-0.5 rounded leading-relaxed ${hasChanged ? "bg-rose-100 text-rose-800 border-l-2 border-rose-500 font-bold" : "text-slate-600"}`}>
                {line || " "}
              </div>
            );
          })}
        </div>
        {/* Current/New Version Column */}
        <div className="space-y-1 pl-2">
          <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-2">Active Version</h4>
          {newLines.map((line, i) => {
            const hasChanged = !oldLines.includes(line);
            return (
              <div key={i} className={`p-0.5 rounded leading-relaxed ${hasChanged ? "bg-emerald-100 text-emerald-800 border-l-2 border-emerald-500 font-bold" : "text-slate-700"}`}>
                {line || " "}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleRestoreConfirm = () => {
    if (restoreConfirmVersion) {
      restoreJdVersion(id, restoreConfirmVersion);
      toast.success(`Successfully rolled back JD to version ${restoreConfirmVersion}`);
      setRestoreConfirmVersion(null);
      const restored = jds.find(j => j.id === id);
      if (restored) {
        setJdDetail(restored);
      }
    }
  };

  // Readiness checklist check
  const isJdReady = skillsList.length > 0 && skillsList.every((s) => s.verified);

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">

      {/* Profile Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition shadow-sm shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{title}</h1>
              <span className="text-slate-400 text-xs font-semibold font-mono">Version {version}</span>
              {confidence !== null && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 uppercase text-[9px] font-bold">
                  AI confidence {confidence}%
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Created by {createdBy} on {createdDate}</p>
          </div>
        </div>

        {/* Readiness Checklist Status Indicator */}
        <div className="flex items-center gap-3">
          {/* <div className="text-center shrink-0 pr-4 border-r border-slate-200">
            <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Hiring Readiness</span>
            {isJdReady ? (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 font-black px-3 py-1 rounded-full text-xs">
                <Check className="h-3.5 w-3.5" /> READY
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-black px-3 py-1 rounded-full text-xs">
                <AlertTriangle className="h-3.5 w-3.5 animate-pulse" /> NOT READY
              </span>
            )}
          </div>
          <div className="space-y-1 text-[10px] font-bold text-slate-500 pl-2">
            <div className="flex items-center gap-1">
              <span className="text-emerald-500">✔</span> Raw Text Extracted
            </div>
            <div className="flex items-center gap-1">
              <span className="text-emerald-500">✔</span> Taxonomy Map Done
            </div>
            <div className="flex items-center gap-1">
              {isJdReady ? <span className="text-emerald-500">✔</span> : <span className="text-amber-500">⚠</span>}
              Skills Verification Check
            </div>
          </div> */}
          <Button
            variant="primary"
            size="medium"
            onClick={handleExportJD}
            title="Export JD"
            disabled={isExporting}
            loading={isExporting}
            loadingText="Exporting..."
          >
            <Download className="h-4 w-4" /> Export JD
          </Button>
          {isHRAdmin && (
            <Button
              variant="secondary"
              size="medium"
              onClick={handleDownloadJD}
              title="Download JD"
              disabled={isDownloading}
              loading={isDownloading}
              loadingText="Downloading..."
            >
              <Download className="h-4 w-4" /> Download JD
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 mb-6 gap-6 overflow-x-auto whitespace-nowrap scrollbar-none">
        {[
          { id: "overview", label: "Overview" },
          { id: "extracted_json", label: "Extracted JSON" },
          { id: "jd_skills", label: "JD Skill" },
          { id: "jd_unknown_skills", label: "JD Unknown Skills" },
          { id: "campaigns", label: "Campaigns" },
          { id: "versions", label: "Version History" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id);
              setCompareMode(false);
            }}
            className={`pb-3 text-xs font-bold border-b-2 transition ${activeTab === t.id
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* --- OVERVIEW TAB --- */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Raw Scrollable Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3">Extracted Raw Text</h3>
              <div className="max-h-[350px] overflow-y-auto border border-slate-100 rounded-lg p-4 bg-slate-50 font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {rawText}
              </div>
            </div>
          </div>

          {/* Quick stats side panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 h-fit">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b pb-2 mb-2">JD Specifications</h3>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Jurisdiction (Region)</span>
                <span className="text-xs font-bold text-slate-800">{jurisdiction}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Experience Requirement</span>
                <span className="text-xs font-bold text-slate-800">{experience}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Education Minimum</span>
                <span className="text-xs font-bold text-slate-800">{education}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">System Source</span>
                <span className="text-xs font-bold text-slate-800">{source}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                <span className="inline-block mt-0.5 bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px] border border-blue-100">
                  {status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- EXTRACTED JSON TAB --- */}
      {activeTab === "extracted_json" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          <div className="lg:col-span-2 space-y-6">
            {currentJd.extracted_json ? (
              <>
                {/* Meta details cards */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b pb-2.5 mb-4">Extracted Metadata</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Location</span>
                      <span className="text-xs font-bold text-slate-800">{currentJd.extracted_json.location || "Not Specified"}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Work Mode</span>
                      <span className="text-xs font-bold text-slate-800 capitalize">{currentJd.extracted_json.work_mode || "Not Specified"}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Employment Type</span>
                      <span className="text-xs font-bold text-slate-800 capitalize">{currentJd.extracted_json.employment_type || "Not Specified"}</span>
                    </div>
                  </div>
                </div>

                {/* Requirements details */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b pb-2.5 mb-4">Education & Experience Criteria</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">Education Requirements</h4>
                      {currentJd.extracted_json.education ? (
                        <div className="space-y-1 text-xs">
                          <p><span className="font-semibold text-slate-500">Degree:</span> <span className="font-bold text-slate-800 capitalize">{currentJd.extracted_json.education.degree || "Any"}</span></p>
                          <p><span className="font-semibold text-slate-500">Field of Study:</span> <span className="font-bold text-slate-800">{currentJd.extracted_json.education.field || "Any"}</span></p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">Not Specified</p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">Experience Requirements</h4>
                      {currentJd.extracted_json.experience ? (
                        <div className="space-y-1 text-xs">
                          <p><span className="font-semibold text-slate-500">Minimum:</span> <span className="font-bold text-slate-800">{currentJd.extracted_json.experience.min_experience_years !== null && currentJd.extracted_json.experience.min_experience_years !== undefined ? `${currentJd.extracted_json.experience.min_experience_years} years` : "No Min"}</span></p>
                          <p><span className="font-semibold text-slate-500">Maximum:</span> <span className="font-bold text-slate-800">{currentJd.extracted_json.experience.max_experience_years !== null && currentJd.extracted_json.experience.max_experience_years !== undefined ? `${currentJd.extracted_json.experience.max_experience_years} years` : "No Max"}</span></p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">Not Specified</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Certifications & Skills summary */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b pb-2.5 mb-4">Certifications & Skills Arrays</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">Extracted Certifications</h4>
                      {currentJd.extracted_json.certifications && currentJd.extracted_json.certifications.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {currentJd.extracted_json.certifications.map((cert, index) => (
                            <span key={index} className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold text-slate-700">
                              {entryLabel(cert)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">None extracted.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">Required Skills</h4>
                        {currentJd.extracted_json.required_skills && currentJd.extracted_json.required_skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {currentJd.extracted_json.required_skills.map((skill, index) => (
                              <span key={index} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-bold">
                                {entryLabel(skill)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic">None extracted.</p>
                        )}
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">Preferred Skills</h4>
                        {currentJd.extracted_json.preferred_skills && currentJd.extracted_json.preferred_skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {currentJd.extracted_json.preferred_skills.map((skill, index) => (
                              <span key={index} className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded font-bold">
                                {entryLabel(skill)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic">None extracted.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Responsibilities */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b pb-2.5 mb-4">Extracted Responsibilities</h3>
                  {currentJd.extracted_json.responsibilities && currentJd.extracted_json.responsibilities.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-2 text-xs text-slate-700 font-medium">
                      {currentJd.extracted_json.responsibilities.map((resp, index) => (
                        <li key={index} className="leading-relaxed">{resp}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No responsibilities extracted.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs font-semibold shadow-sm">
                No extracted JSON metadata available for this Job Description.
              </div>
            )}
          </div>

          {/* Right Column: Code block */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-fit">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b pb-2 mb-3">Extracted JSON Data</h3>
            {currentJd.extracted_json ? (
              <pre className="text-[10px] font-mono bg-slate-950 text-slate-200 p-4 rounded-lg overflow-x-auto max-h-[550px] leading-relaxed select-all">
                {JSON.stringify(currentJd.extracted_json, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-slate-400 italic">No JSON payload to render.</p>
            )}
          </div>
        </div>
      )}

      {/* --- JD SKILLS TAB --- */}
      {activeTab === "jd_skills" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-fadeIn">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">JD Skill</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Vector-mapped skills extracted and matched from the job description taxonomy.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoadingSkills ? (
              <div className="h-40 flex items-center justify-center">
                <LoadingSpinner text="Loading JD skills..." />
              </div>
            ) : jdSkillsData.length === 0 ? (
              <div className="p-12 text-center text-slate-405 text-xs font-semibold">
                No JD skills found.
              </div>
            ) : (
              <GenericTable
                headers={jdSkillsHeaders}
                columns={jdSkillsColumns}
                rows={jdSkillsRows}
                loading={isLoadingSkills}
              />
            )}
          </div>
          <Pagination
            currentPage={skillsCurrentPage}
            totalPages={skillsTotalPages}
            onPrevious={() => setSkillsCurrentPage((p) => Math.max(1, p - 1))}
            onNext={() => setSkillsCurrentPage((p) => Math.min(skillsTotalPages, p + 1))}
          />
        </div>
      )}

      {/* --- JD UNKNOWN SKILLS TAB --- */}
      {activeTab === "jd_unknown_skills" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-fadeIn">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">JD Unknown Skills</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">These skills were extracted but do not map to standard canonical database values.</p>
            </div>
          </div>

          {selectedUnknownSkillIds.size > 0 && (
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-blue-100 bg-blue-50">
              <span className="text-[12.5px] font-semibold text-blue-700">{selectedUnknownSkillIds.size} selected</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="small" onClick={() => setSelectedUnknownSkillIds(new Set())}>
                  Clear
                </Button>
                <Button variant="danger" size="small" onClick={() => setBulkConfirmAction("delete")}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Reject Selected
                </Button>
                <Button variant="primary" size="small" onClick={() => setBulkConfirmAction("approve")}>
                  <Check className="h-3.5 w-3.5" />
                  Approve Selected
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            {isLoadingUnknownSkills ? (
              <div className="h-40 flex items-center justify-center">
                <LoadingSpinner text="Loading JD unknown skills..." />
              </div>
            ) : jdUnknownSkillsData.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs font-semibold">
                No JD unknown skills found.
              </div>
            ) : (
              <GenericTable
                headers={jdUnknownSkillsHeaders}
                columns={jdUnknownSkillsColumns}
                rows={jdUnknownSkillsRows}
                loading={isLoadingUnknownSkills}
              />
            )}
          </div>
          <Pagination
            currentPage={unknownSkillsCurrentPage}
            totalPages={unknownSkillsTotalPages}
            onPrevious={() => setUnknownSkillsCurrentPage((p) => Math.max(1, p - 1))}
            onNext={() => setUnknownSkillsCurrentPage((p) => Math.min(unknownSkillsTotalPages, p + 1))}
          />
        </div>
      )}

      {/* --- CAMPAIGNS TAB --- */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          {/* Header row */}
          <div className="flex justify-between items-center bg-slate-50/50 p-5 rounded-xl border border-slate-200">
            {/* Left section: Title */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Campaigns</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">Track sourcing progress across every open requisition.</p>
            </div>

            {/* Center section: Search bar */}
            <div className="flex-1 flex justify-center px-4">
              <div className="relative w-full max-w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={campaignSearchQuery}
                  onChange={(e) => {
                    setCampaignSearchQuery(e.target.value);
                    setCampaignCurrentPage(1); // Reset page on search
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white shadow-sm"
                />
              </div>
            </div>

            {/* Right section: Action Buttons */}
            <div className="flex-1 flex items-center justify-end gap-3">
              <Button
                size="small"
                variant="primary"
                disabled={!isJdCampaignEligible}
                title={!isJdCampaignEligible
                  ?"Campaigns require a verified,active JD - resolve unknown skills first."
                  :undefined}
                onClick={() => {
                  setCampaignForm(DEFAULT_CAMPAIGN_FORM);
                  setLinkCampaignModalOpen(true);
                }}
                className="flex items-center gap-1.5 font-bold shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" /> New campaign
              </Button>
              
            </div>
          </div>

          {/* Campaign Cards Grid */}
          {isLoadingCampaigns ? (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner text="Loading Campaigns...."></LoadingSpinner>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-700">No campaigns found</p>
              <p className="text-[11px] text-slate-400 mt-1">Try resetting your search or create a new campaign to get started.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedCampaigns.map((c, idx) => {
                  const status = (c.status || "").toUpperCase();
                  const managerName = c.hiring_manager || "Unassigned";
                  const initials = String(managerName).substring(0, 2).toUpperCase();

                  const stats = canViewPipeline ? campaignPipelineStats[c.id] : null;
                  const hasStats = stats != null;
                  const progressPercent = hasStats
                    ? c.max_candidates
                      ? Math.min(100, Math.round((stats.selected / c.max_candidates) * 100))
                      : stats.candidates
                        ? Math.min(100, Math.round((stats.selected / stats.candidates) * 100))
                        : 0
                    : 0;

                  return (
                    <div
                      key={c.id || idx}
                      onClick={() => c.id && navigate(`/ai-screening/campaigns/${c.id}`)}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 cursor-pointer hover:border-blue-300 transition"
                    >
                      {/* Title + status */}
                      <div>
                        <div className="flex justify-between items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900 leading-snug truncate">{c.name}</h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${STATUS_BADGE[status] || "bg-slate-50 text-slate-600"}`}>
                            {statusLabel(status)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          {c.jd_title || "—"}
                          {c.max_candidates != null && ` · ${c.max_candidates} opening${c.max_candidates === 1 ? "" : "s"}`}
                        </p>
                      </div>

                      {/* Candidate stats — real pipeline data */}
                      {stats === undefined ? (<div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                      ) : hasStats ? (<div>
                          <div className="flex justify-between text-xs text-slate-500 font-semibold">
                            <span>{stats.candidates} candidates</span>
                            <span>{stats.shortlisted} shortlisted</span>
                            <span>{stats.selected} selected</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (<p className="text-[11px] text-slate-400 font-medium">
                          Pipeline metrics unavailable
                        </p>
                      )}

                      {/* Footer */}
                      <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                            {initials}
                          </div>
                          <span className="text-xs font-bold text-slate-700 truncate">{managerName}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-semibold shrink-0">
                          {c.deadline
                            ? `Due ${new Date(c.deadline).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })}`
                            : "No deadline"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={campaignCurrentPage}
                totalPages={totalCampaignPages}
                onPrevious={() => setCampaignCurrentPage((p) => Math.max(p - 1, 1))}
                onNext={() => setCampaignCurrentPage((p) => Math.min(p + 1, totalCampaignPages))}
                className="mt-6"
              />
            </>
          )}
        </div>
      )}

      {/* --- VERSION HISTORY TAB --- */}
      {activeTab === "versions" && (
        <div className="space-y-6">
          {compareMode && compareVersionNumber ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="h-4.5 w-4.5 text-blue-600" /> Comparing Version {compareVersionNumber} vs Current Version
                </h3>
                <button
                  onClick={() => setCompareMode(false)}
                  className="px-3 py-1 border rounded text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Exit Compare Mode
                </button>
              </div>

              {/* Print Diff side-by-side */}
              {getDiffText(
                historyList.find(h => h.version === Number(compareVersionNumber))?.rawText || "",
                rawText
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Timeline list */}
              <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b pb-2 mb-4">Timelined Revisions</h3>

                <div className="space-y-6 relative border-l border-slate-200 pl-6 ml-3">
                  {/* Current Active */}
                  <div className="relative">
                    <span className="absolute -left-[30px] top-1 w-4 h-4 rounded-full border-2 border-blue-600 bg-blue-50 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">Version {version} (Active)</h4>
                        <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 rounded">Current</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Updated on {updatedDate || createdDate} by Current User</p>
                      <p className="text-xs text-slate-700 mt-1.5">Active structure configured with {skillsList.length} taxonomy skill filters.</p>
                    </div>
                  </div>

                  {/* Previous versions */}
                  {historyList && historyList.map((hist, idx) => (
                    <div key={idx} className="relative">
                      <span className="absolute -left-[30px] top-1 w-4 h-4 rounded-full border-2 border-slate-350 bg-white flex items-center justify-center" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-700">Version {hist.version}</h4>
                        <p className="text-[10px] text-slate-500 mt-1">Updated on {hist.updatedDate} by {hist.updatedBy}</p>
                        <p className="text-xs text-slate-500 mt-1.5 italic">"{hist.changesSummary}"</p>

                        <div className="flex gap-2.5 mt-3">
                          <button
                            onClick={() => {
                              setCompareVersionNumber(hist.version);
                              setCompareMode(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded text-[10px] font-bold transition"
                          >
                            <Eye className="h-3 w-3" /> Compare diff
                          </button>
                          <button
                            onClick={() => setRestoreConfirmVersion(hist.version)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 rounded text-[10px] font-bold transition"
                          >
                            <RefreshCw className="h-3 w-3" /> Restore state
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lineage Tree card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col h-fit">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b pb-2 mb-4">Lineage Branch Tree</h3>

                {/* Vertical tree representation using basic CSS borders */}
                <div className="flex flex-col items-center py-4 space-y-4">
                  {historyList && historyList.map((h, i) => (
                    <React.Fragment key={i}>
                      <div className="w-24 border border-slate-200 rounded-lg p-2 text-center bg-slate-50 shadow-sm">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Rev v{h.version}</span>
                        <span className="text-[10px] font-bold text-slate-600">Base version</span>
                      </div>
                      <div className="h-4 border-l-2 border-dashed border-slate-300" />
                    </React.Fragment>
                  ))}

                  {/* Current version node */}
                  <div className="w-28 border-2 border-blue-600 rounded-lg p-2.5 text-center bg-blue-50/50 shadow-md">
                    <span className="text-[9px] uppercase font-bold text-blue-600 block">Rev v{version}</span>
                    <span className="text-[10px] font-black text-blue-900">Active Node</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Initiate Campaign Modal */}
      <Modal
        isOpen={linkCampaignModalOpen}
        onClose={() => setLinkCampaignModalOpen(false)}
        title="Initiate Recruitment Campaign"
        width="640px"
        height="90vh"
      >
        <NewCampaignForm
          title={title}
          campaignForm={campaignForm}
          handleCampaignFormChange={handleCampaignFormChange}
          setLinkCampaignModalOpen={setLinkCampaignModalOpen}
          isSubmittingCampaign={isSubmittingCampaign}
          handleInitiateCampaign={handleInitiateCampaign}
        />
      </Modal>

      {/* Create New Canonical Skill — from a JD Unknown Skill */}
      <SkillActionModal
        isOpen={unknownSkillModal === "create"}
        onClose={closeUnknownSkillModal}
        title="Create New Canonical Skill"
        subtitle={activeUnknownSkill ? `Resolving: "${activeUnknownSkill.raw_text}"` : ""}
        size="2xl"
        animation="zoom"
        titleIcon={<Plus className="h-5 w-5" />}
        maxHeight="max-h-[90vh]"
      >
        {activeUnknownSkill && (
          <CreateSkillModalBody
            rawSkill={activeUnknownSkill.raw_text}
            unknownSkillId={activeUnknownSkill.unknown_skill_id}
            onClose={closeUnknownSkillModal}
            onCreated={handleUnknownSkillResolved}
          />
        )}
      </SkillActionModal>

      {/* Map to Existing Skill — suggestion tabs */}
      <SkillActionModal
        isOpen={unknownSkillModal === "suggestions"}
        onClose={closeUnknownSkillModal}
        title="Map to Existing Skill"
        subtitle={activeUnknownSkill ? `Resolving: "${activeUnknownSkill.raw_text}"` : ""}
        size="4xl"
        animation="zoom"
        titleIcon={<GitMerge className="h-5 w-5" />}
        maxHeight="max-h-[90vh]"
      >
        {activeUnknownSkill && (
          <SuggestionTabsSection
            unknownSkillId={activeUnknownSkill.unknown_skill_id}
            onMapClick={(row) => {
              setUnknownSkillMapTarget(row);
              setUnknownSkillModal("confirmMap");
            }}
          />
        )}
      </SkillActionModal>

      {/* Map to Existing Skill — confirm */}
      <SkillActionModal
        isOpen={unknownSkillModal === "confirmMap"}
        onClose={() => setUnknownSkillModal("suggestions")}
        title="Map to Existing Skill"
        subtitle={activeUnknownSkill ? `Resolving: "${activeUnknownSkill.raw_text}"` : ""}
        size="2xl"
        animation="zoom"
        titleIcon={<GitMerge className="h-5 w-5" />}
        maxHeight="max-h-[90vh]"
      >
        {activeUnknownSkill && (
          <MapSkillModalBody
            rawSkill={activeUnknownSkill.raw_text}
            unknownSkillId={activeUnknownSkill.unknown_skill_id}
            target={unknownSkillMapTarget}
            onClose={() => setUnknownSkillModal("suggestions")}
            onMapped={handleUnknownSkillResolved}
          />
        )}
      </SkillActionModal>

      {/* Delete Unknown Skill */}
      <SkillActionModal
        isOpen={unknownSkillModal === "delete"}
        onClose={closeUnknownSkillModal}
        title="Delete Unknown Skill"
        size="sm"
        animation="zoom"
        titleIcon={<Trash2 className="h-5 w-5 text-rose-500" />}
        maxHeight="max-h-[90vh]"
      >
        {activeUnknownSkill && (
          <DeleteSkillModalBody
            rawSkill={activeUnknownSkill.raw_text}
            unknownSkillId={activeUnknownSkill.unknown_skill_id}
            onClose={closeUnknownSkillModal}
            onDeleted={handleUnknownSkillResolved}
          />
        )}
      </SkillActionModal>

      {/* Bulk Approve / Reject — JD Unknown Skills */}
      <Modal
        isOpen={!!bulkConfirmAction}
        onClose={closeBulkConfirm}
        title={bulkConfirmAction === "approve" ? "Approve Selected Skills" : "Reject Selected Skills"}
        width="460px"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[12px] text-amber-700">
              {bulkConfirmAction === "approve"
                ? `This creates a new canonical skill for each of the ${selectedUnknownSkillIds.size} selected unknown skill${selectedUnknownSkillIds.size > 1 ? "s" : ""}.`
                : `This permanently deletes the ${selectedUnknownSkillIds.size} selected unknown skill${selectedUnknownSkillIds.size > 1 ? "s" : ""}. This action cannot be undone.`}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="small" onClick={closeBulkConfirm} disabled={isBulkSubmitting}>
              Cancel
            </Button>
            <Button
              variant={bulkConfirmAction === "approve" ? "primary" : "danger"}
              size="small"
              loading={isBulkSubmitting}
              onClick={handleConfirmBulkUnknownSkillAction}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Restore Confirmation Dialog */}
      {restoreConfirmVersion && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <div className="p-2 bg-amber-50 rounded-full"><AlertTriangle className="h-5 w-5" /></div>
              <h3 className="text-sm font-bold text-slate-900">Rollback Confirmation</h3>
            </div>

            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to rollback back to <span className="font-bold text-slate-800">Version {restoreConfirmVersion}</span>?
              This will overwrite the active JD text and matching skills taxonomy, creating a backup history point of your current state.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRestoreConfirmVersion(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreConfirm}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Confirm Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
