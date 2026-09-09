import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ArrowLeft, Users, Activity, AlertTriangle, Lock, Target,
  UserCog, FileText, ArrowRight, Filter, ChevronDown, Clock,
  ExternalLink, ListChecks,
  RotateCcw, Inbox, AlertOctagon, Hourglass, PieChart,
  Send, Flag, SkipForward, Lightbulb, FileUp,
  ArrowRightLeft, Ban, Mail, Download
} from "lucide-react";
import Button from "../../../components/Button/Button";
import FilterListbox from "../../../components/filter/FilterListbox";
import LoadingSpinner from "../../../components/LoadingSpinner";
import Pagination from "../../../components/Pagination/pagination";
import CandidateTable from "../candidates/components/CandidateTable";
import { mapCampaignCandidateList } from "../candidates/utils/mapCampaignCandidateList";
import { paginate } from "../candidates/utils/candidateUtils.jsx";
import { CANDIDATE_PAGE_SIZE } from "../candidates/constants/candidateConstants";
import EditCampaignModal from "./components/EditCampaignModal";
import ReopenCampaignModal from "./components/ReopenCampaignModal";
import CandidateActionModals from "./components/CandidateActionModals";
import CampaignExportPanel from "./components/CampaignExportPanel";
import { getNoteCounts } from "./services/candidateActionsService";
import { useAuth } from "../../../contexts/AuthContext";
import { REJECTION_LAYER_LABELS } from "../constants/scoreLabels";
import useCampaignPermissions from "./hooks/useCampaignPermissions";
import {
  getCampaignDetails, getPipelineSummary, getCampaignTimeline,
  getCampaignCandidates, getProcessingStatus, getDeadLetterQueue,
  getProcessingQueue, replayDeadLetterTasks,
  getStalledCandidates, reprocessStalledCandidate, escalateStalledCandidate,
  overrideCandidateStage, flagCandidateForReview,
  getRejectionAnalytics,
  getBulkUploadsForCampaign,
  formatApiError,
} from "./services/campaignservice";
import {
  getStageTiming, filterCandidates,
} from "../dashboard/services/dashboardService";
import CandidateFilterBar from "./components/CandidateFilterBar";
import { bulkSendRejectionEmail } from "../candidates/services/candidateScoreService";
import { getBulkUploadFiles, getBulkUploadFileLog } from "../service/resumeIntake";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";

// Colour per pipeline stage (used for the funnel bars)
const STAGE_COLORS = {
  UPLOADED: "#6366F1", SCREENING: "#3B82F6", SHORTLISTED: "#0EA5E9",
  HM_REVIEW: "#14B8A6", INTERVIEW: "#10B981", SELECTED: "#22C55E",
  HOLD: "#94A3B8", REJECTED: "#F43F5E", FRAUD_REVIEW: "#F59E0B",
};
const stageLabel = (s) =>
  s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// service returns the raw APIResponse ({ success, message, data }); pull out data
const unwrap = (res) => (res && res.data !== undefined ? res.data : res);
const asPct = (n) => (n == null ? "—" : `${Math.round(n)}%`);
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "—");

