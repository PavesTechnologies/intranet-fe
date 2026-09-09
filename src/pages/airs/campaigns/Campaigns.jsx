import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Briefcase, Plus, Search, Calendar, Sliders,
} from "lucide-react";
import { EditIcon } from "../../../components/icons/ActionIcons";
import Button from "../../../components/Button/Button";
import Modal from "../../../components/ui/Modal";
import FilterListbox from "../../../components/filter/FilterListbox";
import LoadingSpinner from "../../../components/LoadingSpinner";
import Pagination from "../../../components/Pagination/pagination";
import NewCampaignForm from "./components/NewCampaignForm";
import EditCampaignModal from "./components/EditCampaignModal";
import WeightPresetsModal from "./components/WeightPresetsModal";
import useCampaignPermissions from "./hooks/useCampaignPermissions";
import { getAllJDs } from "../service/jdservice";
import {
  createCampaign,
  getAllCampaigns,
  getAllCampaignsHrAdmin,
  getCampaignsByHiringManager,
  getCampaignDetails,
  getPipelineSummary,
  getNameByRoles,
  formatApiError,
} from "./services/campaignservice";

const DEFAULT_CAMPAIGN_FORM = {
  jd_id: "",
  name: "",
  max_candidates: 1,
  deadline: "",
  weight_deterministic: 30,
  weight_semantic: 40,
  weight_ai: 30,
  semantic_threshold: 0.65,
  ai_threshold: 50,
  hiring_manager_id: "",
  recruiter_id: "",
  prompt_template_id: "",
  ai_evaluate_prompt_id: "",
  deterministic_threshold: 70,
};

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "All" },
  { label: "Active", value: "ACTIVE" },
  { label: "Paused", value: "PAUSED" },
  { label: "Closed", value: "CLOSED" },
];

const STATUS_BADGE = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PAUSED: "bg-amber-50 text-amber-700",
  CLOSED: "bg-slate-100 text-slate-600",
  DRAFT: "bg-slate-100 text-slate-700",
};

const CAMPAIGNS_PER_PAGE = 6;

// Title-case a status enum for display, e.g. "ACTIVE" -> "Active"
const statusLabel = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—";

// Reduce a pipeline-summary payload into the three headline counts the card shows.
// Funnel stage counts are cumulative (candidates that reached that stage), so
// they map directly onto "candidates / shortlisted / selected".
const deriveStats = (summary) => {
  const stageCount = (key) =>
    (summary?.stages || []).find((s) => s.stage === key)?.count ?? 0;
  return {
    candidates: summary?.total_candidates ?? 0,
    shortlisted: stageCount("SHORTLISTED"),
    selected: stageCount("SELECTED"),
  };
};

