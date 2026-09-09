import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Pagination from "../../../components/Pagination/pagination";
import LoadingSpinner from "../../../components/LoadingSpinner";
import ErrorState from "../skill-ontology/components/ErrorState";
import useCandidateRanking from "./hooks/useCandidateRanking";
import CandidateStats from "./components/CandidateStats";
import CandidateFilters from "./components/CandidateFilters";
import CandidateTable from "./components/CandidateTable";

export default function CandidateRankingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get("campaign");

  const {
    candidates,
    totalResults,
    stats,
    search,
    setSearch,
    stageFilter,
    setStageFilter,
    sortValue,
    setSortValue,
    currentPage,
    setCurrentPage,
    totalPages,
    loading,
    error,
    refetch,
  } = useCandidateRanking(campaignId);

  if (!campaignId) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen">
        <ErrorState
          title="No campaign selected"
          message='Open a campaign and choose "View All Candidates" to see its candidate list.'
          onRetry={() => navigate("/ai-screening/campaigns")}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading candidates..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen">
        <ErrorState
          title="Couldn't load candidates"
          message="We couldn't load candidates for this campaign. Please try again."
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Candidates & Ranking</h1>
        <p className="text-xs text-slate-500 mt-1">
          Composite ranking blends deterministic rules, semantic match, and AI evaluation.
        </p>
      </div>

      <CandidateStats stats={stats} />

      <CandidateFilters
        search={search}
        setSearch={setSearch}
        stageFilter={stageFilter}
        setStageFilter={setStageFilter}
        sortValue={sortValue}
        setSortValue={setSortValue}
      />

      <div className="mb-4">
        <CandidateTable
          candidates={candidates}
          onView={(c) => navigate(`/ai-screening/candidates/${c.id}`)}
          onDeleted={refetch}
        />
      </div>

      {totalResults > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevious={() => setCurrentPage(currentPage - 1)}
          onNext={() => setCurrentPage(currentPage + 1)}
        />
      )}
    </div>
  );
}
