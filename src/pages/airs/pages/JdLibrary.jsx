import React, { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAirsStore } from "./airsStore";
import { getAllJDs, exportJDs, deleteJDById } from "../service/jdservice";
import {
  Search,
  PencilIcon,
  Filter,
  ArrowUpDown,
  Trash2,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  Archive,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  FileCheck2,
  Clock,
  X
} from "lucide-react";
import { toast } from "react-toastify";
import Button from "../../../components/Button/Button";
import Pagination from "../../../components/Pagination/pagination";
import ConfirmationModal from "../../../components/confirmation_modal/ConfirmationModal";
import Modal from "../../../components/ui/Modal";
import FilterListbox from "../../../components/filter/FilterListbox";
// import CountriesList from "../../../components/CountriesList";
import { Badge } from "../../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import GenericTable from "../../../components/Table/table";
import LoadingSpinner from "../../../components/LoadingSpinner";
import JdForm from "./JdForm";
import JdProcessingList from "./JdProcessingList";


const statusOptions = [
  { label: "All Statuses", value: "All" },
  { label: "VERIFIED", value: "VERIFIED" },
  { label: "UNVERIFIED", value: "UNVERIFIED" },
  { label: "PARTIALLY VERIFIED", value: "PARTIALLY_VERIFIED" }
];

function Toggle({ checked, onChange, label }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          checked ? "bg-blue-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
      <span
        className="text-xs font-bold text-slate-700 cursor-pointer"
        onClick={() => onChange(!checked)}
      >
        {label}
      </span>
    </div>
  );
}

const jurisdictionOptions = [
  { label: "All Jurisdictions", value: "All" },
  { label: "GLOBAL", value: "GLOBAL" },
  { label: "EU", value: "EUROPE" },
  { label: "US", value: "US" },
  { label: "IN", value: "INDIA" },
];

const sourceOptions = [
  { label: "All Sources", value: "All" },
  { label: "Manual", value: "Manual" },
  { label: "PDF Upload", value: "PDF Upload" },
  { label: "DOCX Upload", value: "DOCX Upload" },
];

