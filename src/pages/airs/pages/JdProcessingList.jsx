import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Clock,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { getMyJDUploads, deleteJDProcessingTask, getJDById } from "../service/jdservice";
import { useAuth } from "../../../contexts/AuthContext";
import { Badge } from "../../../components/ui/badge";
import LoadingSpinner from "../../../components/LoadingSpinner";
import ExpandableList from "../../../components/List/List";
import Pagination from "../../../components/Pagination/pagination";
import StageStepper, { overallStatusMeta, buildStageMap, deriveOverallStatus } from "../components/ProcessingStageStepper";
import useAirsSocket from "../websockets/useAirsSocket";
import { dispatchAirsEvent } from "../websockets/airsEventDispatch";

const ITEMS_PER_PAGE = 10;

const ALL_STAGES = [
  "VALIDATION",
  "STORAGE",
  "TEXT_EXTRACTION",
  "TEXT_CLEANING",
  "AI_EXTRACTION",
  "JSON_VALIDATION",
  "SKILL_NORMALIZATION",
  "EMBEDDING_GENERATION",
  "PERSISTENCE",
];

const STAGE_LABELS = {
  VALIDATION: "Validation",
  STORAGE: "Storage",
  TEXT_EXTRACTION: "Text Extraction",
  TEXT_CLEANING: "Text Cleaning",
  AI_EXTRACTION: "AI Extraction",
  JSON_VALIDATION: "JSON Validation",
  SKILL_NORMALIZATION: "Skill Normalization",
  EMBEDDING_GENERATION: "Embedding Generation",
  PERSISTENCE: "Persistence",
};

const formatDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function JdProcessingList() {
  const [uploads, setUploads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [viewingJdId, setViewingJdId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isHRAdmin = hasRole(["HR_ADMIN"]);

  const fetchUploads = async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const res = await getMyJDUploads();
      setUploads(res?.data || []);
    } catch (err) {
      if (!silent) toast.error("Failed to load JD processing uploads.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUploads(false);
  }, []);

  const handleViewJD = async (jdId) => {
    setViewingJdId(jdId);
    try {
      await getJDById(jdId);
      navigate(`/ai-screening/jds/${jdId}`);
    } catch (err) {
      // Error toast already shown by getJDById.
    } finally {
      setViewingJdId(null);
    }
  };

  const handleDeleteTask = async (taskId) => {
    setDeletingTaskId(taskId);
    try {
      await deleteJDProcessingTask(taskId);
      await fetchUploads(true);
    } catch (err) {
      // Error toast already shown by deleteJDProcessingTask.
    } finally {
      setDeletingTaskId(null);
    }
  };

  // Live updates after the initial REST load — patches only the affected
  // upload record, never a full refetch/reload.
  useAirsSocket("/ws/job-descriptions/my-uploads", {
    onOpen: () => fetchUploads(true), // reconnect only: reconcile any missed events
    onEvent: (message) =>
      dispatchAirsEvent(message, {
        "stage.completed": (data) => {
          if (!data?.task_id) return;
          setUploads((prev) =>
            prev.map((u) => {
              if (u.task_id !== data.task_id) return u;
              const stages = [...(u.stages || [])];
              const idx = stages.findIndex((s) => s.stage === data.stage);
              const stageEntry = { stage: data.stage, status: data.status, error_message: data.error_message };
              if (idx >= 0) stages[idx] = { ...stages[idx], ...stageEntry };
              else stages.push(stageEntry);
              // No overall_status field on this event — derive it from the
              // accumulated per-stage statuses instead.
              const status = deriveOverallStatus(buildStageMap(stages), ALL_STAGES, u.status);
              return { ...u, stages, status };
            })
          );
        },
        "task.linked": (data) => {
          if (!data?.task_id) return;
          setUploads((prev) =>
            prev.map((u) => (u.task_id === data.task_id ? { ...u, jd_id: data.document_id ?? u.jd_id } : u))
          );
        },
      }),
  });

  const totalPages = Math.max(1, Math.ceil(uploads.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginatedUploads = uploads.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">
          Real-time status of job descriptions submitted for AI parsing and skill extraction.
        </p>
        <button
          onClick={() => fetchUploads(true)}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="h-40 flex items-center justify-center">
          <LoadingSpinner text="Loading uploads..." />
        </div>
      ) : uploads.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
          <Clock className="h-10 w-10 mx-auto stroke-1 mb-2" />
          No job descriptions are currently processing.
        </div>
      ) : (
        <>
          {paginatedUploads.map((u) => {
            const meta = overallStatusMeta(u.status);
            const stageMap = buildStageMap(u.stages);
            const isSuccess = String(u.status).toUpperCase() === "SUCCESS";
            const isFailure = ["FAILURE", "FAILED"].includes(String(u.status).toUpperCase());
            const isDeleting = deletingTaskId === u.task_id;

            return (
              <ExpandableList
                key={u.task_id}
                title={u.title || "Untitled Job Description"}
                headerRight={
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                      {formatDate(u.queued_at)}
                    </span>
                    <Badge className={`font-semibold px-2.5 py-1 text-xs gap-1.5 ${meta.className}`}>
                      {meta.pulse && (
                        <span className={`w-1.5 h-1.5 rounded-full animate-ping ${meta.dotClassName}`}></span>
                      )}
                      {meta.label}
                    </Badge>
                    {isSuccess && u.jd_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewJD(u.jd_id);
                        }}
                        disabled={viewingJdId === u.jd_id}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition disabled:opacity-50"
                      >
                        View JD <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isFailure && isHRAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(u.task_id);
                        }}
                        disabled={isDeleting}
                        className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 transition disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>
                }
              >
                <li className="list-none">
                  <p className="text-[11px] text-slate-400 font-mono mb-3">
                    Task #{String(u.task_id || "").slice(0, 8)}
                  </p>

                  {u.error_message && (
                    <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg px-3 py-2 text-[11px] font-medium mb-4">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      {u.error_message}
                    </div>
                  )}

                  <StageStepper stages={ALL_STAGES} stageLabels={STAGE_LABELS} stageMap={stageMap} />
                </li>
              </ExpandableList>
            );
          })}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
            onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}
    </div>
  );
}
