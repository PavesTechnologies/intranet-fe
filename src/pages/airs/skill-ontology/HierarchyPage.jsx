import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Button from "../../../components/Button/Button";
import useHierarchy from "./hooks/useHierarchy";
import HierarchyTree from "./components/HierarchyTree";
import ErrorState from "./components/ErrorState";

export default function HierarchyPage() {
  const navigate = useNavigate();
  const hierarchy = useHierarchy();

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/ai-screening/skill-ontology")}
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition shadow-sm shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Skill Hierarchy</h1>
            <p className="text-xs text-slate-500 mt-1">Browse the canonical skill taxonomy as a tree. Click a node to view details.</p>
          </div>
        </div>
        <Button variant="ghost" size="small" onClick={hierarchy.refreshRoot} disabled={hierarchy.isLoadingRoot}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${hierarchy.isLoadingRoot ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        {hierarchy.rootError ? (
          <ErrorState onRetry={hierarchy.refreshRoot} message="We couldn't load the skill hierarchy. Please try again." />
        ) : (
          <HierarchyTree
            rootNodes={hierarchy.rootNodes}
            isLoadingRoot={hierarchy.isLoadingRoot}
            expandedIds={hierarchy.expandedIds}
            loadingIds={hierarchy.loadingIds}
            childrenById={hierarchy.childrenById}
            onToggle={hierarchy.toggleExpand}
            onSelect={(node) => navigate(`/ai-screening/skill-ontology/${node.id}`)}
          />
        )}
      </div>
    </div>
  );
}
