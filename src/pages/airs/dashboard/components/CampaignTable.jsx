import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertOctagon, CalendarClock, Hourglass, Target } from "lucide-react";
import GenericTable from "../../../../components/Table/table";

const STATUS_PILL = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAUSED: "bg-amber-50 text-amber-700 border-amber-200",
  CLOSED: "bg-slate-100 text-slate-600 border-slate-300",
};

const deadlineLabel = (deadline, isOverdue) => {
  if (!deadline) return "—";
  if (isOverdue) return "Overdue";
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return `${days}d left`;
};

// Health indicators are precomputed server-side; the table only decides how to
// render them. Capped at two so the column can't blow the layout out.
function healthBadges(c) {
  const badges = [];
  if (c.is_overdue) badges.push({ label: "Overdue", tone: "bg-rose-50 text-rose-700", icon: CalendarClock });
  else if (c.deadline_soon) badges.push({ label: "Due soon", tone: "bg-amber-50 text-amber-700", icon: CalendarClock });
  if (c.approaching_cap) badges.push({ label: "Near full", tone: "bg-indigo-50 text-indigo-700", icon: Target });
  if (c.stalled_count > 0) badges.push({ label: `${c.stalled_count} stalled`, tone: "bg-amber-50 text-amber-700", icon: Hourglass });
  if (c.ai_failure_count > 0) badges.push({ label: `${c.ai_failure_count} AI failed`, tone: "bg-rose-50 text-rose-700", icon: AlertOctagon });
  return badges.slice(0, 2);
}

// The count itself is the quick link — clicking it opens the
// campaign's candidate list already filtered to that stage, and the URL is
// shareable. Zero renders as plain text so there's nothing to click.
function StageLink({ campaignId, stage, count }) {
  if (!count) return <span className="text-slate-300">0</span>;
  return (
    <Link
      to={`/ai-screening/campaigns/${campaignId}?tab=candidates&stage=${stage}`}
      onClick={(e) => e.stopPropagation()}
      className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline tabular-nums"
    >
      {count}
    </Link>
  );
}

export default function CampaignTable({ campaigns, loading = false }) {
  const navigate = useNavigate();

  const headers = [
    "Campaign", "Status", "Candidates", "Shortlisted",
    "HM Review", "Filled", "Health", "Hiring Manager", "Deadline",
  ];
  const columns = [
    "campaign", "status", "candidates", "shortlisted",
    "hm_review", "filled", "health", "hiring_manager", "deadline",
  ];

  const rows = campaigns.map((c) => {
    const status = (c.status || "").toUpperCase();
    const badges = healthBadges(c);
    return {
      id: c.id,
      rowClass: "hover:bg-slate-50/50 transition cursor-pointer",
      onRowClick: () => navigate(`/ai-screening/campaigns/${c.id}`),
      campaign: (
        <div className="min-w-0 max-w-[160px] text-left">
          <div className="font-semibold text-slate-900 line-clamp-1" title={c.name}>{c.name}</div>
          <div className="text-[11px] text-slate-400 line-clamp-1" title={c.jd_title || ""}>
            {c.jd_title || "—"}{c.jd_version != null && ` · v${c.jd_version}`}
          </div>
        </div>
      ),
      status: (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${STATUS_PILL[status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
          {status || "—"}
        </span>
      ),
      candidates: <span className="tabular-nums text-slate-700">{c.candidate_count}</span>,
      shortlisted: <StageLink campaignId={c.id} stage="SHORTLISTED" count={c.shortlisted_count} />,
      hm_review: <StageLink campaignId={c.id} stage="HM_REVIEW" count={c.hm_review_count} />,
      filled: (
        <span className="tabular-nums text-slate-700">
          {c.selected_count}{c.max_candidates != null && ` / ${c.max_candidates}`}
        </span>
      ),
      health: badges.length ? (
        <div className="flex flex-wrap gap-1 justify-center">
          {badges.map((b) => (
            <span key={b.label} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${b.tone}`}>
              <b.icon className="h-3 w-3" /> {b.label}
            </span>
          ))}
        </div>
      ) : <span className="text-slate-300">—</span>,
      hiring_manager: (
        <span className="text-[11px] text-slate-600 truncate">{c.hiring_manager || "Unassigned"}</span>
      ),
      deadline: (
        <span className={`text-[11px] ${c.is_overdue ? "text-rose-600 font-bold" : "text-slate-600"}`}>
          {deadlineLabel(c.deadline, c.is_overdue)}
        </span>
      ),
    };
  });

  return <GenericTable headers={headers} columns={columns} rows={rows} loading={loading} />;
}
