import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Activity, AlertTriangle, Briefcase, CheckCircle2,
  FileUp, Search, Users,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import Button from "../../../components/Button/Button";
import FilterListbox from "../../../components/filter/FilterListbox";
import { KPICard } from "../../../components/kpi/KPI";
import Pagination from "../../../components/Pagination/pagination";
import useDashboardSection from "./hooks/useDashboardSection";
import CampaignTable from "./components/CampaignTable";
import NavBadges from "./components/NavBadges";
import OverrideRateAlerts from "./components/OverrideRateAlerts";
import PlatformHealthStrip from "./components/PlatformHealthStrip";
import {
  EmptyState, SectionError,
} from "./components/DashboardStates";
import {
  getDashboardCampaigns, getHrAdminSummary, getRecruiterSummary,
} from "./services/dashboardService";

// `muted` drops a zero to grey: on an attention row, "0 AI failures" is good
// news and should not compete for the eye with a real count.
function MetricTile({ label, value, icon: Icon, color, muted = false }) {
  const isZero = value === 0 || value === null || value === undefined;
  return (
    <KPICard
      label={label}
      value={value ?? "—"}
      icon={Icon ? <Icon className="h-5 w-5" /> : null}
      color={muted && isZero ? "bg-slate-50 text-slate-400" : color}
      className="h-full"
    />
  );
}

// All KPIs in a single responsive row rather than grouped bands.
function MetricRow({ children, cols }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 ${cols} gap-4`}>
      {children}
    </div>
  );
}

export default function AirsDashboardPage() {
  const { hasRole } = useAuth();
  const isHRAdmin = hasRole(["HR_ADMIN"]);
  const isRecruiter = hasRole(["RECRUITER"]);

  // Two independent sections: a summary failure must not hide the campaigns,
  // And vice versa.
  const summaryFetcher = useCallback(
    () => (isHRAdmin ? getHrAdminSummary() : getRecruiterSummary()),
    [isHRAdmin],
  );
  const summary = useDashboardSection(summaryFetcher, [isHRAdmin]);

  // Search is debounced so typing doesn't fire a request per keystroke;
  // status applies immediately since it's a discrete choice.
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // A new search/status result set invalidates whatever page we were on.
  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  const campaignsFetcher = useCallback(
    () => getDashboardCampaigns({
      limit: 12,
      search: debouncedSearch || undefined,
      status,
      // "Closed" is only reachable by asking for it explicitly
      show_closed: status === "CLOSED",
    }),
    [debouncedSearch, status],
  );
  const campaigns = useDashboardSection(campaignsFetcher, [debouncedSearch, status]);

  // HIRING_MANAGER has no dashboard of its own — send them to the campaign
  // list they are already scoped to rather than rendering an empty shell.
  if (!isHRAdmin && !isRecruiter) return <Navigate to="/ai-screening/campaigns" replace />;

  const s = summary.data;
  const cards = campaigns.data || [];
  const hasFilters = Boolean(debouncedSearch) || status !== "All";
  const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const pagedCards = cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-[#F8FAFC] text-slate-900 font-sans min-h-screen p-6 space-y-6">
      {/* Nav + service health, without the welcome banner. Health lives here
          rather than its own card: when everything is fine it is one line,
          not a full row of green pills. */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <NavBadges />
        {isHRAdmin && s && (
          <div className="shrink-0">
            <PlatformHealthStrip breakers={s.platform_health} />
          </div>
        )}
      </div>

      {/* Warnings sit directly under the header — they were previously below
          the campaign table, i.e. below the fold on most screens, which is the
          one place an alert must never be. */}
      {isHRAdmin && <OverrideRateAlerts />}

      {/* ── Activity summary ───────────────────────────────── */}
      {/* Tiles render immediately with empty values and fill in once the
          summary resolves — no loading state, no layout jump. */}
      {summary.error && (
        <SectionError
          message="Your activity summary could not be loaded."
          onRetry={summary.retry}
        />
      )}

      {!summary.error && isHRAdmin && (
        <MetricRow cols="md:grid-cols-5">
          <MetricTile label="Active Campaigns" value={s?.active_campaigns} icon={Briefcase} />
          <MetricTile label="New (7d)" value={s?.candidates_last_7_days} icon={FileUp} />
          <MetricTile label="Shortlisted" value={s?.shortlisted_candidates}
            icon={CheckCircle2} color="bg-sky-50 text-sky-600" />
          <MetricTile label="HM Review" value={s?.hm_review_pending}
            icon={Users} color="bg-teal-50 text-teal-600" />
          {/* A zero here is good news, so it's greyed rather than competing
              for attention with the numbers you report. */}
          <MetricTile label="Skills Review" value={s?.pending_unknown_skills}
            icon={Activity} color="bg-indigo-50 text-indigo-600" muted />
        </MetricRow>
      )}

      {!summary.error && !isHRAdmin && (
        <MetricRow cols="md:grid-cols-5">
          <MetricTile label="My Uploads" value={s?.campaigns_uploaded_to} icon={Briefcase} />
          <MetricTile label="Created" value={s?.campaigns_created} icon={Briefcase} />
          <MetricTile label="Resumes (7d)" value={s?.resumes_last_7_days} icon={FileUp} />
          <MetricTile label="Shortlisted" value={s?.shortlisted_from_my_uploads}
            icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
          <MetricTile label="Needs Attention" value={s?.failed_bulk_jobs}
            icon={AlertTriangle} color="bg-rose-50 text-rose-600" muted />
        </MetricRow>
      )}

      {/* ── Campaign cards ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-slate-900 shrink-0">
            {isHRAdmin ? "Campaigns" : "My Campaigns"}
            {!campaigns.loading && !campaigns.error && (
              <span className="ml-2 text-[11px] font-bold text-slate-400">
                {cards.length}
              </span>
            )}
          </h2>

          {/* Search matches campaign name or JD title */}
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <div className="relative w-full max-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search campaigns or JD..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="w-36 shrink-0">
              <FilterListbox
                options={[
                  { value: "All", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "PAUSED", label: "Paused" },
                  { value: "CLOSED", label: "Closed" },
                ]}
                value={status}
                onChange={setStatus}
              />
            </div>
            <Link to="/ai-screening/campaigns" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 shrink-0">
              View all
            </Link>
          </div>
        </div>

        {campaigns.loading && <CampaignTable campaigns={[]} loading />}

        {!campaigns.loading && campaigns.error && (
          <SectionError message="Campaign data could not be loaded." onRetry={campaigns.retry} />
        )}

        {/* A filtered-to-empty result is a different situation from
            having no campaigns at all, and needs a way back rather than
            onboarding advice. */}
        {!campaigns.loading && !campaigns.error && cards.length === 0 && (
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="No campaigns match your current filters"
              message="Try a different search term or status."
              action={
                <Button variant="outline" size="small"
                  onClick={() => { setSearch(""); setStatus("All"); }}>
                  Clear Filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Briefcase}
              title="No campaigns to display yet"
              message={isHRAdmin
                ? "Create a campaign from a verified job description to start screening."
                : "Ask your HR Admin to assign you to a campaign, or start uploading to an existing one."}
              action={
                <Link to={isHRAdmin ? "/ai-screening/campaigns" : "/ai-screening/resume-intake"}>
                  <Button variant="primary" size="small">
                    {isHRAdmin ? "Go to Campaigns" : "Start Uploading"}
                  </Button>
                </Link>
              }
            />
          )
        )}

        {!campaigns.loading && !campaigns.error && cards.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <CampaignTable campaigns={pagedCards} />
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </>
        )}
      </div>

    </div>
  );
}
