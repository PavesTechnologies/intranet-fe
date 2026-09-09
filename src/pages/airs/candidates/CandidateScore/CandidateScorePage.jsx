import React, { useState, lazy, Suspense } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import LoadingSpinner from "@/components/LoadingSpinner";
import useCandidateDetail from "../hooks/useCandidateDetail";
import CandidateHeader from "./components/CandidateHeader";
import CandidateTabs from "./components/CandidateTabs";
import ErrorState from "../../skill-ontology/components/ErrorState";
import CandidateOverridePanel from "../../campaigns/components/CandidateOverridePanel";
import CandidateNotesPanel from "../../campaigns/components/CandidateNotesPanel";
import { exportScorecard } from "../../campaigns/services/exportService";
import Button from "../../../../components/Button/Button";
import { Download } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../../../contexts/AuthContext";
import { SCORE_LABELS } from "../../constants/scoreLabels";

const SummaryTab = lazy(() => import("./tabs/Summary/SummaryTab"));
const ResumeTab = lazy(() => import("./tabs/Resume/ResumeTab"));
const DeterministicScoreTab = lazy(() => import("./tabs/Deterministic/DeterministicScoreTab"));
const SemanticScoreTab = lazy(() => import("./tabs/Semantic/SemanticScoreTab"));
const AiEvaluationTab = lazy(() => import("./tabs/AiEvaluation/AiEvaluationTab"));
const InterviewTab = lazy(() => import("./tabs/Interview/InterviewTab"));
const FinalStatusTab = lazy(() => import("./tabs/FinalStatus/FinalStatusTab"));

const TABS = [
  { id: "summary", label: "Summary", Component: SummaryTab },
  { id: "resume", label: "Resume", Component: ResumeTab },
  { id: "deterministic", label: SCORE_LABELS.deterministic, Component: DeterministicScoreTab },
  { id: "semantic", label: SCORE_LABELS.semantic, Component: SemanticScoreTab },
  { id: "ai", label: SCORE_LABELS.ai, Component: AiEvaluationTab },
  { id: "finalStatus", label: "Final Status", Component: FinalStatusTab },
  { id: "interview", label: "Interview", Component: InterviewTab }, 
];

export default function CandidateScorePage() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { candidate, loading, error, refetch } = useCandidateDetail(candidateId);
  // Lets a caller (e.g. the Interview Calendar's event chips) deep-link
  // straight into a specific tab via ?tab=interview instead of always
  // landing on the default Summary tab. Read once on mount — this page
  // doesn't keep the URL in sync as the user switches tabs afterwards.
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get("tab");
    return TABS.some((t) => t.id === requested) ? requested : TABS[0].id;
  });
  const [exporting, setExporting] = useState(false);
  const { user, hasRole } = useAuth();
  const isHrAdmin = hasRole(["HR_ADMIN"]);

  if (loading) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading candidate scorecard..." />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen">
        <ErrorState
          title="Candidate not found"
          message={
            error
              ? "We couldn't load this candidate. Please try again."
              : "We couldn't find this candidate. They may have been removed."
          }
          onRetry={() => navigate("/ai-screening/candidates")}
        />
      </div>
    );
  }

  const ActiveTabComponent = TABS.find((t) => t.id === activeTab).Component;

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <CandidateHeader candidate={candidate} onBack={() => navigate(-1)} />
        </div>
        {/* HR_ADMIN only; needs the campaign the scorecard
            belongs to, since the export route is campaign-scoped. */}
        {isHrAdmin && candidate.campaignId && (
          <Button
            variant="outline"
            size="small"
            loading={exporting}
            loadingText="Generating..."
            onClick={async () => {
              setExporting(true);
              try {
                await exportScorecard(candidate.campaignId, candidate.id);
                toast.success("Scorecard downloaded.");
              } catch (err) {
                toast.error(err?.response?.data?.message || "Could not export the scorecard.");
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1" /> Export scorecard
          </Button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <CandidateTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

        <div className="p-5">
          <Suspense fallback={null}>
            <ActiveTabComponent candidate={candidate} />
          </Suspense>
        </div>
      </div>

      {/* Actions on the candidate, alongside the read-only scorecard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <CandidateOverridePanel candidate={candidate} onChanged={refetch} />
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <CandidateNotesPanel
            campaignCandidateId={candidate.id}
            currentUserId={user?.user_id || user?.id}
          />
        </div>
      </div>
    </div>
  );
}
