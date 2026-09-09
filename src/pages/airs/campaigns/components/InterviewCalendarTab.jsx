import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight, Users, CalendarX, X } from "lucide-react";
import Button from "@/components/Button/Button";
import { Badge } from "@/components/ui/badge";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { getCampaignInterviews } from "../services/campaignservice";
// Reuses the Interview tab's own status-tone-map — deliberately not the
// app-wide statusbadge.jsx, whose keyword heuristics don't fit this
// vocabulary (same reasoning as the round cards themselves).
import { STATUS_TONE, STATUS_LABEL } from "../../candidates/CandidateScore/tabs/Interview/interviewMock";

const STATUS_OPTIONS = ["PENDING", "SCHEDULED", "RESCHEDULED", "COMPLETED", "CANCELLED"];

// STATUS_TONE's colors are pastel badge fills — good for a badge, too
// washed-out for a left-border accent bar. Same color families (amber/
// blue/violet/emerald/rose), stronger shade, used for both the chip
// accent and the legend dot so the two stay unmistakably the same mapping.
const STATUS_ACCENT = {
  PENDING: { border: "border-l-amber-400", dot: "bg-amber-400" },
  SCHEDULED: { border: "border-l-blue-500", dot: "bg-blue-500" },
  RESCHEDULED: { border: "border-l-violet-500", dot: "bg-violet-500" },
  COMPLETED: { border: "border-l-emerald-500", dot: "bg-emerald-500" },
  CANCELLED: { border: "border-l-rose-500", dot: "bg-rose-500" },
};

// Week/Day blocks get their own full-border-plus-tint style (same color
// families as STATUS_ACCENT/STATUS_TONE, so the legend still means the same
// thing everywhere) — Month's cells are too small for anything beyond a
// left-border strip, but timeGrid gives each event real width and height to
// read as a proper colored block, closer to a personal-calendar look.
const STATUS_BLOCK_STYLE = {
  PENDING: "bg-amber-50 border-amber-400 text-amber-800",
  SCHEDULED: "bg-blue-50 border-blue-400 text-blue-800",
  RESCHEDULED: "bg-violet-50 border-violet-400 text-violet-800",
  COMPLETED: "bg-emerald-50 border-emerald-400 text-emerald-800",
  CANCELLED: "bg-rose-50 border-rose-400 text-rose-800",
};

const unwrap = (res) => (res && res.data !== undefined ? res.data : res);

function toDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatChipTime(isoStart) {
  if (!isoStart) return null;
  return new Date(isoStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function buildTooltip(entry) {
  const time = entry.start_at
    ? new Date(entry.start_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "Not scheduled";
  const interviewerNames = (entry.interviewers || []).map((i) => i.name).join(", ") || "—";
  return [
    entry.candidate_name,
    `Round ${entry.round_number}${entry.interview_type ? ` · ${entry.interview_type}` : ""}`,
    time,
    `Interviewers: ${interviewerNames}`,
    `Status: ${STATUS_LABEL[entry.status] || entry.status}`,
  ].join("\n");
}

// Week/Day (timeGrid) events get a full-bordered, tinted block — each event
// already has real width/height on those views, proportional to its
// duration, so it reads like a personal-calendar entry rather than a
// cramped list row.
//
// Top-aligned, not centered: a short (e.g. 15-30 min) interview gets very
// little height here, and centering 2-3 stacked lines inside a box shorter
// than their combined height clips the *top* line along with the bottom —
// candidate name included — leaving nothing readable. Top-aligning means
// the box always clips from the bottom down, so the name (line 1, the one
// thing that must stay legible) survives even when there's no room for
// anything else.
function TimeGridEventChip({ entry }) {
  const style = STATUS_BLOCK_STYLE[entry.status] || STATUS_BLOCK_STYLE.PENDING;
  const interviewerCount = entry.interviewers?.length || 0;

  return (
    <div
      title={buildTooltip(entry)}
      className={`w-full h-full border-2 rounded-lg px-1.5 py-0.5 flex flex-col justify-start overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${style}`}
    >
      <div className="flex items-center gap-1 w-full">
        <span className="text-[11.5px] font-bold leading-tight truncate flex-1 min-w-0">{entry.candidate_name}</span>
        {interviewerCount > 1 && (
          <span className="shrink-0 flex items-center gap-0.5 text-[9.5px] font-bold opacity-70">
            <Users size={9} /> {interviewerCount}
          </span>
        )}
      </div>
      <span className="text-[10px] font-medium leading-tight truncate w-full opacity-80">
        Round {entry.round_number}
        {entry.interview_type ? ` · ${entry.interview_type}` : ""}
      </span>
    </div>
  );
}

function EventChip({ entry, viewType }) {
  if (viewType && viewType !== "dayGridMonth") return <TimeGridEventChip entry={entry} />;

  const accent = STATUS_ACCENT[entry.status] || STATUS_ACCENT.PENDING;
  const time = formatChipTime(entry.start_at);
  const interviewerCount = entry.interviewers?.length || 0;

  return (
    <div
      title={buildTooltip(entry)}
      className={`w-full h-full bg-white border border-slate-200 border-l-4 ${accent.border} rounded-md px-2 py-1 text-[12px] leading-tight overflow-hidden shadow-sm hover:shadow-md hover:bg-slate-50 transition-all cursor-pointer`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold text-slate-900 truncate">{entry.candidate_name}</span>
        {interviewerCount > 1 && (
          <span className="shrink-0 flex items-center gap-0.5 text-[10.5px] font-bold text-slate-400">
            <Users size={10} /> {interviewerCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
        {time && <span className="font-medium text-slate-600 shrink-0">{time}</span>}
        <span className="truncate">
          {time && "· "}Round {entry.round_number}
          {entry.interview_type ? ` · ${entry.interview_type}` : ""}
        </span>
      </div>
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-slate-600">
      {STATUS_OPTIONS.map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${STATUS_ACCENT[status].dot}`} />
          {STATUS_LABEL[status]}
        </span>
      ))}
    </div>
  );
}

const VIEW_OPTIONS = [
  { id: "dayGridMonth", label: "Month" },
  { id: "timeGridWeek", label: "Week" },
  { id: "timeGridDay", label: "Day" },
];

// Same rounded-full-pill convention as the status filter buttons above —
// an exclusive 3-way toggle, so "active" here means "is the current view"
// rather than "is included in the filter".
function ViewSwitcher({ currentView, onChangeView }) {
  return (
    <div className="flex items-center gap-1.5">
      {VIEW_OPTIONS.map((view) => (
        <button
          key={view.id}
          type="button"
          onClick={() => onChangeView(view.id)}
          className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
            currentView === view.id
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

function CalendarToolbar({ title, onPrev, onNext, onToday, currentView, onChangeView }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="small" onClick={onPrev} aria-label="Previous" className="!px-2">
          <ChevronLeft size={15} />
        </Button>
        <Button variant="outline" size="small" onClick={onNext} aria-label="Next" className="!px-2">
          <ChevronRight size={15} />
        </Button>
        <Button variant="outline" size="small" onClick={onToday}>
          Today
        </Button>
      </div>
      <span className="text-[13.5px] font-bold text-slate-900">{title}</span>
      <ViewSwitcher currentView={currentView} onChangeView={onChangeView} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <CalendarX className="h-10 w-10 text-slate-300 mx-auto mb-3" />
      <p className="text-[13px] font-bold text-slate-700">No interviews scheduled in this range</p>
      <p className="text-[11.5px] text-slate-400 mt-1">Try a different month or adjust the filters above.</p>
    </div>
  );
}

// Campaign-wide interview calendar — every candidate's rounds in one
// campaign, not one candidate's. No pagination on the backend endpoint;
// the calendar's own visible range (start_date/end_date) is what bounds
// the result size, so only a range change re-fetches. Status/interviewer
// filters narrow that same fetched set client-side (see filteredEntries)
// instead of each triggering their own re-fetch.
export default function InterviewCalendarTab({ campaignId }) {
  const navigate = useNavigate();
  const calendarRef = useRef(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(null); // {startDate, endDate} — the calendar's current visible window
  const [calendarTitle, setCalendarTitle] = useState("");
  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [statusFilter, setStatusFilter] = useState([]); // [] = no filter, matches every status
  const [interviewerEmailInput, setInterviewerEmailInput] = useState(""); // draft, bound to the input
  const [appliedInterviewerEmail, setAppliedInterviewerEmail] = useState(""); // last value actually sent to the backend

  // Only the date range is ever sent to the backend — per this endpoint's
  // own contract there's no pagination, the whole visible range comes back
  // in one shot, so status/interviewer-email narrow that same in-memory
  // set (see filteredEntries below) rather than triggering a re-fetch.
  // Fetching pre-filtered by status would also break widening a filter
  // back out later (e.g. re-checking CANCELLED after unchecking it) since
  // whatever was excluded from a filtered fetch was never in `entries` to
  // begin with — always fetching the full range sidesteps that entirely.
  const fetchEntries = useCallback(
    async (nextRange) => {
      if (!nextRange) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getCampaignInterviews(campaignId, {
          startDate: nextRange.startDate,
          endDate: nextRange.endDate,
        });
        const items = unwrap(res);
        setEntries(Array.isArray(items) ? items : []);
      } catch (err) {
        setError(err);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [campaignId]
  );

  // FullCalendar calls this on first render and on every navigation
  // (prev/next/today, switching month/week) — the single trigger for a
  // fresh fetch with the newly-visible start_date/end_date.
  const handleDatesSet = (arg) => {
    const nextRange = { startDate: toDateOnly(arg.start), endDate: toDateOnly(arg.end) };
    setRange(nextRange);
    setCalendarTitle(arg.view.title);
    setCurrentView(arg.view.type);
    fetchEntries(nextRange);
  };

  // Switching campaigns (InterviewCalendarPage's own selector, a level up)
  // changes this prop without changing the calendar's visible date range,
  // so FullCalendar never calls datesSet for it — nothing else here reacts
  // to campaignId on its own. Guarded on `range` so this is a no-op on the
  // very first render (before datesSet has fired even once); every change
  // after that re-fetches whatever range is already on screen, for the
  // newly selected campaign.
  useEffect(() => {
    if (range) fetchEntries(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const changeView = (viewName) => calendarApi()?.changeView(viewName);

  // Purely local state changes now — no re-fetch, see fetchEntries above.
  const toggleStatus = (status) => {
    setStatusFilter((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  };

  const applyInterviewerEmail = () => setAppliedInterviewerEmail(interviewerEmailInput.trim());

  const clearAllFilters = () => {
    setStatusFilter([]);
    setInterviewerEmailInput("");
    setAppliedInterviewerEmail("");
  };

  const activeFilterCount = statusFilter.length + (appliedInterviewerEmail ? 1 : 0);

  // Status + interviewer-email filters, applied client-side to whatever
  // the current date range already fetched.
  const filteredEntries = useMemo(() => {
    const email = appliedInterviewerEmail.toLowerCase();
    return entries.filter((e) => {
      if (statusFilter.length && !statusFilter.includes(e.status)) return false;
      if (email && !(e.interviewers || []).some((i) => (i.email || "").toLowerCase().includes(email))) return false;
      return true;
    });
  }, [entries, statusFilter, appliedInterviewerEmail]);

  // PENDING rounds have no start_at/end_at — they can't be placed on a
  // date grid, so they're listed separately below instead of silently
  // dropped.
  const scheduledEntries = useMemo(() => filteredEntries.filter((e) => e.start_at && e.end_at), [filteredEntries]);
  const pendingEntries = useMemo(() => filteredEntries.filter((e) => !e.start_at || !e.end_at), [filteredEntries]);

  const events = useMemo(
    () => scheduledEntries.map((e) => ({ id: e.id, start: e.start_at, end: e.end_at, extendedProps: { entry: e } })),
    [scheduledEntries]
  );

  // This is a summary view only (no notes/meeting_link/history here by
  // design), so clicking through goes straight to the candidate's own
  // Interview tab via CandidateScorePage's ?tab= deep-link, rather than
  // landing on its default Summary tab and requiring one more click.
  // (There's still no deep-link to a specific *round* within that tab.)
  const goToCandidate = (entry) => navigate(`/ai-screening/candidates/${entry.campaign_candidate_id}?tab=interview`);

  const calendarApi = () => calendarRef.current?.getApi();

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-5">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 mb-1.5">Status</div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((status) => {
                const active = statusFilter.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                      active ? STATUS_TONE[status] : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-px bg-slate-100 self-stretch" />

          <div className="flex-1 min-w-[240px]">
            <div className="text-[11px] font-semibold text-slate-500 mb-1.5">Interviewer email</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={interviewerEmailInput}
                onChange={(e) => setInterviewerEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyInterviewerEmail()}
                placeholder="interviewer@company.com"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-[12.5px] outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button variant="outline" size="small" onClick={applyInterviewerEmail}>
                Search
              </Button>
            </div>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-slate-100">
            <span className="text-[11.5px] text-slate-500">
              {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
            </span>
            {statusFilter.map((status) => (
              <Badge key={status} className="bg-slate-100 text-slate-700 border-slate-200 font-semibold px-2.5 py-1 text-[11px] gap-1.5">
                {STATUS_LABEL[status]}
                <button type="button" onClick={() => toggleStatus(status)} className="hover:text-slate-950" aria-label={`Remove ${STATUS_LABEL[status]} filter`}>
                  <X size={10} />
                </button>
              </Badge>
            ))}
            {appliedInterviewerEmail && (
              <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-semibold px-2.5 py-1 text-[11px] gap-1.5">
                {appliedInterviewerEmail}
                <button
                  type="button"
                  onClick={() => {
                    setInterviewerEmailInput("");
                    setAppliedInterviewerEmail("");
                  }}
                  className="hover:text-slate-950"
                  aria-label="Remove interviewer email filter"
                >
                  <X size={10} />
                </button>
              </Badge>
            )}
            <button type="button" onClick={clearAllFilters} className="text-[11.5px] font-semibold text-blue-600 hover:underline">
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <CalendarToolbar
          title={calendarTitle}
          onPrev={() => calendarApi()?.prev()}
          onNext={() => calendarApi()?.next()}
          onToday={() => calendarApi()?.today()}
          currentView={currentView}
          onChangeView={changeView}
        />
        <StatusLegend />

        <div className="relative mt-3">
          {loading && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-xl z-10">
              <LoadingSpinner text="Loading interviews..." />
            </div>
          )}

          {error ? (
            <div className="py-16 text-center text-[12.5px] text-slate-500">Couldn't load the interview calendar. Please try again.</div>
          ) : (
            <>
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                height="auto"
                headerToolbar={false}
                // Week/Day views only — dayGrid ignores these. Keeps the
                // hour grid to a business-hours window instead of the
                // default full 00:00-24:00, which at height="auto" would
                // otherwise render as one very tall page.
                slotMinTime="07:00:00"
                slotMaxTime="21:00:00"
                events={events}
                datesSet={handleDatesSet}
                eventContent={(arg) => <EventChip entry={arg.event.extendedProps.entry} viewType={arg.view.type} />}
                eventClick={(arg) => goToCandidate(arg.event.extendedProps.entry)}
                // Without this, a 15-interview day would stack all 15 chips
                // in one cell, growing it far taller than its neighbors in
                // the same week row. `true` lets FullCalendar auto-fit
                // however many chips the cell's actual height allows, and
                // caps the rest behind a "+N more" link — a client-side
                // reveal, not a new fetch, since the whole visible range's
                // data is already loaded. The popover it opens reuses this
                // same eventContent renderer, so the extra events look
                // identical to the ones already on the grid.
                dayMaxEvents={true}
                moreLinkClassNames="!text-[11px] !font-semibold !text-blue-600 hover:!underline"
              />
              {!loading && filteredEntries.length === 0 && <EmptyState />}
            </>
          )}
        </div>
      </div>

      {pendingEntries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="text-[12.5px] font-bold text-slate-900 px-4 pt-4 pb-3">Not yet scheduled ({pendingEntries.length})</div>
          <ul className="divide-y divide-slate-100">
            {pendingEntries.map((e) => (
              <li key={e.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-slate-50/60 transition-colors">
                <span className="text-[12.5px] text-slate-700">
                  <span className="font-semibold text-slate-900">{e.candidate_name}</span>{" "}
                  <span className="text-slate-400">
                    · Round {e.round_number}
                    {e.interview_type ? ` · ${e.interview_type}` : ""}
                  </span>
                </span>
                <Button variant="outline" size="small" onClick={() => goToCandidate(e)}>
                  View Candidate
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
