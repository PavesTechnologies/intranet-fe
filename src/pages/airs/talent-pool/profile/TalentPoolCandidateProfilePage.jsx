import React, { useState, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorState from "@/pages/airs/skill-ontology/components/ErrorState";
import CandidateTabs from "@/pages/airs/candidates/CandidateScore/components/CandidateTabs";
import useTalentPoolProfile from "../hooks/useTalentPoolProfile";
import CandidateHeader from "./components/CandidateHeader";

const CandidateOverview = lazy(() => import("./tabs/CandidateOverview"));
const CampaignHistoryTab = lazy(() => import("./tabs/CampaignHistoryTab"));
const ResumeVersionsTab = lazy(() => import("./tabs/ResumeVersionsTab"));
const SkillsTab = lazy(() => import("./tabs/SkillsTab"));

const TABS = [
  { id: "summary", label: "Summary", Component: CandidateOverview },
  { id: "campaignHistory", label: "Campaign History", Component: CampaignHistoryTab },
  { id: "resumeVersions", label: "Resume Versions", Component: ResumeVersionsTab },
  { id: "skills", label: "Skills", Component: SkillsTab },
];

// Talent Pool candidate profile page — header + tabs, same structure as the
// Campaign candidate scorecard, but representing one candidate ACROSS every
// campaign. `profile` (GET /talent-pool/candidates/{candidate_id}) backs the
// header + Summary + Skills tabs; Resume Versions/Campaign History stay on
// the resume-versions endpoint (candidateId), since the profile response
// only carries the latest campaign, not the full history.
export default function TalentPoolCandidateProfilePage() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const listSkills = location.state?.item?.skills;
  const { profile, loading, error, refetch } = useTalentPoolProfile(candidateId);
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  if (loading) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading candidate profile..." />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen">
        <ErrorState
          title="Candidate not found"
          message={
            error
              ? "We couldn't load this candidate. Please try again."
              : "We couldn't find this candidate in the talent pool. They may have been removed."
          }
          onRetry={error ? refetch : () => navigate("/ai-screening/talent-pool")}
        />
      </div>
    );
  }

  const ActiveTabComponent = TABS.find((t) => t.id === activeTab).Component;

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <CandidateHeader profile={profile} onBack={() => navigate(-1)} onAdded={refetch} />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <CandidateTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

        <div className="p-5">
          <Suspense fallback={null}>
            <ActiveTabComponent profile={profile} candidateId={candidateId} listSkills={listSkills} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
