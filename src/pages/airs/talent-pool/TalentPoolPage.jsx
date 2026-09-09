import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Archive, Sparkles, UserPlus } from "lucide-react";
import Pagination from "@/components/Pagination/pagination";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorState from "@/pages/airs/skill-ontology/components/ErrorState";
import Button from "@/components/Button/Button";
import useTalentPool from "./hooks/useTalentPool";
import useTalentPoolFilterOptions from "./hooks/useTalentPoolFilterOptions";
import { TALENT_POOL_SEARCH_MODES } from "./constants/talentPoolConstants";
import TalentPoolFilters from "./components/TalentPoolFilters";
import TalentPoolActiveFilterChips from "./components/TalentPoolActiveFilterChips";
import TalentPoolCard from "./components/TalentPoolCard";
import CampaignPickerModal from "./components/CampaignPickerModal";
import BulkAddResultsModal from "./components/BulkAddResultsModal";
import { bulkAddTalentPoolCandidatesToCampaign } from "./services/talentPoolService";
import { formatApiError } from "../campaigns/services/campaignservice";

export default function TalentPoolPage() {
  const navigate = useNavigate();
  const {
    results,
    loading,
    error,
    refetch,
    searchInput,
    setSearchInput,
    searchMode,
    setSearchMode,
    filters,
    applyFilters,
    clearAllFilters,
    removeFilterValue,
    hasActiveFilters,
    currentPage,
    setCurrentPage,
    totalPages,
  } = useTalentPool();

  const {
    options: filterOptions,
    loading: filterOptionsLoading,
    error: filterOptionsError,
  } = useTalentPoolFilterOptions();

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  // Snapshot at request time, not derived live from `results` — refetch()
  // below can replace `results` (candidates may drop off the list once
  // added) while this modal is still open, which would otherwise turn
  // already-shown names back into raw candidate_id strings mid-view.
  const [bulkCandidateNames, setBulkCandidateNames] = useState({});

  const toggleSelect = (candidateId) => {
    setSelectedIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id) => id !== candidateId) : [...prev, candidateId],
    );
  };

  // "Select all" only ever covers the currently-loaded page — selection
  // doesn't carry across server-side pagination.
  const allOnPageSelected =
    results.length > 0 && results.every((item) => selectedIds.includes(item.candidate.candidate_id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(results.map((item) => item.candidate.candidate_id));
    }
  };

  const handleBulkAdd = async (campaignId) => {
    try {
      const nameSnapshot = Object.fromEntries(
        results
          .filter((item) => selectedIds.includes(item.candidate.candidate_id))
          .map((item) => [item.candidate.candidate_id, item.candidate.full_name || item.candidate.candidate_id]),
      );
      const response = await bulkAddTalentPoolCandidatesToCampaign(campaignId, selectedIds);
      const data = response?.data ?? response;
      setBulkPickerOpen(false);
      setBulkCandidateNames(nameSnapshot);
      setBulkResults(data);
      setSelectedIds([]);
      refetch();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to add the selected candidates to the campaign."));
    }
  };

  return (
    <div className="relative min-h-screen p-8 bg-slate-50/40 text-slate-800 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Talent Pool</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Eligible candidates across every campaign, searchable by skill.
          </p>
        </div>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary" size="medium" onClick={() => setBulkPickerOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add Selected to Campaign ({selectedIds.length})
            </Button>
          </div>
        )}
      </div>

      <TalentPoolActiveFilterChips
        filters={filters}
        campaignOptions={filterOptions.campaigns}
        onRemove={removeFilterValue}
      />

      <div className="mb-4 flex justify-end">
        <TalentPoolFilters
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          searchMode={searchMode}
          setSearchMode={setSearchMode}
          filters={filters}
          applyFilters={applyFilters}
          clearAllFilters={clearAllFilters}
          filterOptions={filterOptions}
          filterOptionsLoading={filterOptionsLoading}
          filterOptionsError={filterOptionsError}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner text="Loading talent pool..." />
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load the talent pool"
          message="Something went wrong while loading candidates. Please try again."
          onRetry={refetch}
        />
      ) : results.length === 0 ? (
        <div className="text-center py-16 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          {searchMode === TALENT_POOL_SEARCH_MODES.SEMANTIC && !searchInput.trim() ? (
            <>
              <Sparkles className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-700">
                Describe the candidate, resume, or job description you're looking for.
              </p>
            </>
          ) : (
            <>
              <Archive className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-700">
                {hasActiveFilters ? "No candidates match the selected filters." : "No eligible candidates in the Talent Pool yet."}
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-indigo-600 h-3.5 w-3.5"
                checked={allOnPageSelected}
                onChange={toggleSelectAll}
                aria-label={allOnPageSelected ? "Deselect all candidates on this page" : "Select all candidates on this page"}
              />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                {allOnPageSelected ? "Deselect All" : "Select All"} ({results.length})
              </span>
            </label>
            {selectedIds.length > 0 && (
              <span className="text-[11px] text-slate-400">· {selectedIds.length} selected</span>
            )}
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((item) => (
              <TalentPoolCard
                key={item.candidate.candidate_id}
                item={item}
                isSelected={selectedIds.includes(item.candidate.candidate_id)}
                onToggleSelect={toggleSelect}
                onAdded={refetch}
                onViewProfile={() =>
                  navigate(`/ai-screening/talent-pool/${item.candidate.candidate_id}`, { state: { item } })
                }
              />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
            onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}

      <CampaignPickerModal
        isOpen={bulkPickerOpen}
        onClose={() => setBulkPickerOpen(false)}
        title="Add to Campaign"
        description={`Add ${selectedIds.length} selected candidate${selectedIds.length === 1 ? "" : "s"} to an active campaign.`}
        confirmLabel="Add Selected"
        onConfirm={handleBulkAdd}
      />

      <BulkAddResultsModal
        isOpen={!!bulkResults}
        onClose={() => setBulkResults(null)}
        results={bulkResults}
        candidateNameById={bulkCandidateNames}
      />
    </div>
  );
}