export default function Campaigns() {
  const navigate = useNavigate();
  const {
    isHRAdmin, isHiringManager, canManageCampaigns, canManageScoring,
    canViewPipeline,
  } = useCampaignPermissions();

  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search / filter / pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  // Create-campaign modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [campaignForm, setCampaignForm] = useState(DEFAULT_CAMPAIGN_FORM);
  const [jdList, setJdList] = useState([]);

  // Edit-campaign modal (opened from a card) — needs the full detail response
  // (current candidate count + scoring config) for correct validation.
  const [editCampaignId, setEditCampaignId] = useState(null);
  const [editDetail, setEditDetail] = useState(null);
  const [editLoadingId, setEditLoadingId] = useState(null);
  const [presetsModalOpen, setPresetsModalOpen] = useState(false);

  const handleEditClick = async (e, campaign) => {
    e.stopPropagation();                 // don't trigger the card's navigate
    setEditLoadingId(campaign.id);
    try {
      const res = await getCampaignDetails(campaign.id);
      setEditDetail(res?.data || res);
      setEditCampaignId(campaign.id);
    } catch {
      toast.error("Failed to load campaign for editing.");
    } finally {
      setEditLoadingId(null);
    }
  };

  // HR_ADMIN's list endpoint paginates/searches/filters server-side (fixed
  // page size of 6), so its query params must be debounced and re-sent on
  // every search/status/page change instead of filtered client-side.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [hrTotalPages, setHrTotalPages] = useState(1);
  const fetchHrAdminCampaigns = useCallback(async () => {
    if (!isHRAdmin) return;
    setIsLoading(true);
    try {
      // show_closed: true — the page has a "Closed" KPI card and status
      // filter, so closed campaigns must actually be in the dataset
      const res = await getAllCampaignsHrAdmin({
        show_closed: true,
        search: debouncedSearch || undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
        page: currentPage,
      });
      const data = res?.data || {};
      const items = Array.isArray(data.items) ? data.items : [];
      setCampaigns(items);
      setHrTotalPages(Math.max(1, Math.ceil((data.total ?? items.length) / (data.page_size || CAMPAIGNS_PER_PAGE))));
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      toast.error("Failed to load campaigns.");
    } finally {
      setIsLoading(false);
    }
  }, [isHRAdmin, debouncedSearch, statusFilter, currentPage]);

  useEffect(() => { fetchHrAdminCampaigns(); }, [fetchHrAdminCampaigns]);

  // Other roles: full list fetched once, filtered/paginated client-side below
  const fetchCampaigns = useCallback(async () => {
    if (isHRAdmin) return;
    setIsLoading(true);
    try {
      const res = isHiringManager
        ? await getCampaignsByHiringManager({ show_closed: true })
        : await getAllCampaigns({ show_closed: true });
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.items)
          ? res.data.items
          : Array.isArray(res)
            ? res
            : [];
      setCampaigns(list);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      toast.error("Failed to load campaigns.");
    } finally {
      setIsLoading(false);
    }
  }, [isHRAdmin, isHiringManager]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Unified refresh after create/edit, regardless of which path is active
  const refreshCampaigns = useCallback(() => {
    if (isHRAdmin) fetchHrAdminCampaigns();
    else fetchCampaigns();
  }, [isHRAdmin, fetchHrAdminCampaigns, fetchCampaigns]);

  // Resolve hiring-manager / recruiter user IDs to display names.
  // The campaign list returns these people as bare user IDs (e.g. "5100022"),
  // so we build an id -> name map from the role directory once on mount.
  // Best-effort: this UMS endpoint may be admin-only, so we degrade to the raw
  // ID when it isn't available for the current role.
  const [userMap, setUserMap] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([
        getNameByRoles("HIRING_MANAGER"),
        getNameByRoles("RECRUITER"),
      ]);
      if (cancelled) return;
      const map = {};
      results.forEach((r) => {
        if (r.status !== "fulfilled") return;
        const list = Array.isArray(r.value) ? r.value : (r.value?.data || []);
        list.forEach((u) => {
          if (u?.user_id != null) map[String(u.user_id)] = u.employee_name || String(u.user_id);
        });
      });
      setUserMap(map);
    })();
    return () => { cancelled = true; };
  }, []);

  // JDs for the create modal's JD selector — loaded once, lazily, when the modal first opens
  useEffect(() => {
    if (!createModalOpen || jdList.length > 0) return;
    (async () => {
      try {
        const res = await getAllJDs({ page: 1, limit: 100 });
        setJdList(res?.data?.items || []);
      } catch {
        toast.error("Failed to load job descriptions.");
      }
    })();
  }, [createModalOpen, jdList.length]);

  //only verified+active jobs are campaign create eligible
  const eligibleJds = useMemo(() => jdList.filter((jd) => jd.is_active_version && (jd.is_verified || "").toUpperCase() === "VERIFIED"
    ),
    [jdList]
  );

  const jdOptions = useMemo(() => ([
    {
      value: "",
      label: eligibleJds.length === 0 && jdList.length > 0
        ? "No verified JDs available"
        : "Select a job description",
    },
    ...eligibleJds.map((jd) => ({ value: jd.id, label: jd.title })),
  ]), [eligibleJds, jdList.length]);

  // Client-side search + status filter — HR_ADMIN already gets a filtered,
  // paginated page from the server, so `campaigns` there IS the page to show.
  const filteredCampaigns = useMemo(() => {
    if (isHRAdmin) return campaigns;
    const query = searchQuery.toLowerCase();
    return campaigns.filter((c) => {
      const matchesQuery =
        (c.name || "").toLowerCase().includes(query) ||
        (c.jd_title || "").toLowerCase().includes(query) ||
        (c.hiring_manager || "").toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All" || (c.status || "").toUpperCase() === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [campaigns, searchQuery, statusFilter, isHRAdmin]);

  const clientTotalPages = Math.max(1, Math.ceil(filteredCampaigns.length / CAMPAIGNS_PER_PAGE));
  const totalPages = isHRAdmin ? hrTotalPages : clientTotalPages;
  const paginatedCampaigns = useMemo(() => {
    if (isHRAdmin) return filteredCampaigns;
    const start = (currentPage - 1) * CAMPAIGNS_PER_PAGE;
    return filteredCampaigns.slice(start, start + CAMPAIGNS_PER_PAGE);
  }, [filteredCampaigns, currentPage, isHRAdmin]);

  // Real candidate metrics per card come from the pipeline-summary endpoint.
  // We only fetch the campaigns visible on the current page, in parallel, and
  // cache by id so paging back and forth doesn't re-hit the API.
  //   value === undefined -> not fetched yet (loading placeholder)
  //   value === null       -> unavailable (e.g. role can't see the pipeline)
  //   value === object     -> real { candidates, shortlisted, selected }
  const [pipelineStats, setPipelineStats] = useState({});
  // Tracks ids already requested (in-flight or done) so the effect below can't
  // fire a duplicate fetch for the same campaign — e.g. if it re-runs again
  // before the previous getPipelineSummary() call has landed in state.
  const requestedIdsRef = useRef(new Set());
  useEffect(() => {
    // HIRING_MANAGER can't call pipeline-summary at all (backend 403s it) —
    // don't fire a doomed request per visible card; cards fall back to the
    // "Pipeline metrics unavailable" state.
    if (!canViewPipeline) return;
    const idsOnPage = [...new Set(paginatedCampaigns.map((c) => c.id).filter(Boolean))];
    const missing = idsOnPage.filter((id) => !(id in pipelineStats) && !requestedIdsRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requestedIdsRef.current.add(id));

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(missing.map(async (id) => {
          try {
            const res = await getPipelineSummary(id);
            return [id, deriveStats(res?.data ?? res)];
          } catch {
            return [id, null]; // no pipeline access / not found — degrade gracefully
          }
        })
      );
      if (!cancelled) {
        setPipelineStats((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    })();

    return () => {
      cancelled = true;
      // Release ids whose fetch never landed in pipelineStats (effect re-ran
      // or unmounted before it resolved) so they're retried instead of stuck
      // "requested" forever; ids that did land are already excluded above via
      // the `id in pipelineStats` check, so this is a no-op for those.
      missing.forEach((id) => requestedIdsRef.current.delete(id));
    };
  }, [paginatedCampaigns, pipelineStats, canViewPipeline]);

  // ---- Create campaign ----
  const handleCampaignFormChange = (e) => {
    const { name, value } = e.target;
    setCampaignForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleInitiateCampaign = async () => {
    const trimmedName = campaignForm.name.trim();
    if (!campaignForm.jd_id) return toast.error("Please select a job description.");
    if (!trimmedName) return toast.error("Campaign name cannot be empty.");
    if (trimmedName.length > 255) return toast.error("Campaign name must be 255 characters or fewer.");
    if (campaigns.some((c) => (c.name || "").toLowerCase() === trimmedName.toLowerCase())) {
      return toast.error(`A campaign named "${trimmedName}" already exists.`);
    }
    if (!String(campaignForm.hiring_manager_id).trim()) return toast.error("Please select a hiring manager.");
    if (!String(campaignForm.recruiter_id).trim()) return toast.error("Please select a recruiter.");
    // prompt requirement is enforced inside NewCampaignForm, conditional on
    // the template lookup actually having options (backend not deployed yet)
    if (campaignForm.max_candidates !== "" && campaignForm.max_candidates !== null && Number(campaignForm.max_candidates) <= 0) {
      return toast.error("Max candidates must be greater than 0.");
    }
    const weightsSum = Number(campaignForm.weight_deterministic) + Number(campaignForm.weight_semantic) + Number(campaignForm.weight_ai);
    if (Math.abs(weightsSum - 100) > 0.01) return toast.error("Scoring weights must sum to 100.00");

    const payload = {
      name: trimmedName,
      jd_id: campaignForm.jd_id,
      max_candidates: campaignForm.max_candidates === "" || campaignForm.max_candidates === null ? null : Number(campaignForm.max_candidates),
      deadline: campaignForm.deadline ? new Date(campaignForm.deadline).toISOString() : null,
      weight_deterministic: Number(campaignForm.weight_deterministic),
      weight_semantic: Number(campaignForm.weight_semantic),
      weight_ai: Number(campaignForm.weight_ai),
      semantic_threshold: Number(campaignForm.semantic_threshold),
      ai_threshold: Number(campaignForm.ai_threshold),
      deterministic_threshold: Number(campaignForm.deterministic_threshold),
      hiring_manager_id: String(campaignForm.hiring_manager_id).trim(),
      recruiter_id: String(campaignForm.recruiter_id).trim(),
      prompt_template_id: String(campaignForm.prompt_template_id || "").trim(),
      ai_evaluate_prompt_id: String(campaignForm.ai_evaluate_prompt_id || "").trim(),
    };

    setIsSubmitting(true);
    try {
      const response = await createCampaign(payload);
      if (response?.success === false) {
        toast.error(response.message || "Failed to initiate campaign.");
        return;
      }
      toast.success(response?.message || "Campaign initiated successfully.");
      setCreateModalOpen(false);
      setCampaignForm(DEFAULT_CAMPAIGN_FORM);
      refreshCampaigns();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to initiate campaign."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (<div className="relative min-h-screen p-8 bg-slate-50/40 text-slate-800 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Campaigns</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Create hiring campaigns, monitor screening pipelines, and track candidate progress.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManageScoring && (<Button variant="outline" size="medium" onClick={() => setPresetsModalOpen(true)}>
              <Sliders className="h-4 w-4" /> Presets
            </Button>
          )}
          {canManageCampaigns && (<Button
              variant="primary"
              size="medium"
              onClick={() => {
                setCampaignForm(DEFAULT_CAMPAIGN_FORM);
                setCreateModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar: search + status filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-end mb-6">
        <div className="relative flex-1 max-w-[560px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, JD, or hiring manager..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white shadow-sm"
          />
        </div>
        <div className="w-44">
          <FilterListbox
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Campaign cards */}
      {isLoading ? (<div className="flex justify-center py-16">
          <LoadingSpinner text="Loading campaigns..." />
        </div>
      ) : filteredCampaigns.length === 0 ? (<div className="text-center py-16 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-700">No campaigns found</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {campaigns.length === 0 && !searchQuery && statusFilter === "All"
              ? "Create your first campaign to start screening candidates."
              : "Try adjusting your search or status filter."}
          </p>
        </div>
      ) : (<>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedCampaigns.map((c) => {
              const status = (c.status || "").toUpperCase();
              // Prefer a name field if the backend sends one, else resolve the
              // ID via the role directory, else show whatever we have.
              const managerName =
                c.hiring_manager_name ||
                userMap[String(c.hiring_manager)] ||
                c.hiring_manager ||
                "Unassigned";
              const initials = String(managerName).substring(0, 2).toUpperCase();

              // Real pipeline metrics (undefined = loading, null = unavailable).
              // Roles without pipeline access resolve straight to "unavailable"
              // since no fetch is ever attempted for them.
              const stats = canViewPipeline ? pipelineStats[c.id] : null;
              const hasStats = stats != null;
              const progressPct = hasStats
                ? c.max_candidates
                  ? Math.min(100, Math.round((stats.selected / c.max_candidates) * 100))
                  : stats.candidates
                    ? Math.min(100, Math.round((stats.selected / stats.candidates) * 100))
                    : 0
                : 0;

              return (<div
                  key={c.id}
                  onClick={() => navigate(`/ai-screening/campaigns/${c.id}`)}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 cursor-pointer hover:border-blue-300 transition"
                >
                  {/* Title + status + edit shortcut */}
                  <div>
                    <div className="flex justify-between items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900 leading-snug truncate">{c.name}</h4>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[status] || "bg-slate-50 text-slate-600"}`}>
                          {statusLabel(status)}
                        </span>
                        {/* Edit shortcut — HR_ADMIN only, closed campaigns are read-only
                        {canManageCampaigns && status !== "CLOSED" && (<button
                            onClick={(e) => handleEditClick(e, c)}
                            disabled={editLoadingId === c.id}
                            title="Edit campaign"
                            className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-50"
                          >
                            {editLoadingId === c.id ? (<span className="block h-3.5 w-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            ) : (<EditIcon className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )} */}
                      </div>
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
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  ) : (<p className="text-[11px] text-slate-400 font-medium">
                      Pipeline metrics unavailable
                    </p>
                  )}

                  {/* Footer: manager + deadline */}
                  <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                        {initials}
                      </div>
                      <span className="text-xs font-bold text-slate-700 truncate">{managerName}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                      <Calendar className="h-3 w-3" />
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
            currentPage={currentPage}
            totalPages={totalPages}
            onPrevious={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            onNext={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="mt-6"
          />
        </>
      )}

      {/* Create Campaign Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Initiate Recruitment Campaign"
        width="640px"
        height="90vh"
      >
        <NewCampaignForm
          jdOptions={jdOptions}
          campaignForm={campaignForm}
          handleCampaignFormChange={handleCampaignFormChange}
          setLinkCampaignModalOpen={setCreateModalOpen}
          isSubmittingCampaign={isSubmitting}
          handleInitiateCampaign={handleInitiateCampaign}
        />
      </Modal>

      {canManageScoring && (<WeightPresetsModal isOpen={presetsModalOpen} onClose={() => setPresetsModalOpen(false)} />
      )}

      {/* Edit Campaign Modal (opened from a card's edit button) */}
      {editDetail && (<EditCampaignModal
          isOpen={!!editCampaignId}
          onClose={() => { setEditCampaignId(null); setEditDetail(null); }}
          campaignId={editCampaignId}
          detail={editDetail}
          existingNames={campaigns
            .filter((c) => c.id !== editCampaignId)
            .map((c) => (c.name || "").toLowerCase())}
          onSaved={() => {
            setEditCampaignId(null);
            setEditDetail(null);
            refreshCampaigns();
          }}
        />
      )}
    </div>
  );
}
