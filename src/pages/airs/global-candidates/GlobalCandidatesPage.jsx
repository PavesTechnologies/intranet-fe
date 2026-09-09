import React from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Search } from "lucide-react";
import Pagination from "../../../components/Pagination/pagination";
import LoadingSpinner from "../../../components/LoadingSpinner";
import ErrorState from "../skill-ontology/components/ErrorState";
import GenericTable from "../../../components/Table/table";
import { Badge } from "../../../components/ui/badge";
import Button from "../../../components/Button/Button";
import { renderParseStatusBadge, formatResumeDate } from "../resume-intake/utils/resumeIntakeUtils.jsx";
import { initialsFromName } from "../candidates/utils/candidateDataUtils";
import useCandidateDirectory from "./hooks/useCandidateDirectory";

const HEADERS = ["Candidate", "Designation", "Location", "Experience", "Jurisdiction", "Skills", "Resume Version", "Parse Status", "Uploaded", "Actions"];
const COLUMNS = ["candidate", "designation", "location", "experience", "jurisdiction", "skills", "resumeVersion", "parseStatus", "uploaded", "actions"];

// Global Candidate Directory — GET /candidates. Deliberately independent
// of the Talent Pool, Campaign Candidates, and Pipeline modules: its own
// service/hook, its own route, no ResumeSelectionService involvement.
// "View Profile" reuses the Pipeline Candidate Scorecard route — the only
// existing profile page in the app keyed by a bare candidate_id rather
// than a campaign-scoped id.
export default function GlobalCandidatesPage() {
  const navigate = useNavigate();
  const {
    items,
    loading,
    error,
    refetch,
    jurisdiction,
    setJurisdiction,
    currentPage,
    setCurrentPage,
    totalPages,
    totalResults,
  } = useCandidateDirectory();

  const viewProfile = (candidate) => {
    navigate(`/ai-screening/pipeline/candidates/${candidate.candidate_id}`, {
      state: {
        resume: {
          candidate_full_name: candidate.full_name,
          candidate_email: candidate.email,
          created_at: candidate.resume?.uploaded_at,
        },
      },
    });
  };

  const rows = items.map((c) => ({
    id: c.candidate_id,
    candidate: (
      <div className="flex items-center gap-2.5 text-left">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-gradient-to-br from-blue-600 to-indigo-600">
          {initialsFromName(c.full_name)}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">{c.full_name || "—"}</div>
          <div className="text-[11px] text-slate-400 truncate">{c.email || "—"}</div>
        </div>
      </div>
    ),
    designation: c.designation || "—",
    location: c.location || "—",
    experience: c.experience != null ? `${c.experience} yrs` : "—",
    jurisdiction: c.jurisdiction || "—",
    skills:
      c.skills && c.skills.length > 0 ? (
        <div className="flex flex-wrap gap-1 justify-center">
          {c.skills.slice(0, 3).map((s) => (
            <Badge key={s} className="bg-blue-50 text-blue-700 border-blue-100 font-medium px-2 py-0.5 text-[10.5px]">
              {s}
            </Badge>
          ))}
          {c.skills.length > 3 && <span className="text-[10.5px] text-slate-400">+{c.skills.length - 3}</span>}
        </div>
      ) : (
        <span className="text-slate-400">—</span>
      ),
    resumeVersion: c.resume ? `V${c.resume.version_number}` : "—",
    parseStatus: c.resume?.parse_status ? renderParseStatusBadge(c.resume.parse_status) : <span className="text-slate-400">—</span>,
    uploaded: c.resume?.uploaded_at ? formatResumeDate(c.resume.uploaded_at) : "—",
    actions: (
      <Button variant="outline" size="small" onClick={() => viewProfile(c)}>
        View Profile
      </Button>
    ),
  }));

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Candidates</h1>
        <p className="text-xs text-slate-500 mt-1">Every candidate in the system, independent of campaigns or the Talent Pool.</p>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 mb-4 max-w-xs">
        <Search size={15} className="text-slate-400 shrink-0" />
        <input
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          placeholder="Filter by jurisdiction — e.g. IN"
          maxLength={10}
          className="outline-none text-[13px] w-full bg-transparent text-slate-900"
        />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner text="Loading candidates..." />
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load candidates"
          message="Something went wrong while loading the candidate directory. Please try again."
          onRetry={refetch}
        />
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
          <Archive className="h-10 w-10 mx-auto stroke-1 mb-2" />
          No candidates found matching the criteria.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto mb-4">
            <GenericTable headers={HEADERS} columns={COLUMNS} rows={rows} />
          </div>

          {totalResults > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
              onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            />
          )}
        </>
      )}
    </div>
  );
}