export default function CampaignDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canManageCampaigns, canViewPipeline, canViewTimeline, isHiringManager, isHRAdmin } = useCampaignPermissions();
  const canReviewInterviews = isHiringManager || isHRAdmin;

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  // ?tab=&stage= let the dashboard quick links (M11-E01-S03-T01) land directly
  // on a stage-filtered candidate list, and make that view bookmarkable. Kept
  // in sync (below) as the user switches tabs/stages so that navigating away
  // to a candidate's scorecard and hitting "back" returns to this same URL —
  // otherwise the browser-history entry never reflected the tab you were on.
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "details");
  const [editOpen, setEditOpen] = useState(false);
  // lifecycle actions — only one of these is ever open at a time
  const [lifecycleModal, setLifecycleModal] = useState(null); // null | "pause" | "resume" | "close" | "reopen"
  // set when a funnel stage bar is clicked — pre-filters the Candidates tab
  const [candidateStageFilter, setCandidateStageFilter] = useState(
    () => (searchParams.get("stage") || "").toUpperCase(),
  );

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", activeTab);
      if (candidateStageFilter) next.set("stage", candidateStageFilter);
      else next.delete("stage");
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, candidateStageFilter]);

  // Refreshing must not go through `loading`: that flag drives a full-page
  // spinner which unmounts the whole tree, including any open modal, so a
  // background refresh would look like the dialog closing itself.
  const loadDetail = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await getCampaignDetails(id);
      setDetail(unwrap(res));
    } catch {
      toast.error("Failed to load campaign details.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // Only the first load blanks the page; afterwards `detail` is already
  // rendered and a refresh swaps it in place.
  if (loading && !detail) {
    return (<div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading campaign..." />
      </div>
    );
  }
  if (!detail) {
    return (<div className="p-8 min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
        <AlertTriangle className="h-12 w-12 text-rose-500 mb-4" />
        <h2 className="text-lg font-bold text-slate-800">Campaign Not Found</h2>
        <Button variant="primary" size="small" className="mt-4" onClick={() => navigate("/ai-screening/campaigns")}>
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const info = detail.campaign_info || {};
  const jd = detail.jd_configuration || {};
  const scoring = detail.scoring_configuration;      // null for HIRING_MANAGER
  const limits = detail.pipeline_limits || {};
  const hm = detail.hiring_manager;                  // null for HIRING_MANAGER

  const status = (info.status || "").toUpperCase();
  const isClosed = status === "CLOSED";
  const isActive = status === "ACTIVE";
  const canEdit = canManageCampaigns && !isClosed;   // closed = read-only

  // Pipeline/Processing tabs: HR_ADMIN + RECRUITER (matches the backend's
  // require_roles on pipeline-summary / processing-status / dead-letter-queue).
  // scoring != null is kept as a data-presence AND — the backend also omits
  // the scoring section for roles it hides it from, so both must agree.
  const canSeePipeline = canViewPipeline && scoring != null;
  const canSeeTimeline = canViewTimeline;            // HR_ADMIN only

  const tabs = [
    { id: "details", label: "Details", icon: FileText, show: true },
    { id: "candidates", label: "Candidates", icon: ListChecks, show: true },
    { id: "pipeline", label: "Pipeline", icon: Users, show: canSeePipeline },
    { id: "processing", label: "Processing", icon: Inbox, show: canSeePipeline },
    { id: "uploads", label: "Uploads", icon: FileUp, show: canSeePipeline },
    { id: "stalled", label: "Stalled", icon: Hourglass, show: canManageCampaigns },
    { id: "rejections", label: "Rejections", icon: PieChart, show: canSeePipeline },
    { id: "timeline", label: "Timeline", icon: Activity, show: canSeeTimeline },
    // Its own tab rather than scattered buttons, so every export for
    // this campaign is discoverable in one place.
    { id: "exports", label: "Exports", icon: Download, show: true },
  ].filter((t) => t.show);

  const statusStyle = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-100",
    PAUSED: "bg-amber-50 text-amber-700 border-amber-100",
    CLOSED: "bg-slate-100 text-slate-600 border-slate-200",
  }[status] || "bg-slate-50 text-slate-600 border-slate-200";

  return (<div className="bg-[#F8FAFC] text-slate-900 font-sans min-h-screen p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 shadow-sm shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{info.name}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusStyle}`}>
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created by {info.created_by_name || "System"} on {fmtDate(info.created_at)}
            </p>
          </div>
        </div>
        {canManageCampaigns && (<div className="flex items-start flex-wrap gap-2">
            {/* Pause/Resume/Close live inside Edit Campaign as a Status dropdown;
                Reopen stays here since closed campaigns are read-only. */}
            {isClosed ? (<Button variant="outline" size="medium" onClick={() => setLifecycleModal("reopen")}>
                <RotateCcw className="h-4 w-4" /> Reopen
              </Button>
            ) : (<Button variant="primary" size="medium" onClick={() => setEditOpen(true)}>
                Edit Campaign
              </Button>
            )}
          </div>
        )}
      </div>

      {/* closed read-only banner */}
      {isClosed && (<div className="mb-6 flex items-center gap-3 bg-slate-100 border border-slate-200 rounded-xl px-5 py-3">
          <Lock className="h-4 w-4 text-slate-500" />
          <p className="text-xs font-semibold text-slate-600">
            This campaign is <b>closed</b> and read-only. Reopen the campaign to make changes.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 gap-6">
        {tabs.map((t) => (<button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 transition ${
              activeTab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "details" && (<DetailsTab info={info} jd={jd} scoring={scoring} limits={limits} hm={hm} />
      )}
      {activeTab === "candidates" && (<CandidatesTab
          campaignId={id}
          stageFilter={candidateStageFilter}
          onStageFilterChange={setCandidateStageFilter}
        />
      )}
      {activeTab === "pipeline" && (<PipelineTab
          campaignId={id}
          isActive={isActive}
          canViewTiming={canViewTimeline}
          canReviewInterviews={canReviewInterviews}
          onViewCandidates={() => navigate(`/ai-screening/candidates?campaign=${id}`)}
          onReviewInterviews={() => navigate(`/ai-screening/interview-queue?campaign=${id}`)}
          onStageClick={(stage) => {
            setCandidateStageFilter(stage);
            setActiveTab("candidates");
          }}
        />
      )}
      {activeTab === "processing" && (<ProcessingTab campaignId={id} canManageCampaigns={canManageCampaigns} canReplayDlq={canViewPipeline} />
      )}
      {activeTab === "uploads" && <UploadsTab campaignId={id} />}
      {activeTab === "stalled" && canManageCampaigns && <StalledTab campaignId={id} />}
      {activeTab === "rejections" && (<RejectionsTab
          campaignId={id}
          jdId={jd.jd_id}
          onAdjustThreshold={canEdit ? () => setEditOpen(true) : null}
        />
      )}
      {activeTab === "timeline" && <TimelineTab campaignId={id} />}

      {activeTab === "exports" && <CampaignExportPanel campaignId={id} />}

      {canEdit && (<EditCampaignModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          campaignId={id}
          detail={detail}
          onSaved={() => { setEditOpen(false); loadDetail({ silent: true }); }}
        />
      )}

      {canManageCampaigns && (<>
          <ReopenCampaignModal
            isOpen={lifecycleModal === "reopen"}
            onClose={() => setLifecycleModal(null)}
            campaignId={id}
            onReopened={() => { setLifecycleModal(null); loadDetail({ silent: true }); }}
          />
        </>
      )}
    </div>
  );
}

/* ---------------- Details Tab ---------------- */
// h-full + flex-col: siblings in a row match the tallest card instead of
// shrink-wrapping to their content and leaving ragged whitespace beneath.
function Card({ title, icon: Icon, children, className = "" }) {
  return (<div className={`bg-white border border-slate-200 rounded-xl shadow-sm h-full flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
        {Icon && <Icon className="h-4 w-4 text-blue-600" />}
        <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  );
}

function Row({ label, value, className = "" }) {
  return (<div className={`min-w-0 ${className}`}>
      <dt className="text-[10px] uppercase font-bold tracking-wide text-slate-400">{label}</dt>
      <dd className="text-xs font-bold text-slate-800 mt-0.5 break-words">{value ?? "—"}</dd>
    </div>
  );
}

// Same palette the rejection-analytics chart uses, so a layer reads as the
// same colour everywhere in the module.
const SCORING_LAYERS = [
  { key: "weight_deterministic", label: "Requirements", color: "#6366F1" },
  { key: "weight_semantic", label: "Relevance", color: "#0EA5E9" },
  { key: "weight_ai", label: "AI", color: "#8B5CF6" },
];

function DetailsTab({ info, jd, scoring, limits, hm }) {
  // max_candidates is the number of openings, filled by SELECTED candidates —
  // intake is deliberately uncapped, so the gauge must not measure total
  // candidates against it.
  const max = limits.max_candidates;
  const selected = limits.selected_count ?? 0;
  const totalCandidates = limits.current_candidate_count ?? 0;
  const capPct = max ? Math.min(100, Math.round((selected / max) * 100)) : null;
  // all positions filled auto-closes the campaign, so it gets the strongest
  // colour rather than being buried in plain text
  const capTone = capPct == null ? "bg-slate-300"
    : capPct >= 100 ? "bg-rose-500"
      : capPct >= 80 ? "bg-amber-500"
        : "bg-indigo-500";

  const weightTotal = scoring
    ? SCORING_LAYERS.reduce((sum, l) => sum + Number(scoring[l.key] || 0), 0)
    : 0;

  return (<div className="space-y-6">
      {/* At-a-glance strip — the numbers worth knowing before reading
          anything else. Flush cells, full width, no empty slots. Status is
          skipped here since it's already shown next to the campaign name. */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div className="px-5 py-4 flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Target className="h-3.5 w-3.5" />
            </span>
            <p className="text-[10px] uppercase font-bold tracking-wide text-slate-400">Positions Filled</p>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-slate-900 tabular-nums leading-none">{selected}</span>
            <span className="text-[11px] font-bold text-slate-400">
              {max == null ? "of unlimited openings" : `of ${max} opening${max === 1 ? "" : "s"}`}
            </span>
          </div>
          {capPct != null && (<div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className={`h-1.5 rounded-full ${capTone} transition-all duration-500`} style={{ width: `${capPct}%` }} />
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-1.5">
            {totalCandidates} candidate{totalCandidates === 1 ? "" : "s"} in pipeline
          </p>
        </div>

        <div className="px-5 py-4 flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="h-3.5 w-3.5" />
            </span>
            <p className="text-[10px] uppercase font-bold tracking-wide text-slate-400">Deadline</p>
          </div>
          <p className="text-xs font-bold text-slate-800">
            {limits.deadline ? fmtDate(limits.deadline) : "None set"}
          </p>
        </div>

        <div className="px-5 py-4 flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <p className="text-[10px] uppercase font-bold tracking-wide text-slate-400">Job Description</p>
          </div>
          {jd.jd_id ? (<Link
              to={`/ai-screening/jds/${jd.jd_id}`}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 min-w-0"
            >
              <span className="truncate">{jd.jd_title}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </Link>
          ) : (<p className="text-xs font-bold text-slate-800 truncate">{jd.jd_title ?? "—"}</p>
          )}
          <p className="text-[10px] text-slate-400 mt-1">
            v{jd.version_number ?? "—"} · {jd.jurisdiction ?? "—"} · {jd.mandatory_skill_count ?? 0} mandatory skills
          </p>
        </div>
      </div>

      {/* Two equal-height cards. Scoring is null for HIRING_MANAGER, in which
          case the left card takes the full width instead of leaving a hole. */}
      <div className={`grid grid-cols-1 gap-5 ${scoring ? "lg:grid-cols-5" : ""}`}>
        <div className={scoring ? "lg:col-span-3" : ""}>
          <Card title="Campaign" icon={FileText}>
            {/* Name and the two people sit on the top row as the identity of
                the campaign; timestamps are metadata and go below, three to a
                row so nothing is left orphaned in a half-empty column.
                Jurisdiction lives in the summary strip above, not repeated. */}
            <dl className="space-y-4">
              <Row label="Name" value={info.name} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {hm && (<div className="min-w-0">
                    <dt className="text-[10px] uppercase font-bold tracking-wide text-slate-400 flex items-center gap-1">
                      <UserCog className="h-3 w-3" /> Hiring Manager
                    </dt>
                    <dd className="mt-1.5 flex items-center gap-2.5 min-w-0">
                      <span className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        {(hm.full_name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800 truncate">{hm.full_name}</span>
                        <span className="block text-[11px] text-slate-500 truncate">{hm.email}</span>
                      </span>
                    </dd>
                  </div>
                )}
                <Row label="Created By" value={info.created_by_name} />
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <Row label="Created At" value={fmtDate(info.created_at)} />
                <Row label="Last Updated" value={fmtDate(info.updated_at)} />
              </div>
            </dl>
          </Card>
        </div>

        {scoring && (<div className="lg:col-span-2">
            <Card title="Scoring Configuration" icon={Target}>
              {/* Three weights are one distribution, so they read as one bar
                  rather than three unrelated numbers. */}
              <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                {SCORING_LAYERS.map((l) => {
                  const w = Number(scoring[l.key] || 0);
                  return (<div
                      key={l.key}
                      className="h-2.5 transition-all duration-500"
                      style={{ width: weightTotal ? `${(w / weightTotal) * 100}%` : "0%", backgroundColor: l.color }}
                      title={`${l.label}: ${asPct(w)}`}
                    />
                  );
                })}
              </div>
              <dl className="mt-3 space-y-2">
                {SCORING_LAYERS.map((l) => (<div key={l.key} className="flex items-center justify-between gap-2">
                    <dt className="text-[11px] font-semibold text-slate-600 flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                      <span className="truncate">{l.label}</span>
                    </dt>
                    <dd className="text-xs font-bold text-slate-900 tabular-nums">{asPct(scoring[l.key])}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3">
                <Row label="Det. Cutoff" value={scoring.deterministic_threshold ?? "—"} />
                <Row label="Sem. Cutoff" value={scoring.semantic_threshold} />
                <Row label="AI Cutoff" value={scoring.ai_threshold} />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// Reconstructs the CandidatesTab filter state from the URL — mirrors
// serializeCandidateFilters below. Kept outside the component so it's usable
// as a useState initializer (only ever runs once, on mount).
function parseCandidateFilters(searchParams) {
  const degrees = searchParams.get("degrees");
  return {
    nameFilter: searchParams.get("name") || "",
    resumeFilters: {
      experience_min: searchParams.get("exp_min") || undefined,
      experience_max: searchParams.get("exp_max") || undefined,
      include_unknown_experience: searchParams.get("include_unknown") === "0" ? false : undefined,
      degree_levels: degrees ? degrees.split(",").filter(Boolean) : undefined,
      uploaded_by: searchParams.get("uploaded_by") || undefined,
      upload_type: searchParams.get("upload_type") || undefined,
      uploaded_from: searchParams.get("uploaded_from") || undefined,
      uploaded_to: searchParams.get("uploaded_to") || undefined,
    },
    scoreFilters: {
      min: searchParams.get("score_min") || "",
      max: searchParams.get("score_max") || "",
      recommendation: searchParams.get("score_rec") || "",
    },
    page: Number(searchParams.get("page")) || 1,
  };
}

// Mirrors the candidate filters into the URL so that browsing back from a
// candidate's scorecard (a separate route) returns to this exact view instead
// of a blank Candidates tab — the browser-history entry for this page only
// reflects whatever the URL was at the time of navigating away.
function serializeCandidateFilters(prev, { nameFilter, resumeFilters, scoreFilters, page }) {
  const next = new URLSearchParams(prev);
  ["name", "exp_min", "exp_max", "include_unknown", "degrees",
    "uploaded_by", "upload_type", "uploaded_from", "uploaded_to",
    "score_min", "score_max", "score_rec", "page"].forEach((k) => next.delete(k));
  if (nameFilter) next.set("name", nameFilter);
  if (resumeFilters.experience_min) next.set("exp_min", resumeFilters.experience_min);
  if (resumeFilters.experience_max) next.set("exp_max", resumeFilters.experience_max);
  if (resumeFilters.include_unknown_experience === false) next.set("include_unknown", "0");
  if (resumeFilters.degree_levels?.length) next.set("degrees", resumeFilters.degree_levels.join(","));
  if (resumeFilters.uploaded_by) next.set("uploaded_by", resumeFilters.uploaded_by);
  if (resumeFilters.upload_type) next.set("upload_type", resumeFilters.upload_type);
  if (resumeFilters.uploaded_from) next.set("uploaded_from", resumeFilters.uploaded_from);
  if (resumeFilters.uploaded_to) next.set("uploaded_to", resumeFilters.uploaded_to);
  if (scoreFilters.min !== "") next.set("score_min", scoreFilters.min);
  if (scoreFilters.max !== "") next.set("score_max", scoreFilters.max);
  if (scoreFilters.recommendation) next.set("score_rec", scoreFilters.recommendation);
  if (page > 1) next.set("page", String(page));
  return next;
}

/* ---------------- Candidates Tab ---------------- */
function CandidatesTab({ campaignId, stageFilter = "", onStageFilterChange }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = useMemo(() => parseCandidateFilters(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [candidates, setCandidates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(initialFilters.page);
  // candidate-name search — resolved server-side via the candidate_name
  // query param (matches against the candidate's active resume version).
  const [nameFilter, setNameFilter] = useState(initialFilters.nameFilter);
  // Experience / education / upload-source live in the resume,
  // so they resolve server-side to a set of matching candidate ids.
  const [resumeFilters, setResumeFilters] = useState(initialFilters.resumeFilters);
  const [resumeMatchIds, setResumeMatchIds] = useState(null);
  // Score range and AI recommendation are already supported by the
  // list endpoint; these narrow the rows we fetched, AND-combined with the rest.
  const [scoreFilters, setScoreFilters] = useState(initialFilters.scoreFilters);
  // E04 — selection for bulk moves, note badges, and the one shared action modal
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [noteCounts, setNoteCounts] = useState({});
  const [action, setAction] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sendingBulkRejectionEmail, setSendingBulkRejectionEmail] = useState(false);
  const { hasRole } = useAuth();
  const canAct = hasRole(["HR_ADMIN", "RECRUITER"]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = await filterCandidates(campaignId, resumeFilters);
        if (!cancelled) setResumeMatchIds(ids === null ? null : new Set(ids));
      } catch {
        if (!cancelled) {
          toast.error("Candidate filter failed.");
          setResumeMatchIds(new Set());
        }
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId, resumeFilters]);

  // Skip the very first run — on mount, currentPage may have been restored
  // from the URL (see initialFilters.page) and must not be reset to 1.
  const skipNextPageReset = useRef(true);
  useEffect(() => {
    if (skipNextPageReset.current) { skipNextPageReset.current = false; return; }
    setCurrentPage(1);
  }, [campaignId, stageFilter, nameFilter]);

  useEffect(() => {
    setSearchParams(
      (prev) => serializeCandidateFilters(prev, { nameFilter, resumeFilters, scoreFilters, page: currentPage }),
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameFilter, resumeFilters, scoreFilters, currentPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getCampaignCandidates(campaignId, {
          candidate_name: nameFilter || undefined,
        });
        if (cancelled) return;
        const data = unwrap(res);
        setCandidates((Array.isArray(data) ? data : data?.items) || []);
      } catch {
        if (cancelled) return;
        toast.error("Failed to load campaign candidates.");
        setCandidates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId, reloadKey, nameFilter]);

  // One request for the whole list, refreshed whenever the roster
  // changes. Failure is silent by design: a missing badge must not break rows.
  useEffect(() => {
    let cancelled = false;
    const ids = (candidates || []).map((c) => c.campaign_candidate_id ?? c.id).filter(Boolean);
    if (ids.length === 0) { setNoteCounts({}); return; }
    (async () => {
      const counts = await getNoteCounts(ids);
      if (!cancelled) setNoteCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [candidates]);

  if (loading) {
    return <div className="py-12 flex justify-center"><LoadingSpinner text="Loading candidates..." /></div>;
  }

  // same row shape the standalone candidates screen renders, so CandidateTable
  // and the pagination helpers work unchanged here
  const allCandidates = mapCampaignCandidateList(candidates || []);
  // All active filters are AND-combined: stage from the funnel/dropdown,
  // candidate name from the server-side search already applied above.
  const byId = new Map((candidates || []).map((r) => [r.campaign_candidate_id ?? r.id, r]));
  const list = allCandidates.filter((c) => {
    if (stageFilter && (c.stage || "").toUpperCase() !== stageFilter) return false;
    if (resumeMatchIds && !resumeMatchIds.has(c.id)) return false;
    // Composite range, read from the RAW row: the table mapper
    // coerces a missing composite_score to 0, which would wrongly match a
    // "max 40" filter. An unscored candidate is excluded whenever a bound is
    // set, rather than being treated as a zero.
    if (scoreFilters.min !== "" || scoreFilters.max !== "") {
      const raw = byId.get(c.id)?.composite_score;
      if (raw === null || raw === undefined) return false;
      const score = Number(raw);
      if (scoreFilters.min !== "" && score < Number(scoreFilters.min)) return false;
      if (scoreFilters.max !== "" && score > Number(scoreFilters.max)) return false;
    }
    if (scoreFilters.recommendation) {
      const rec = (byId.get(c.id)?.ai_recommendation || "").toUpperCase();
      if (rec !== scoreFilters.recommendation) return false;
    }
    return true;
  });

  const stageOptions = [
    { value: "", label: "All Stages" },
    ...[...new Set(allCandidates.map((c) => (c.stage || "").toUpperCase()).filter(Boolean))]
      .sort()
      .map((s) => ({ value: s, label: stageLabel(s) })),
  ];

  const { pageItems, totalPages, currentPage: safePage } = paginate(list, currentPage, CANDIDATE_PAGE_SIZE);

  // Bulk "Send Rejection Email" — only worth showing once the selection
  // includes at least one REJECTED candidate; the backend still validates
  // per-id, so a mixed selection is fine, this just avoids showing the
  // button for a selection that's guaranteed to skip every row.
  const selectedRejectedCount = allCandidates.filter(
    (c) => selectedIds.has(c.id) && (c.stage || "").toUpperCase() === "REJECTED"
  ).length;

  const handleBulkSendRejectionEmail = async () => {
    const ids = [...selectedIds];
    setSendingBulkRejectionEmail(true);
    try {
      const res = await bulkSendRejectionEmail(ids);
      const queuedCount = res?.queued?.length ?? 0;
      const failed = res?.failed || [];
      if (queuedCount > 0) {
        toast.success(`Rejection email sent to ${queuedCount} candidate${queuedCount === 1 ? "" : "s"}.`);
      }
      if (failed.length > 0) {
        const nameFor = (id) => allCandidates.find((c) => c.id === id)?.name || id;
        const preview = failed.slice(0, 5).map((f) => `${nameFor(f.campaign_candidate_id)} (${f.reason})`).join(", ");
        const extra = failed.length > 5 ? `, +${failed.length - 5} more` : "";
        toast.error(`${failed.length} skipped: ${preview}${extra}`);
      }
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not send rejection emails.");
    } finally {
      setSendingBulkRejectionEmail(false);
    }
  };

  return (<div className="space-y-4">
      {/* Candidate-name search, status/score filters + resume-derived filters —
          all in one row beside "More filters" so the row stays compact. */}
      <CandidateFilterBar
        campaignId={campaignId}
        nameFilter={nameFilter}
        onNameFilterChange={setNameFilter}
        resultCount={list.length}
        resumeFilters={resumeFilters}
        onResumeFiltersChange={setResumeFilters}
        scoreFilters={scoreFilters}
        onScoreFiltersChange={setScoreFilters}
        stageOptions={onStageFilterChange && allCandidates.length > 0 ? stageOptions : null}
        stageFilter={stageFilter}
        onStageFilterChange={onStageFilterChange}
      />

      {/* The bulk bar only exists while something is selected */}
      {canAct && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-indigo-900">
            {selectedIds.size} selected
          </span>
          <span className="text-[11px] text-indigo-700">
            All selected candidates must be in the same stage.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <select
              className="px-2 py-1.5 border border-indigo-200 rounded-lg text-xs bg-white"
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                setAction({ kind: "bulk", targetStage: e.target.value });
              }}
            >
              <option value="">Move all to…</option>
              {["SCREENING", "SHORTLISTED", "HM_REVIEW", "INTERVIEW", "SELECTED", "HOLD", "REJECTED"]
                .map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
            </select>
            {selectedRejectedCount > 0 && (
              <Button
                variant="outline"
                size="small"
                onClick={handleBulkSendRejectionEmail}
                loading={sendingBulkRejectionEmail}
                loadingText="Sending..."
              >
                <Mail size={13} /> Send Rejection Email ({selectedRejectedCount})
              </Button>
            )}
            <button type="button" onClick={() => setSelectedIds(new Set())}
              className="text-[11px] text-indigo-700 font-semibold hover:underline">
              Clear
            </button>
          </div>
        </div>
      )}

      <CandidateTable
        candidates={pageItems}
        onView={(c) => navigate(`/ai-screening/candidates/${c.id}`)}
        showViewButton={false}
        selectable={canAct}
        selectedIds={selectedIds}
        noteCounts={noteCounts}
        onToggleSelect={(ccId) => setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(ccId)) next.delete(ccId); else next.add(ccId);
          return next;
        })}
        onToggleSelectAll={(rows, select) => setSelectedIds((prev) => {
          const next = new Set(prev);
          rows.forEach((r) => (select ? next.add(r.id) : next.delete(r.id)));
          return next;
        })}
        renderExtraActions={canAct ? (c) => (
          <>
            <button type="button" title="Move to another stage"
              onClick={(e) => { e.stopPropagation(); setAction({ kind: "move", candidate: c }); }}
              className="h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-indigo-600">
              <ArrowRightLeft className="h-4 w-4" />
            </button>
            {(c.stage || "").toUpperCase() !== "REJECTED" && (
              <button type="button" title="Reject with a reason"
                onClick={(e) => { e.stopPropagation(); setAction({ kind: "reject", candidate: c }); }}
                className="h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-red-600">
                <Ban className="h-4 w-4" />
              </button>
            )}
          </>
        ) : undefined}
      />

      <CandidateActionModals
        action={action}
        campaignId={campaignId}
        selectedIds={selectedIds}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          setSelectedIds(new Set());
          setReloadKey((k) => k + 1);
        }}
      />

      {list.length > 0 && (<Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPrevious={() => setCurrentPage(safePage - 1)}
          onNext={() => setCurrentPage(safePage + 1)}
        />
      )}
    </div>
  );
}

/* ---------------- Pipeline Tab ---------------- */
function PipelineTab({ campaignId, isActive, onViewCandidates, onReviewInterviews, onStageClick, canViewTiming, canReviewInterviews }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  // HR_ADMIN-only overlay, fetched lazily on first toggle so
  // the funnel itself never waits on it.
  const [showTiming, setShowTiming] = useState(false);
  const [timing, setTiming] = useState(null);

  const toggleTiming = async () => {
    const next = !showTiming;
    setShowTiming(next);
    if (next && timing === null) {
      try {
        setTiming(await getStageTiming(campaignId));
      } catch {
        setTiming([]);
        toast.error("Failed to load stage timing.");
      }
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await getPipelineSummary(campaignId);
      setSummary(unwrap(res));
    } catch {
      toast.error("Failed to load pipeline summary.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // refresh in real time while the campaign is active — poll every 10s
  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [isActive, load]);

  if (loading) {
    return <div className="py-12 flex justify-center"><LoadingSpinner text="Loading pipeline..." /></div>;
  }
  if (!summary) return null;

  const stages = summary.stages || [];
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (<div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Pipeline Funnel</h3>
          <p className="text-[11px] text-slate-500">
            {summary.total_candidates} candidates submitted
            {isActive && <span className="text-emerald-600 font-semibold"> · live</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canViewTiming && (
            <Button size="small" variant={showTiming ? "secondary" : "outline"} onClick={toggleTiming}>
              <Clock className="h-3.5 w-3.5" /> {showTiming ? "Hide" : "Show"} Timing
            </Button>
          )}
          {canReviewInterviews && (
            <Button size="small" variant="outline" onClick={onReviewInterviews}>
              Review Interviews <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="small" variant="primary" onClick={onViewCandidates}>
            View All Candidates <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        {stages.map((s) => (// each stage bar is clickable → Candidates tab filtered to that stage
          <button
            key={s.stage}
            type="button"
            onClick={() => onStageClick?.(s.stage)}
            title={`View candidates in ${stageLabel(s.stage)}`}
            className="block w-full text-left group cursor-pointer rounded-lg -mx-1 px-1 py-0.5 hover:bg-slate-50 transition"
          >
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-bold text-slate-700 group-hover:text-indigo-700">{stageLabel(s.stage)}</span>
              <div className="flex items-center gap-3">
                {showTiming && (() => {
                  const t = (timing || []).find((x) => x.stage === s.stage);
                  if (!t) return null;
                  return (
                    <span className={`text-[10px] font-semibold ${t.breaches_sla ? "text-rose-600" : "text-slate-500"}`}>
                      avg {t.avg_days}d · max {t.max_days}d
                      {t.sla_days != null && ` · SLA ${t.sla_days}d`}
                      {t.breaches_sla && " ⚠"}
                    </span>
                  );
                })()}
                {s.drop_off_pct != null && (<span className="text-[10px] font-semibold text-rose-500">
                    ▼ {Math.round(s.drop_off_pct)}% drop-off
                  </span>
                )}
                <span className="font-black text-slate-900 tabular-nums">{s.count}</span>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${(s.count / maxCount) * 100}%`, backgroundColor: STAGE_COLORS[s.stage] || "#6366F1" }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Processing Tab ---------------- */
const TASK_STATUS_TONE = {
  queued_count: { label: "Queued", dot: "bg-slate-400" },
  running_count: { label: "Running", dot: "bg-blue-500" },
  retry_count: { label: "Retry", dot: "bg-amber-500" },
  dead_count: { label: "Dead", dot: "bg-rose-500" },
  paused_count: { label: "Paused", dot: "bg-slate-300" },
};

const BREAKER_TONE = {
  CLOSED: "bg-emerald-50 text-emerald-700",
  HALF_OPEN: "bg-amber-50 text-amber-700",
  OPEN: "bg-rose-50 text-rose-700",
};

const QUEUE_STATUS_COLUMNS = ["QUEUED", "RUNNING", "RETRY", "SUCCESS", "FAILURE", "DEAD"];

const DLQ_PAGE_SIZE = 50; // matches the backend's default `limit`

function ProcessingTab({ campaignId, canManageCampaigns, canReplayDlq }) {
  const [status, setStatus] = useState(null);          // overall summary (HR_ADMIN + RECRUITER)
  const [queue, setQueue] = useState(null);            // per-task-type breakdown (HR_ADMIN only)
  const [dlq, setDlq] = useState([]);
  const [dlqTotal, setDlqTotal] = useState(0);
  const [dlqPage, setDlqPage] = useState(1);            // 1-indexed, mirrors the Pagination component's contract
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [replaying, setReplaying] = useState(false);

  const load = useCallback(async () => {
    const calls = [
      getProcessingStatus(campaignId),
      getDeadLetterQueue(campaignId, { limit: DLQ_PAGE_SIZE, offset: (dlqPage - 1) * DLQ_PAGE_SIZE }),
    ];
    if (canManageCampaigns) calls.push(getProcessingQueue(campaignId));
    const [statusRes, dlqRes, queueRes] = await Promise.allSettled(calls);
    if (statusRes.status === "fulfilled") setStatus(unwrap(statusRes.value));
    if (dlqRes.status === "fulfilled") {
      const dlqData = unwrap(dlqRes.value);
      setDlq(dlqData?.entries || []);
      setDlqTotal(dlqData?.total ?? 0);
    }
    if (queueRes?.status === "fulfilled") setQueue(unwrap(queueRes.value));
    setLoading(false);
  }, [campaignId, canManageCampaigns, dlqPage]);

  useEffect(() => { load(); }, [load]);

  // paging away from a selection the user made on a different page would
  // silently try to replay entries no longer shown
  useEffect(() => { setSelectedIds([]); }, [dlqPage]);

  // S03: queue status + estimate refresh every 60 seconds
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const toggleEntry = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleReplay = async () => {
    if (selectedIds.length === 0) return toast.error("Select at least one failed task to replay.");
    setReplaying(true);
    try {
      const res = await replayDeadLetterTasks(campaignId, selectedIds);
      const data = unwrap(res);
      toast.success(`Replayed ${data.replayed_count}, skipped ${data.skipped_count}.`);
      (data.results || [])
        .filter((r) => r.status === "SKIPPED" && r.reason)
        .slice(0, 3)
        .forEach((r) => toast.info(r.reason));
      setSelectedIds([]);
      load();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to replay tasks."));
    } finally {
      setReplaying(false);
    }
  };

  if (loading) {
    return <div className="py-12 flex justify-center"><LoadingSpinner text="Loading processing queue..." /></div>;
  }

  const estimate = queue?.estimated_completion || status?.estimated_completion;

  return (<div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Processing Queue</h3>
        <p className="text-[11px] text-slate-500">
          celery_task_log breakdown for this campaign · auto-refreshes every 60s
        </p>
      </div>

      {/* — completion estimate */}
      {estimate && (<div className={`px-4 py-3 rounded-xl border text-xs font-semibold ${
          estimate.estimate_available
            ? "bg-indigo-50 border-indigo-100 text-indigo-700"
            : "bg-slate-50 border-slate-200 text-slate-500"
        }`}>
          <Clock className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
          {estimate.message}
          {estimate.remaining_task_count > 0 && ` · ${estimate.remaining_task_count} task(s) remaining`}
        </div>
      )}

      {/* — circuit breaker states (HR_ADMIN) */}
      {queue?.circuit_breakers && (<div className="flex flex-wrap gap-2">
          {queue.circuit_breakers.map((b) => (<span
              key={b.service_name}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${BREAKER_TONE[b.state] || "bg-slate-100 text-slate-600"}`}
              title={b.state === "OPEN"
                ? `Open since ${fmtDate(b.opened_at)} — retry after ${fmtDate(b.retry_after)}`
                : `${b.failure_count} recorded failure(s)`}
            >
              {b.service_name}: {b.state}
            </span>
          ))}
        </div>
      )}

      {/* — per-task-type breakdown (HR_ADMIN); overall cards otherwise */}
      {queue?.task_types?.length ? (<div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left p-3 font-bold text-slate-400 uppercase text-[10px]">Task Type</th>
                {QUEUE_STATUS_COLUMNS.map((s) => (<th key={s} className="text-right p-3 font-bold text-slate-400 uppercase text-[10px]">{s}</th>
                ))}
                <th className="text-right p-3 font-bold text-slate-400 uppercase text-[10px]">Avg Duration</th>
                <th className="text-right p-3 font-bold text-slate-400 uppercase text-[10px]">LLM Tokens</th>
              </tr>
            </thead>
            <tbody>
              {queue.task_types.map((t) => (<tr key={t.task_type} className="border-b border-slate-50">
                  <td className="p-3 font-bold text-slate-800 whitespace-nowrap">{t.task_type.replace(/_/g, " ")}</td>
                  {QUEUE_STATUS_COLUMNS.map((s) => (<td key={s} className="p-3 text-right tabular-nums text-slate-600">
                      {t.status_counts[s] || 0}
                    </td>
                  ))}
                  <td className="p-3 text-right tabular-nums text-slate-600">
                    {t.avg_duration_ms != null ? `${(t.avg_duration_ms / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums text-slate-600">
                    {t.total_token_count ? t.total_token_count.toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(TASK_STATUS_TONE).map(([key, meta]) => (<div key={key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{meta.label}</p>
              </div>
              <p className="text-xl font-black tabular-nums text-slate-900">{status?.[key] ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* — DLQ with multi-select replay (replay = HR_ADMIN + RECRUITER, matches backend require_roles) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
            <AlertOctagon className="h-3.5 w-3.5" /> Dead Letter Queue ({dlqTotal})
          </h3>
          {canReplayDlq && dlq.length > 0 && (<Button
              variant="danger" size="small" onClick={handleReplay}
              loading={replaying} loadingText="Replaying..."
              disabled={selectedIds.length === 0}
            >
              Replay Selected ({selectedIds.length})
            </Button>
          )}
        </div>
        {dlq.length === 0 ? (<p className="text-xs text-slate-400 text-center py-6">No dead-lettered tasks for this campaign.</p>
        ) : (<div className="space-y-2">
            {dlq.map((entry) => {
              // the backend now only ever returns task types its replay
              // endpoint can actually re-enqueue — every entry here is
              // replayable unless it already has been.
              const replayable = canReplayDlq && !entry.replayed_at;
              return (<label
                  key={entry.id}
                  className={`flex gap-3 p-2.5 rounded-xl border ${replayable ? "cursor-pointer bg-rose-50/50 border-rose-100" : "bg-slate-50 border-slate-100"}`}
                >
                  {canReplayDlq && (<input
                      type="checkbox" className="mt-1 accent-rose-600"
                      disabled={!replayable}
                      checked={selectedIds.includes(entry.id)}
                      onChange={() => toggleEntry(entry.id)}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-700 uppercase">{entry.task_type}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        retried {entry.retry_count}x · last {fmtDate(entry.last_attempted_at || entry.moved_to_dlq_at)}
                      </span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs text-rose-700 mt-1 break-words cursor-pointer underline decoration-dotted decoration-rose-300 underline-offset-2">
                            {extractErrorMessage(entry.final_error_message)}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap break-words bg-slate-900 text-slate-50 border-slate-800">
                          {extractErrorMessage(entry.final_error_message)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {entry.replayed_at && (<p className="text-[10px] text-emerald-600 mt-0.5">Replayed {fmtDate(entry.replayed_at)}</p>
                    )}
                    {entry.resolution_notes && (<p className="text-[10px] text-slate-500 mt-0.5">{entry.resolution_notes}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <Pagination
          currentPage={dlqPage}
          totalPages={Math.max(1, Math.ceil(dlqTotal / DLQ_PAGE_SIZE))}
          onPrevious={() => setDlqPage((p) => p - 1)}
          onNext={() => setDlqPage((p) => p + 1)}
        />
      </div>
    </div>
  );
}

/* ---------------- Bulk Uploads Tab ---------------- */
const UPLOAD_STATUS_BADGE = {
  PENDING: "bg-slate-100 text-slate-600",
  EXTRACTING: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-indigo-50 text-indigo-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  PARTIAL_FAILURE: "bg-amber-50 text-amber-700",
  FAILED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

// File-level status vocabulary (BulkUploadFileStatus) is distinct from the
// job-level one above — a file's terminal success state is PROCESSED, not
// COMPLETED, and there's no PARTIAL_FAILURE at the file level.
const FILE_STATUS_BADGE = {
  QUEUED: "bg-slate-100 text-slate-600",
  RUNNING: "bg-blue-50 text-blue-700",
  PROCESSED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

// Upstream failures (Gemini/Google API errors) come through as the raw
// str() of the exception, e.g. "503 UNAVAILABLE. {'error': {'code': 503,
// 'message': 'The service is currently unavailable.'}}" — pull out just
// the human-readable 'message' value; fall back to the raw text untouched
// if it isn't in that shape.
function extractErrorMessage(raw) {
  if (!raw) return raw;
  const match = raw.match(/['"]message['"]\s*:\s*['"]((?:[^'"\\]|\\.)*)['"]/);
  return match ? match[1] : raw;
}

function UploadsTab({ campaignId }) {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  // per-job cache so re-collapsing/re-expanding the same job doesn't refetch: { [jobId]: { loading, rows, error } }
  const [fileData, setFileData] = useState({});

  const toggleExpand = async (jobId) => {
    const next = expandedId === jobId ? null : jobId;
    setExpandedId(next);
    if (!next || fileData[next]) return;

    setFileData((prev) => ({ ...prev, [next]: { loading: true, rows: [] } }));
    try {
      const [filesRes, logRes] = await Promise.allSettled([
        getBulkUploadFiles(next, { page: 1, size: 100 }),
        getBulkUploadFileLog(next, { limit: 100, offset: 0 }),
      ]);
      const files = filesRes.status === "fulfilled" ? (filesRes.value?.data?.items || filesRes.value?.data || []) : [];
      const logs = logRes.status === "fulfilled" ? (logRes.value?.data?.entries || logRes.value?.data || []) : [];
      const logByFilename = new Map(logs.map((l) => [l.filename, l]));
      const rows = files.map((f) => ({ ...f, reason: logByFilename.get(f.original_filename)?.reason || null }));
      setFileData((prev) => ({ ...prev, [next]: { loading: false, rows } }));
    } catch {
      setFileData((prev) => ({ ...prev, [next]: { loading: false, rows: [], error: true } }));
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await getBulkUploadsForCampaign(campaignId, { page: 1, size: 10 });
      const data = unwrap(res);
      setJobs(data?.items || []);
      setTotal(data?.total ?? 0);
    } catch {
      toast.error("Failed to load bulk uploads.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // refresh while jobs are still moving (30s, matching the pipeline cadence)
  useEffect(() => {
    const anyActive = jobs.some((j) => ["PENDING", "EXTRACTING", "PROCESSING"].includes(j.status));
    if (!anyActive) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [jobs, load]);

  if (loading) {
    return <div className="py-12 flex justify-center"><LoadingSpinner text="Loading bulk uploads..." /></div>;
  }

  return (<div className="space-y-4">
      <div className="flex justify-between items-end flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Bulk Uploads</h3>
          <p className="text-[11px] text-slate-500">
            {total} upload{total === 1 ? "" : "s"} for this campaign · showing the {Math.min(10, jobs.length)} most recent
          </p>
        </div>
      </div>

      {jobs.length === 0 ? (<div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
          <p className="text-xs font-bold text-slate-700">No bulk uploads yet</p>
          <p className="text-[11px] text-slate-400 mt-1">ZIP uploads for this campaign will appear here.</p>
        </div>
      ) : (<div className="space-y-2">
          {jobs.map((job) => {
            const resolved = (job.processed_count || 0) + (job.failed_count || 0) + (job.duplicate_count || 0);
            const pct = job.total_files ? Math.round((resolved / job.total_files) * 100) : 0;
            const isExpanded = expandedId === job.id;
            const fileState = fileData[job.id];
            return (<div key={job.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(job.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleExpand(job.id); }}
                  className="w-full text-left cursor-pointer"
                >
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileUp className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="text-[12.5px] font-bold text-slate-900 truncate">{job.original_filename}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${UPLOAD_STATUS_BADGE[job.status] || "bg-slate-100 text-slate-600"}`}>
                        {job.status.replace(/_/g, " ")}
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {fmtDate(job.created_at)} · {job.completed_at ? `completed ${fmtDate(job.completed_at)}` : "In Progress"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[10.5px] text-slate-500">
                    <span>{job.total_files} file(s)</span>
                    <span className="text-emerald-600 font-semibold">{job.processed_count} processed</span>
                    <span className={job.failed_count ? "text-rose-600 font-semibold" : ""}>{job.failed_count} failed</span>
                    <span className={job.duplicate_count ? "text-amber-600 font-semibold" : ""}>{job.duplicate_count} duplicate(s)</span>
                    {job.queued_count > 0 && <span>{job.queued_count} queued</span>}
                  </div>

                  {job.status === "PROCESSING" && (<div className="mt-2">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>Processing…</span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {isExpanded && (<div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2.5">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Files ({job.total_files})</p>
                      {fileState?.loading ? (<div className="py-4 flex justify-center"><LoadingSpinner text="Loading files..." /></div>
                      ) : fileState?.error ? (<p className="text-[11px] text-rose-500">Failed to load file-level detail.</p>
                      ) : fileState?.rows?.length ? (<div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                          {fileState.rows.map((f) => (<div
                              key={f.id}
                              className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="text-[11.5px] text-slate-700 truncate">{f.original_filename}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {f.reason && (<TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-[10px] text-rose-600 max-w-[240px] truncate cursor-pointer underline decoration-dotted decoration-rose-300 underline-offset-2">
                                          {extractErrorMessage(f.reason)}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap break-words bg-slate-900 text-slate-50 border-slate-800">
                                        {extractErrorMessage(f.reason)}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {f.retry_count > 0 && (<span className="text-[10px] text-slate-400">retried {f.retry_count}x</span>
                                )}
                                <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase ${FILE_STATUS_BADGE[f.status] || "bg-slate-100 text-slate-600"}`}>
                                  {f.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (<p className="text-[11px] text-slate-400">No file-level records found.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Stalled Candidates Tab ---------------- */
const STALL_REASON_LABEL = {
  AI_EVALUATION_FAILED: { text: "AI evaluation failed", tone: "bg-rose-50 text-rose-700" },
  SCREENING_OVERDUE: { text: "Screening overdue", tone: "bg-amber-50 text-amber-700" },
  HM_REVIEW_OVERDUE: { text: "HM review overdue", tone: "bg-orange-50 text-orange-700" },
  INTERVIEW_NOT_SCHEDULED: { text: "Interview not scheduled", tone: "bg-sky-50 text-sky-700" },
};

function StalledTab({ campaignId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  // one inline action form open at a time: { id, action } | null
  const [actionForm, setActionForm] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getStalledCandidates(campaignId);
      setData(unwrap(res));
    } catch {
      toast.error("Failed to load stalled candidates.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (fn, successMessage) => {
    setSubmitting(true);
    try {
      const res = await fn();
      const detail = unwrap(res)?.detail;
      toast.success(detail || successMessage);
      setActionForm(null);
      setReason("");
      setLoading(true);
      load();
    } catch (err) {
      toast.error(formatApiError(err, "Action failed."));
    } finally {
      setSubmitting(false);
    }
  };

  const openForm = (id, action) => {
    setActionForm((prev) => (prev?.id === id && prev?.action === action ? null : { id, action }));
    setReason("");
  };

  if (loading) {
    return <div className="py-12 flex justify-center"><LoadingSpinner text="Loading stalled candidates..." /></div>;
  }

  const items = data?.items || [];
  const slas = data?.sla_config || {};

  return (<div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Stalled Candidates</h3>
        <p className="text-[11px] text-slate-500">
          Stuck past SLA — screening {slas.screening_sla_hours}h · HM review {slas.hm_review_sla_days}d · interview {slas.interview_sla_days}d
        </p>
      </div>

      {items.length === 0 ? (<div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
          <p className="text-xs font-bold text-slate-700">No stalled candidates</p>
          <p className="text-[11px] text-slate-400 mt-1">Every candidate is progressing within the configured SLAs.</p>
        </div>
      ) : (<div className="space-y-2">
          {items.map((item) => {
            const reasonMeta = STALL_REASON_LABEL[item.stall_reason] || { text: item.stall_reason, tone: "bg-slate-100 text-slate-600" };
            const isFormOpen = (a) => actionForm?.id === item.campaign_candidate_id && actionForm?.action === a;
            return (<div key={item.campaign_candidate_id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-slate-900 truncate">
                      {/* candidate_name isn't confirmed to exist on this endpoint's response yet —
                          falls back to a short id-based placeholder rather than blank/undefined
                          until that's confirmed either way. */}
                      {item.candidate_name || `Candidate ${String(item.campaign_candidate_id).slice(0, 8)}…`}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-50 text-indigo-700">
                        {item.pipeline_stage.replace(/_/g, " ")}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${reasonMeta.tone}`}>
                        {reasonMeta.text}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Stalled {item.days_stalled} day(s) · last update {fmtDate(item.last_updated_at)}
                      {item.last_action_by && <> · last action by {item.last_action_by}</>}
                      {" · "}
                      <span className="font-mono" title={item.campaign_candidate_id}>
                        {String(item.campaign_candidate_id).slice(0, 8)}…
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {item.has_dead_letter_tasks && (<Button variant="outline" size="small" disabled={submitting}
                        onClick={() => runAction(() => reprocessStalledCandidate(campaignId, item.campaign_candidate_id),
                          console.log(item),
                          "Re-process triggered.",
                        )}>
                        <RotateCcw className="h-3 w-3" /> Re-Process
                      </Button>
                    )}
                    {item.pipeline_stage === "HM_REVIEW" && (<Button variant="outline" size="small" disabled={submitting}
                        onClick={() => runAction(() => escalateStalledCandidate(campaignId, item.campaign_candidate_id),
                          "Escalation recorded.",
                        )}>
                        <Send className="h-3 w-3" /> Escalate to HM
                      </Button>
                    )}
                    <Button variant="outline" size="small"
                      onClick={() => openForm(item.campaign_candidate_id, "override")}>
                      <SkipForward className="h-3 w-3" /> Override Stage
                    </Button>
                    <Button variant="outline" size="small"
                      onClick={() => openForm(item.campaign_candidate_id, "flag")}>
                      <Flag className="h-3 w-3" /> Flag for Review
                    </Button>
                  </div>
                </div>

                {(isFormOpen("override") || isFormOpen("flag")) && (<div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[220px]">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        {isFormOpen("override")
                          ? "Reason for manual stage advance (required)"
                          : "Reason for routing to FRAUD_REVIEW (required)"}
                      </label>
                      <input
                        type="text" value={reason} maxLength={1000}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                        placeholder="e.g. Reviewed offline with the hiring manager"
                      />
                    </div>
                    <Button
                      variant={isFormOpen("flag") ? "danger" : "primary"} size="small"
                      loading={submitting} loadingText="Saving..."
                      disabled={!reason.trim()}
                      onClick={() => runAction(isFormOpen("override")
                          ? () => overrideCandidateStage(campaignId, item.campaign_candidate_id, reason.trim())
                          : () => flagCandidateForReview(campaignId, item.campaign_candidate_id, reason.trim()),
                        isFormOpen("override") ? "Stage overridden." : "Flagged for review.",
                      )}>
                      Confirm
                    </Button>
                    <Button variant="outline" size="small" onClick={() => setActionForm(null)}>Cancel</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Rejection Analytics Tab ---------------- */
const REJECTION_LAYER_COLOR = {
  DETERMINISTIC: "#6366F1", SEMANTIC: "#0EA5E9", AI: "#8B5CF6",
  MANUAL: "#F59E0B", FRAUD: "#F43F5E",
};

function RejectionsTab({ campaignId, jdId, onAdjustThreshold }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await getRejectionAnalytics(campaignId);
      setAnalytics(unwrap(res));
    } catch {
      toast.error("Failed to load rejection analytics.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // "refresh in real time" — same 60s cadence as the processing queue
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return <div className="py-12 flex justify-center"><LoadingSpinner text="Loading rejection analytics..." /></div>;
  }
  if (!analytics) return null;

  const layers = ["DETERMINISTIC", "SEMANTIC", "AI", "MANUAL", "FRAUD"];
  const maxCount = Math.max(1, ...layers.map((l) => analytics.layer_breakdown[l] || 0));

  return (<div className="space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Rejection Analytics</h3>
          <p className="text-[11px] text-slate-500">
            {analytics.total_rejections} rejection(s) across {analytics.total_candidates} candidate(s) · auto-refreshes every 60s
          </p>
        </div>
      </div>

      {/* recommendations panel */}
      {analytics.recommendations?.length > 0 && (<div className="space-y-2">
          {analytics.recommendations.map((rec) => (<div key={rec.condition} className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 text-[11.5px] text-amber-800">
                <span className="font-bold">{REJECTION_LAYER_LABELS[rec.layer] || rec.layer} rejection rate {rec.rate_pct}%</span>
                {" "}(threshold {rec.threshold_pct}%) — {rec.recommendation}
                {/* direct action link per recommendation */}
                <div className="mt-1.5">
                  {rec.action === "REVIEW_JD_SKILLS" && jdId && (<Link
                      to={`/ai-screening/jds/${jdId}`}
                      className="text-[11px] font-bold text-amber-900 underline hover:text-amber-700 inline-flex items-center gap-1"
                    >
                      Review JD Skills <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {rec.action === "ADJUST_THRESHOLD" && onAdjustThreshold && (<button
                      type="button"
                      onClick={onAdjustThreshold}
                      className="text-[11px] font-bold text-amber-900 underline hover:text-amber-700"
                    >
                      Adjust Threshold
                    </button>
                  )}
                  {rec.action === "REVIEW_PROMPT" && (<span className="text-[10px] text-amber-600 italic" title="Prompt version management UI is owned by the AI module and not yet available">
                      Review Prompt — prompt management screen pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!analytics.analytics_ready && (<div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11.5px] text-slate-500">
          Recommendations appear once at least {analytics.min_candidates_required} candidates have been processed
          (currently {analytics.total_candidates}).
        </div>
      )}

      {/* layer breakdown chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Rejections by Layer</h4>
        {layers.map((layer) => {
          const count = analytics.layer_breakdown[layer] || 0;
          return (<div key={layer}>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-bold text-slate-700">{REJECTION_LAYER_LABELS[layer] || layer}</span>
                <span className="font-black text-slate-900 tabular-nums">{count}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: REJECTION_LAYER_COLOR[layer] }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* top missing mandatory skill highlight */}
      {analytics.top_missing_skill && (<div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
          <Target className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
          <p className="text-[11.5px] text-indigo-800">
            Most common missing mandatory skill: <b>{analytics.top_missing_skill.canonical_name}</b> — missing for{" "}
            {analytics.top_missing_skill.count} candidate(s) ({analytics.top_missing_skill.percentage_of_deterministic}% of
            deterministic rejections). This may indicate a JD calibration issue.
          </p>
        </div>
      )}

      {/* top reasons table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left p-3 font-bold text-slate-400 uppercase text-[10px]">Rejection Reason</th>
              <th className="text-right p-3 font-bold text-slate-400 uppercase text-[10px]">Count</th>
              <th className="text-right p-3 font-bold text-slate-400 uppercase text-[10px]">% of Rejections</th>
            </tr>
          </thead>
          <tbody>
            {analytics.top_reasons.length === 0 ? (<tr><td colSpan={3} className="p-6 text-center text-slate-400 text-xs">No rejections recorded yet.</td></tr>
            ) : (analytics.top_reasons.map((r) => (<tr key={r.reason} className="border-b border-slate-50">
                  <td className="p-3 font-semibold text-slate-700">{r.reason}</td>
                  <td className="p-3 text-right tabular-nums text-slate-600">{r.count}</td>
                  <td className="p-3 text-right tabular-nums text-slate-600">{r.percentage}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Timeline Tab ---------------- */
function TimelineTab({ campaignId }) {
  const [events, setEvents] = useState([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [eventType, setEventType] = useState("");
  const [availableTypes, setAvailableTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const load = useCallback(async (reset) => {
    setLoading(true);
    try {
      const off = reset ? 0 : offset;
      const res = await getCampaignTimeline(campaignId, {
        limit: LIMIT, offset: off, event_type: eventType || undefined,
      });
      const data = unwrap(res);
      const list = data.events || [];
      setEvents((prev) => (reset ? list : [...prev, ...list]));
      setTotal(data.total_events || 0);
      setOffset(off + list.length);
      // server-computed from the FULL unfiltered timeline, so the dropdown
      // only ever offers types that actually exist for this campaign
      if (data.available_event_types) setAvailableTypes(data.available_event_types);
    } catch {
      toast.error("Failed to load timeline.");
    } finally {
      setLoading(false);
    }
  }, [campaignId, offset, eventType]);

  const eventTypeOptions = [
    { value: "", label: "All Events" },
    ...availableTypes.map((t) => ({ value: t, label: stageLabel(t) })),
  ];

  // Reload from scratch whenever the event-type filter changes
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [eventType]);

  const hasMore = events.length < total;

  return (<div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Activity Timeline</h3>
          <p className="text-[11px] text-slate-500">
            {total} event{total === 1 ? "" : "s"}{eventType ? " (filtered)" : ""}
          </p>
        </div>
        <div className="w-56 flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <div className="flex-1">
            <FilterListbox options={eventTypeOptions} value={eventType} onChange={setEventType} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        {events.length === 0 && !loading ? (<p className="text-xs text-slate-400 text-center py-8">No activity recorded.</p>
        ) : (<div className="space-y-6 relative border-l border-slate-200 pl-6 ml-2">
            {events.map((ev, idx) => (<div key={idx} className="relative">
                <span className="absolute -left-[30px] top-1 w-3.5 h-3.5 rounded-full border-2 border-blue-500 bg-blue-50" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded border border-indigo-100 uppercase">
                    {ev.event_type}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {fmtDate(ev.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-slate-700 mt-1">{ev.description}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">by {ev.actor_name || "System"}</p>
              </div>
            ))}
          </div>
        )}

        {loading && <div className="py-4 flex justify-center"><LoadingSpinner text="Loading..." /></div>}

        {hasMore && !loading && (<div className="flex justify-center mt-6">
            <Button variant="outline" size="small" onClick={() => load(false)}>
              Load More <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
