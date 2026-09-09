import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../../components/Button/Button";
import LoadingSpinner from "../../../components/LoadingSpinner";
import ErrorState from "../skill-ontology/components/ErrorState";
import FilterListbox from "../../../components/filter/FilterListbox";
import { activeCampaigns } from "../service/resumeIntake";
import usePipelineBoard from "./hooks/usePipelineBoard";
import PipelineColumn from "./components/PipelineColumn";
import StageReasonModal from "./components/StageReasonModal";
import { PIPELINE_STAGE_LABEL } from "./constants/pipelineConstants";

// Active campaigns are fetched here (same GET /campaigns/active
// ResumeIntakePage's filter dropdown already uses) purely to default and
// switch which campaign's board is shown — the board itself always comes
// from GET /campaign-candidates/campaign/{campaign_id}/board for whichever
// one campaign is currently selected.
export default function PipelineBoardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignIdFromUrl = searchParams.get("campaign");

  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);

  useEffect(() => {
    activeCampaigns()
      .then((res) => setCampaigns(res?.data || []))
      .catch(() => setCampaigns([]))
      .finally(() => setCampaignsLoading(false));
  }, []);

  // Defaults to the first active campaign whenever the URL doesn't already
  // pin one — e.g. landing on /airs/pipeline with no ?campaign= at all.
  useEffect(() => {
    if (!campaignsLoading && !campaignIdFromUrl && campaigns.length > 0) {
      setSearchParams({ campaign: campaigns[0].id }, { replace: true });
    }
  }, [campaignsLoading, campaignIdFromUrl, campaigns, setSearchParams]);

  const campaignId = campaignIdFromUrl || (campaigns.length > 0 ? campaigns[0].id : null);

  const {
    columns,
    loading,
    error,
    refresh,
    startDrag,
    dropOnStage,
    pendingReason,
    confirmPendingReason,
    cancelPendingReason,
  } = usePipelineBoard(campaignId);

  const campaignOptions = campaigns.map((c) => ({ label: c.name, value: c.id }));

  if (campaignsLoading) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading active campaigns..." />
      </div>
    );
  }

  if (!campaignId) {
    return (
      <div className="p-8 bg-[#F8FAFC] min-h-screen">
        <ErrorState
          title="No active campaigns"
          message="There are no active campaigns right now — a pipeline board needs at least one to show."
          onRetry={() => navigate("/ai-screening/campaigns")}
        />
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Pipeline Board</h1>
          <p className="text-xs text-slate-500 mt-1">Drag candidate cards across stages. Changes sync to their record instantly.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-64">
            <FilterListbox
              options={campaignOptions}
              value={campaignId}
              onChange={(id) => setSearchParams({ campaign: id })}
              placeholder="Select a campaign"
            />
          </div>
          <Button variant="ghost" size="small" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner text="Loading pipeline board..." />
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load the pipeline board"
          message="Something went wrong while loading this campaign's board. Please try again."
          onRetry={refresh}
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map(({ stage, cards }) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              cards={cards}
              onDragStart={startDrag}
              onDrop={() => dropOnStage(stage)}
              // The real Candidate Scorecard (Summary/Resume/Deterministic/
              // Semantic/AI Evaluation/Final Status), keyed by
              // campaign_candidate_id (card.id) — not the pipeline-only
              // scorecard, which only has resume-parsed data and no real
              // scores.
              onCardClick={(card) => navigate(`/ai-screening/candidates/${card.id}`)}
            />
          ))}
        </div>
      )}

      <StageReasonModal
        isOpen={!!pendingReason}
        onClose={cancelPendingReason}
        onConfirm={confirmPendingReason}
        candidateName={pendingReason?.card?.name}
        stageLabel={pendingReason ? PIPELINE_STAGE_LABEL[pendingReason.toStage] || pendingReason.toStage : ""}
      />
    </div>
  );
}
