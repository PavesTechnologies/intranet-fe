import React, { useMemo, useState, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import LoadingSpinner from "../../../components/LoadingSpinner";
import CandidateHeader from "../candidates/CandidateScore/components/CandidateHeader";
import CandidateTabs from "../candidates/CandidateScore/components/CandidateTabs";
import ErrorState from "../skill-ontology/components/ErrorState";
import useParsedResumeCandidate from "./hooks/useParsedResumeCandidate";
import { SCORE_LABELS } from "../constants/scoreLabels";
// import { MOCK_CANDIDATES } from "../candidates/mock/candidateMockData";
// import { mapMockCandidateForScorecard } from "./utils/mapMockCandidateForScorecard";

const SummaryTab = lazy(() => import("../candidates/CandidateScore/tabs/Summary/SummaryTab"));
const ResumeTab = lazy(() => import("../candidates/CandidateScore/tabs/Resume/ResumeTab"));
const DeterministicScoreTab = lazy(() => import("../candidates/CandidateScore/tabs/Deterministic/DeterministicScoreTab"));
const SemanticScoreTab = lazy(() => import("../candidates/CandidateScore/tabs/Semantic/SemanticScoreTab"));
const AiEvaluationTab = lazy(() => import("../candidates/CandidateScore/tabs/AiEvaluation/AiEvaluationTab"));
const InterviewTab = lazy(() => import("../candidates/CandidateScore/tabs/Interview/InterviewTab"));
const FinalStatusTab = lazy(() => import("../candidates/CandidateScore/tabs/FinalStatus/FinalStatusTab"));

const TABS = [
  { id: "summary", label: "Summary", Component: SummaryTab },
  { id: "resume", label: "Resume", Component: ResumeTab },
  { id: "deterministic", label: SCORE_LABELS.deterministic, Component: DeterministicScoreTab },
  { id: "semantic", label: SCORE_LABELS.semantic, Component: SemanticScoreTab },
  { id: "ai", label: SCORE_LABELS.ai, Component: AiEvaluationTab },
  { id: "finalStatus", label: "Final Status", Component: FinalStatusTab },
  { id: "interview", label: "Interview", Component: InterviewTab },
];

// Pipeline Board's candidate detail page — reuses the same Candidate
// Scorecard header/tabs as /airs/candidates/:candidateId, sourced from the
// resume parsed-json endpoint (the campaign-candidates detail endpoint isn't
// implemented on the backend). `location.state.resume` is the Resume Upload
// History row (candidate name/email/etc.) forwarded on navigation, since
// parsed-json only returns resume/parsing data, not candidate profile fields.
//
// Also embeddable as a popup (variant="modal") — e.g. BulkJobDetailModal opens
// it in a stacked Modal instead of navigating away, so `candidateId`/`resumeRow`/
// `onBack` can be passed directly instead of coming from the route.
export default function PipelineCandidateScorecardPage({
  candidateId: candidateIdProp,
  resumeRow: resumeRowProp,
  onBack: onBackProp,
  variant = "page",
}) {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const candidateId = candidateIdProp ?? params.candidateId;
  const resumeRow = resumeRowProp ?? location.state?.resume;
  const campaignCandidateId =
    resumeRow?.campaign_candidate_id ??
    resumeRow?.campaignCandidateId ??
    resumeRow?.campaignCandidate?.id ??
    resumeRow?.campaign_candidate?.id ??
    // CampaignDetails' candidate table passes its already-mapped row
    // (mapCampaignCandidateRow), whose id IS the campaign_candidate_id.
    resumeRow?.id ??
    // Pipeline routes are opened with the campaign-candidate id; keep that id
    // available for score tabs even when router state is lost on refresh.
    (candidateIdProp ? null : params.candidateId);
  const fallback = useMemo(
    () => ({
      // `resumeRow` is either a raw Resume Upload History row (snake_case) or
      // an already-mapped campaign-candidate row from CampaignDetails'
      // CandidateTable (mapCampaignCandidateRow, camelCase) — support both.
      name: resumeRow?.candidate_full_name ?? resumeRow?.name,
      email: resumeRow?.candidate_email ?? resumeRow?.email,
      createdAt: resumeRow?.created_at ?? resumeRow?.createdAt,
      // Resume Upload History rows carry campaign_candidate_id, but the
      // parsed-json endpoint (this page's only data source) doesn't — thread it
      // through here so the Deterministic/Semantic/AI Evaluation tabs can call
      // /campaign-candidates/{campaign_candidate_id}/... with the right id.
      campaignCandidateId,
      // pipeline_stage/decision_* are only present once the resume's candidate
      // is linked to a campaign — same fields Resume Upload History already
      // renders via renderPipelineStageBadge.
      stage: resumeRow?.pipeline_stage ?? resumeRow?.stage,
      decisionType: resumeRow?.decision_type ?? resumeRow?.decisionType,
      decisionSource: resumeRow?.decision_source ?? resumeRow?.decisionSource,
      decisionReason: resumeRow?.decision_reason ?? resumeRow?.decisionReason,
      decisionAt: resumeRow?.decision_at ?? resumeRow?.decisionAt,
    }),
    [
      campaignCandidateId,
      resumeRow?.candidate_email,
      resumeRow?.email,
      resumeRow?.candidate_full_name,
      resumeRow?.name,
      resumeRow?.created_at,
      resumeRow?.createdAt,
      resumeRow?.pipeline_stage,
      resumeRow?.stage,
      resumeRow?.decision_type,
      resumeRow?.decisionType,
      resumeRow?.decision_source,
      resumeRow?.decisionSource,
      resumeRow?.decision_reason,
      resumeRow?.decisionReason,
      resumeRow?.decision_at,
      resumeRow?.decisionAt,
    ]
  );
  const { candidate, loading, error, refetch } = useParsedResumeCandidate(candidateId, fallback);
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const isModal = variant === "modal";

  // Prefer real browser "back" so this returns to wherever the user actually
  // came from — a specific Resume Intake tab (history/processing/bulk-batches),
  // the Pipeline Board, etc. — rather than a single hardcoded guess. Only fall
  // back to a guessed route when there's no in-app history to go back to
  // (e.g. this page was opened directly via URL/refresh, where location.key
  // is react-router's "default" sentinel). Not used when embedded as a modal —
  // onBackProp (closing the popup) takes over instead.
  const canGoBack = location.key !== "default";
  const fallbackBackTo = resumeRow ? "/ai-screening/resume-intake" : "/ai-screening/pipeline";
  const handleBack =
    onBackProp ??
    (() => {
      if (canGoBack) navigate(-1);
      else navigate(fallbackBackTo);
    });

  if (loading) {
    return (
      <div className={isModal ? "flex items-center justify-center py-12" : "p-8 bg-[#F8FAFC] min-h-screen flex items-center justify-center"}>
        <LoadingSpinner text="Loading candidate scorecard..." />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className={isModal ? undefined : "p-8 bg-[#F8FAFC] min-h-screen"}>
        <ErrorState
          title="Candidate not found"
          message={
            error
              ? "We couldn't load this candidate. Please try again."
              : "We couldn't find this candidate. They may have been removed."
          }
          onRetry={handleBack}
        />
      </div>
    );
  }

  const ActiveTabComponent = TABS.find((t) => t.id === activeTab).Component;

  return (
    <div className={isModal ? "text-slate-900 font-sans" : "p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans"}>
      <CandidateHeader candidate={candidate} onBack={handleBack} />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <CandidateTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

        <div className="p-5">
          <Suspense fallback={<LoadingSpinner text="Loading tab..." />}>
            <ActiveTabComponent candidate={candidate} onExpired={refetch} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