export default function JdLibrary() {
  const { jds, deleteJd, closeJd } = useAirsStore();
  const navigate = useNavigate();

  // Export State
  const [isExporting, setIsExporting] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [activeFilter, setActiveFilter] = useState(true);
  // Sorting State
  const [sortField, setSortField] = useState("createdDate");
  const [sortOrder, setSortOrder] = useState("desc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Server-side State
  const [jdsList, setJdsList] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  // Dialog Overlays State
  const [deleteJdId, setDeleteJdId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [closeJdId, setCloseJdId] = useState(null);
  const [isJdDelete, setIsJdDelete] = useState(false);
  const [jdModalOpen, setJdModalOpen] = useState(false);
  const [jdModalEditId, setJdModalEditId] = useState(null);

  // Tabs State
  const [activeTab, setActiveTab] = useState("processed");
  const [processingRefreshToken, setProcessingRefreshToken] = useState(0);

  // Debounce search term to avoid spamming calls
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const getSourceFormatParam = (filterValue) => {
    if (filterValue === "Manual") return "TEXT";
    if (filterValue === "PDF Upload") return "PDF";
    if (filterValue === "DOCX Upload") return "DOCX";
    return undefined;
  };

  const getSortByParam = (field) => {
    if (field === "createdDate") return "created_at";
    if (field === "title") return "title";
    if (field === "version") return "version_number";
    if (field === "jurisdiction") return "jurisdiction";
    if (field === "source") return "source_format";
    return "created_at";
  };

  const fetchJds = async () => {
    setIsLoading(true);
    try {
      const params = {
        search: debouncedSearch || undefined,
        jurisdiction: jurisdictionFilter === "All" ? undefined : jurisdictionFilter,
        is_verified: statusFilter === "All" ? undefined : statusFilter,
        active: activeFilter,
        source_format: getSourceFormatParam(sourceFilter),
        page: currentPage,
        size: itemsPerPage,
        sort_by: getSortByParam(sortField),
        order: sortOrder,
      };

      const res = await getAllJDs(params);
      const data = res.data
      if (data) {
        setJdsList(data.items || []);
        setTotalItems(data.total || 0);
      }
    } catch (error) {
      toast.error("Failed to fetch job descriptions from server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJds();
  }, [debouncedSearch, statusFilter, jurisdictionFilter, sourceFilter, activeFilter, currentPage, sortField, sortOrder]);

  // 1. Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const paginatedJds = jdsList;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Status Badge Colors using common UI Badge component
  const getStatusBadge = (status) => {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "VERIFIED") {
      return <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-semibold px-2.5 py-1 text-xs">{status}</Badge>;
    }
    if (normalized === "UNVERIFIED") {
      return <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-semibold px-2.5 py-1 text-xs">{status}</Badge>;
    }
    if (normalized === "PARTIALLY_VERIFIED") {
      return <Badge className="bg-amber-50 text-amber-700 border-amber-100 font-semibold px-2.5 py-1 text-xs">{status}</Badge>;
    }
    if (normalized === "CLOSED") {
      return <Badge className="bg-rose-50 text-rose-700 border-rose-100 font-semibold px-2.5 py-1 text-xs">{status}</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-semibold px-2.5 py-1 text-xs">{status}</Badge>;
  };
  const headers = [
    <div key="jobId" className="w-full flex justify-center select-none">Job ID</div>,
    <div key="title" className="w-full flex justify-center select-none">Title</div>,
    <div key="version" className="w-full flex justify-center select-none">Version</div>,
    <div key="source" className="w-full flex justify-center select-none">Source</div>,
    <div key="jurisdiction" className="w-full flex justify-center select-none">Region</div>,
    <div key="createdAt" className="w-full flex justify-center select-none">Created At</div>,
    <div key="campaignCount" className="w-full flex justify-center select-none">Campaigns</div>,
    <div key="status" className="w-full flex justify-center select-none">Status</div>,
    <div key="isActive" className="w-full flex justify-center select-none">Active</div>,
    <div key="actions" className="w-full flex justify-center select-none">Actions</div>
  ];

  const columns = [
    "jobId",
    "title",
    "version",
    "source",
    "jurisdiction",
    "createdAt",
    "campaignCount",
    "status",
    "isActive",
    "actions",
  ];

  const tableRows = useMemo(() => {
    return paginatedJds.map((jd) => {
      const version = jd.version || jd.version_number || 1;
      const source = jd.source || (jd.source_format === "TEXT" ? "Manual" : jd.source_format === "PDF" ? "PDF Upload" : jd.source_format === "DOCX" ? "DOCX Upload" : jd.source_format || "Manual");
      const createdAt = jd.createdDate || (jd.created_at ? jd.created_at.split('T')[0] : "");
      const status = jd.status || jd.is_verified || (jd.active === false ? "Closed" : "Ready");
      const activeAndPausedCount = (jd.active_campaigns_count || 0) + (jd.paused_campaigns_count || 0);
      const campaignCount = (jd.active_campaigns_count || 0) + (jd.passed_campaigns_count || 0);
      const isActiveVersion = jd.is_active_version;
      const isBlocked = activeAndPausedCount > 0;

      return {
        jobId: (
          <div className="w-full flex justify-center font-mono text-slate-500 text-xs">
            {jd.job_id || jd.id || ""}
          </div>
        ),
        title: (
          <div
            className="w-full flex justify-center font-bold text-slate-900"
            title={jd.title}
          >
            <span className="line-clamp-1 truncate max-w-[150px]">
              {jd.title}
            </span>
          </div>
        ),
        version: (
          <div className="w-full flex justify-center">
            v{version}
          </div>
        ),
        source: (
          <div className="w-full flex justify-center text-slate-500">
            {source}
          </div>
        ),
        jurisdiction: (
          <div className="w-full flex justify-center">
            {jd.jurisdiction}
          </div>
        ),
        createdAt: (
          <div className="w-full flex justify-center text-slate-500">
            {createdAt}
          </div>
        ),
        campaignCount: (
          <div className="w-full flex justify-center">
            {campaignCount > 0 ? (
              <Badge className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 border-blue-100">
                {campaignCount} active
              </Badge>
            ) : (
              <span className="text-slate-400">0</span>
            )}
          </div>
        ),
        status: (
          <div className="w-full flex justify-center">
            {getStatusBadge(status)}
          </div>
        ),
        isActive: (
          <div className="w-full flex justify-center">
            {isActiveVersion ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-semibold px-2.5 py-1 text-xs">Yes</Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-semibold px-2.5 py-1 text-xs">No</Badge>
            )}
          </div>
        ),
        actions: (
          <div className="w-full flex justify-center items-center gap-1">
            {status !== "Closed" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={isBlocked ? undefined : (e) => { e.stopPropagation(); setJdModalEditId(jd.id); setJdModalOpen(true); }}
                title={isBlocked ? "Cannot edit JD linked to active or paused campaigns" : "Edit JD"}
                className={`h-8 w-8 ${
                  isBlocked
                    ? "!text-indigo-300 cursor-not-allowed !pointer-events-auto"
                    : "text-indigo-500 hover:text-indigo-700"
                }`}
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={isBlocked ? undefined : (e) => { e.stopPropagation(); setDeleteJdId(jd.id); setConfirmDelete(true); }}
              title={isBlocked ? "Cannot delete JD linked to active or paused campaigns" : "Delete JD"}
              className={`h-8 w-8 ${
                isBlocked
                  ? "!text-rose-300 cursor-not-allowed !pointer-events-auto"
                  : "text-rose-500 hover:text-rose-600"
              }`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
        rowClass: "hover:bg-slate-50/50 transition cursor-pointer",
        onRowClick: () => navigate(`/ai-screening/jds/${jd.id}`),
      };
    });
  }, [paginatedJds, navigate, setCloseJdId, setDeleteJdId]);

  // Actions
  const handleDeleteConfirm = async () => {
    if (deleteJdId) {
      setIsJdDelete(true);
      try {
        const res = await deleteJDById(deleteJdId);
        setDeleteJdId(null);
        setConfirmDelete(false);
        toast.success(res.message || "Job Description deleted successfully");
        fetchJds();
      } catch (error) {
      } finally {
        setIsJdDelete(false);
      }
    }
  };

  const handleCloseConfirm = () => {
    if (closeJdId) {
      const selectedJd = jds.find(j => j.id === closeJdId) || jdsList.find(j => j.id === closeJdId);
      closeJd(closeJdId);

      if (selectedJd && selectedJd.campaignCount > 0) {
        toast.success(`JD closed successfully. Linked ${selectedJd.campaignCount} active campaigns were archived.`, { duration: 4000 });
      } else {
        toast.success(`JD ${closeJdId} closed successfully.`);
      }
      setCloseJdId(null);
      fetchJds();
    }
  };

  const handleExportLibrary = async () => {
    if (isExporting) return;

    setIsExporting(true);

    try {
      const params = {
        search: debouncedSearch || undefined,
        jurisdiction:
          jurisdictionFilter === "All"
            ? undefined
            : jurisdictionFilter,
        is_verified: statusFilter === "All" ? undefined : statusFilter,
        active: activeFilter,
        source_format: getSourceFormatParam(sourceFilter),
        sort_by: getSortByParam(sortField),
        order: sortOrder,
      };

      const response = await exportJDs(params);

      const blob = new Blob([response.data], {
        type: response.headers["content-type"],
      });

      const url = URL.createObjectURL(blob);

      let filename = "JD_List.xlsx";

      const disposition = response.headers["content-disposition"];

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) {
          filename = match[1];
        }
      }

      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast.success("Job Descriptions exported successfully.");

    } catch (error) {
      console.error(error);

      toast.error(
        error?.response?.data?.message ||
        "Failed to export Job Descriptions."
      );
    } finally {
      setIsExporting(false);
    }
  };
  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">JD Management Library</h1>
          <p className="text-xs text-slate-500 mt-1">Configure, search, and verify canonical roles and version timelines.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="small"
            onClick={handleExportLibrary}
            disabled={isExporting}
            className="flex-1 sm:flex-none font-semibold"
          >
            <Download className="h-4 w-4 mr-1.5" />
            {isExporting ? "Exporting..." : "Export Library"}
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={() => { setJdModalEditId(null); setJdModalOpen(true); }}
            className="flex-1 sm:flex-none font-semibold"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New JD
          </Button>
        </div>
      </div>

      {/* Processed JD / Processing JD Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab);
          if (tab === "processed") fetchJds();
        }}
      >
        <TabsList className="bg-white border border-slate-200 shadow-sm mb-6 p-1 h-auto">
          <TabsTrigger
            value="processed"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-500"
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            Processed JD
          </TabsTrigger>
          <TabsTrigger
            value="processing"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-500"
          >
            <Clock className="h-3.5 w-3.5" />
            Processing JD
          </TabsTrigger>
        </TabsList>

        {/* Filter / Search Bar */}
        <div className="mb-6 flex flex-col lg:flex-row gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Title, ID, or Creator..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full lg:w-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[500px]">
              {/* Status Filter */}
              <div className="flex flex-col gap-1 w-full">
                {/* <span className="text-[10px] uppercase font-bold text-slate-400 px-1">Status</span> */}
                <FilterListbox
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Jurisdiction Filter */}
              <div className="flex flex-col gap-1 w-full">
                {/* <span className="text-[10px] uppercase font-bold text-slate-400 px-1">Region</span> */}
                {/* <CountriesList
                  variant="filter"
                  value={jurisdictionFilter === "All" ? "" : jurisdictionFilter}
                  onChange={(value) => {
                    setJurisdictionFilter(value || "All");
                    setCurrentPage(1);
                  }}
                  placeholder="All Jurisdictions"
                /> */}
                <FilterListbox
                  options={jurisdictionOptions}
                  value={jurisdictionFilter}
                  onChange={(value) => {
                    setJurisdictionFilter(value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Source Filter */}
              <div className="flex flex-col gap-1 w-full">
                {/* <span className="text-[10px] uppercase font-bold text-slate-400 px-1">Source</span> */}
                <FilterListbox
                  options={sourceOptions}
                  value={sourceFilter}
                  onChange={(value) => {
                    setSourceFilter(value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            {/* Active Filter Toggle */}
            <div className="flex items-center shrink-0 px-2">
              <Toggle
                checked={activeFilter}
                onChange={(checked) => {
                  setActiveFilter(checked);
                  setCurrentPage(1);
                }}
                label="Active"
              />
            </div>
          </div>
        </div>

        <TabsContent value="processed" className="mt-0">
          {/* Table Card */}
          <div className="overflow-x-auto mb-6">
            {isLoading ?
              <div className="h-40 flex items-center justify-center">
                <LoadingSpinner text="Loading JDs..."></LoadingSpinner>
              </div> : paginatedJds.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
                  <Archive className="h-10 w-10 mx-auto stroke-1 mb-2" />
                  No Job Descriptions found matching the criteria.
                </div>
              ) : (
                <GenericTable
                  headers={headers}
                  columns={columns}
                  rows={tableRows}
                  loading={isLoading}
                />
              )}
          </div>

          {/* Pagination bar */}
          {totalItems > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPrevious={() => setCurrentPage(currentPage - 1)}
              onNext={() => setCurrentPage(currentPage + 1)}
            />
          )}
        </TabsContent>

        <TabsContent value="processing" className="mt-0">
          <JdProcessingList key={processingRefreshToken} />
        </TabsContent>
      </Tabs>

      {/* dialog overlays */}

      {/* Create / Edit JD Modal */}
      <Modal
        isOpen={jdModalOpen}
        onClose={() => setJdModalOpen(false)}
        title={jdModalEditId ? "Edit Job Description" : "Create Job Description"}
        width="700px"
        height="85vh"
      >
        <JdForm
          editId={jdModalEditId}
          onSuccess={(info) => {
            setJdModalOpen(false);
            fetchJds();
            if (info?.queuedForProcessing) {
              setActiveTab("processing");
              setProcessingRefreshToken((t) => t + 1);
            }
          }}
          onCancel={() => setJdModalOpen(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDelete}
        title="Confirm Job Description Deletion"
        message="Are you sure you want to delete Job Description? This is a soft delete, not a permanent one — the record and its version history will be retained and can be restored later."
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setDeleteJdId(null); setConfirmDelete(false); }}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isJdDelete}
      />

      {/* Close Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!closeJdId}
        title="Close Job Description"
        message={
          <>
            You are about to close Job Description{" "}
            <span className="font-mono text-slate-800 font-bold">{closeJdId}</span>.
            {jds.find((j) => j.id === closeJdId)?.campaignCount > 0 ? (
              <span className="block mt-2 font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-[11px]">
                ⚠️ WARNING: This JD is currently linked to{" "}
                {jds.find((j) => j.id === closeJdId)?.campaignCount} active hiring campaigns. Closing it will automatically archive those campaigns.
              </span>
            ) : (
              <span className="block mt-2">This will archive the JD. You can clone it or create a new version later.</span>
            )}
          </>
        }
        onConfirm={handleCloseConfirm}
        onCancel={() => setCloseJdId(null)}
        confirmText="Confirm Archive"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
