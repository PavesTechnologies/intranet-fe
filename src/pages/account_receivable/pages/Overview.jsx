import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  FileText,
  Clock,
  XCircle,
  CheckCircle2,
  Eye,
  Pencil,
  ArrowRightCircle,
  Ban,
  Trash2,
  FilterX,
} from "lucide-react";

import { cn } from "@/lib/utils";
import PageHeader from "../../../components/ui/PageHeader";
import { PageCard, PageCardContent } from "../../../components/Cards/PageCard";
import ARKPICard from "../components/common/ARKPICard";
import Button from "../../../components/Button/Button";
import SearchInput from "../../../components/filter/Searchbar";
import FilterListbox from "../../../components/filter/FilterListbox";
import ARTable from "../components/common/ARTable";
import Pagination from "../../../components/Pagination/pagination";
import StatusBadge from "../../../components/status/statusbadge";
import ConfirmationModal from "../../../components/confirmation_modal/ConfirmationModal";
import { showStatusToast } from "../../../components/toastfy/toast";
import ActionMenu from "../components/common/ActionMenu";

import {
  fetchBillingConfigurations,
  deactivateBillingConfiguration,
  deleteBillingConfiguration,
  getApiErrorMessage,
  getBillingConfigurationStats,
} from "../services/billingConfigService";
import { getBillingTypeDisplayName } from "../utils/billingType";

const INITIAL_FILTERS = { search: "" };
const PAGE_SIZE = 6;

const APPROVAL_STATUS_OPTIONS = [
  { label: "All Approval Statuses", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Pending Approval", value: "PENDING_APPROVAL" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

const CONFIG_STATUS_OPTIONS = [
  { label: "All Configuration Statuses", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

const TABLE_HEADERS = ["Client", "Project", "Billing Type", "Approval Status", "Configuration Status", "Actions"];
const TABLE_COLUMNS = ["client", "project", "billingType", "approvalStatus", "configurationStatus", "actions"];

export default function Overview() {
  const navigate = useNavigate();

  // Overview Stats State
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Billing Configurations State
  const [configs, setConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState("ALL");
  const [configStatusFilter, setConfigStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // load configurations helper available to handlers
  const loadConfigurations = async () => {
    setLoadingStats(true);
    setLoadingConfigs(true);
    try {
      const configsResult = await fetchBillingConfigurations();
      setConfigs(configsResult);

      // derive stats from configurations
      const statsResult = await getBillingConfigurationStats();
      setStats(statsResult);
    } catch (error) {
      showStatusToast(getApiErrorMessage(error, "Failed to load billing configuration overview."), "error");
      setStats(null);
    } finally {
      setLoadingStats(false);
      setLoadingConfigs(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    loadConfigurations();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearchInputChange = (event) => {
    const nextSearch = event.target.value;
    setFilters((prev) => {
      if (prev.search === nextSearch) return prev;
      return { ...prev, search: nextSearch };
    });
    setCurrentPage(1);
  };

  const handleKpiClick = (key) => {
    if (key === "TOTAL") {
      setApprovalStatusFilter("ALL");
      setConfigStatusFilter("ALL");
    } else if (key === "ACTIVE") {
      setConfigStatusFilter((prev) => (prev === "ACTIVE" ? "ALL" : "ACTIVE"));
      setApprovalStatusFilter("ALL");
    } else if (key === "INACTIVE") {
      setConfigStatusFilter((prev) => (prev === "INACTIVE" ? "ALL" : "INACTIVE"));
      setApprovalStatusFilter("ALL");
    } else {
      setApprovalStatusFilter((prev) => (prev === key ? "ALL" : key));
      setConfigStatusFilter("ALL");
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setApprovalStatusFilter("ALL");
    setConfigStatusFilter("ALL");
    setCurrentPage(1);
  };

  const filteredConfigs = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return configs.filter((config) => {
      const matchesSearch =
        !search ||
        String(config.projectName || "").toLowerCase().includes(search) ||
        String(config.projectCode || "").toLowerCase().includes(search) ||
        String(config.client || "").toLowerCase().includes(search);

      if (!matchesSearch) return false;

      if (approvalStatusFilter !== "ALL" && config.approvalStatus !== approvalStatusFilter) {
        return false;
      }

      if (configStatusFilter !== "ALL" && config.billingStatus !== configStatusFilter) {
        return false;
      }

      return true;
    });
  }, [configs, filters.search, approvalStatusFilter, configStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredConfigs.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedConfigs = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredConfigs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredConfigs, currentPage]);

  const handleView = (config) => {
    navigate(`/account-receivable/project-billing-setup/configurations/${config.id}?mode=view`);
  };

  const handleEdit = (config) => {
    navigate(`/account-receivable/project-billing-setup/configurations/${config.id}?mode=edit`);
  };

  const handleContinueDraft = (config) => {
    navigate(`/account-receivable/project-billing-setup/configurations/${config.id}`);
  };

  const handleConfirmDeactivate = async () => {
    setDeactivateLoading(true);
    try {
      await deactivateBillingConfiguration(deactivateTarget.id);
      await loadConfigurations();
      showStatusToast("Billing configuration deactivated.", "success");
      setDeactivateTarget(null);
    } catch (error) {
      showStatusToast(getApiErrorMessage(error, "Failed to deactivate billing configuration."), "error");
    } finally {
      setDeactivateLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteBillingConfiguration(deleteTarget.id);
      await loadConfigurations();
      showStatusToast("Draft billing configuration deleted.", "success");
      setDeleteTarget(null);
    } catch (error) {
      showStatusToast(getApiErrorMessage(error, "Failed to delete draft billing configuration."), "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeDeleteModal = () => {
    if (!deleteLoading) {
      setDeleteTarget(null);
    }
  };

  const closeDeactivateModal = () => {
    if (!deactivateLoading) {
      setDeactivateTarget(null);
    }
  };

  const tableRows = useMemo(
    () =>
      paginatedConfigs.map((config) => ({
        client: config.client,
        project: (
          <div className="text-left">
            <div className="font-semibold text-slate-900">{config.projectName}</div>
            <div className="text-xs text-slate-400">{config.projectCode}</div>
          </div>
        ),
        billingType: getBillingTypeDisplayName(config.billingType),
        approvalStatus: (
          <StatusBadge
            label={config.approvalStatusLabel || config.approvalStatus || "Draft"}
            size="sm"
          />
        ),
        configurationStatus: (
          <StatusBadge
            label={config.billingStatusLabel || config.billingStatus || "Inactive"}
            size="sm"
          />
        ),
        actions: (
          <ActionMenu
            items={[
              { label: "View", icon: <Eye className="h-4 w-4" />, onClick: () => handleView(config) },
              {
                label: "Continue Draft",
                icon: <ArrowRightCircle className="h-4 w-4" />,
                hidden: config.approvalStatus !== "DRAFT",
                onClick: () => handleContinueDraft(config),
              },
              {
                label: "Edit",
                icon: <Pencil className="h-4 w-4 text-gray-600" />,
                hidden: config.approvalStatus === "DRAFT",
                onClick: () => handleEdit(config),
              },
              {
                label: "Deactivate",
                icon: <Ban className="h-4 w-4" />,
                hidden: !(config.approvalStatus === "APPROVED" && config.billingStatus === "ACTIVE"),
                danger: true,
                onClick: () => setDeactivateTarget(config),
              },
              {
                label: "Delete",
                icon: <Trash2 className="h-4 w-4" />,
                hidden: config.approvalStatus !== "DRAFT",
                danger: true,
                onClick: () => setDeleteTarget(config),
              },
            ]}
          />
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paginatedConfigs]
  );

  const approvalKpis = [
    {
      key: "TOTAL",
      label: "Total Billing",
      subLabel: "Configurations",
      value: stats?.total ?? configs.length,
      icon: FolderKanban,
      color: "bg-[#0A0082] text-white",
      active: approvalStatusFilter === "ALL" && configStatusFilter === "ALL" && !filters.search,
      isTotal: true,
    },
    {
      key: "APPROVED",
      label: "Approved",
      subLabel: null,
      value: stats?.approved ?? configs.filter((c) => c.approvalStatus === "APPROVED").length,
      icon: CheckCircle2,
      color: "bg-teal-600 text-white",
      active: approvalStatusFilter === "APPROVED" && configStatusFilter === "ALL",
    },
    {
      key: "PENDING_APPROVAL",
      label: "Pending Approval",
      subLabel: null,
      value: stats?.pending ?? configs.filter((c) => c.approvalStatus === "PENDING_APPROVAL").length,
      icon: Clock,
      color: "bg-amber-500 text-white",
      active: approvalStatusFilter === "PENDING_APPROVAL" && configStatusFilter === "ALL",
    },
    {
      key: "DRAFT",
      label: "Draft",
      subLabel: null,
      value: stats?.draft ?? configs.filter((c) => c.approvalStatus === "DRAFT").length,
      icon: FileText,
      color: "bg-slate-400 text-white",
      active: approvalStatusFilter === "DRAFT" && configStatusFilter === "ALL",
    },
    {
      key: "REJECTED",
      label: "Rejected",
      subLabel: null,
      value: stats?.rejected ?? configs.filter((c) => c.approvalStatus === "REJECTED").length,
      icon: XCircle,
      color: "bg-rose-600 text-white",
      active: approvalStatusFilter === "REJECTED" && configStatusFilter === "ALL",
    },
  ];

  const configurationKpis = [
    {
      key: "ACTIVE",
      label: "Active",
      subLabel: null,
      value: stats?.active ?? configs.filter((c) => c.billingStatus === "ACTIVE").length,
      icon: CheckCircle2,
      color: "bg-emerald-600 text-white",
      active: configStatusFilter === "ACTIVE" && approvalStatusFilter === "ALL",
    },
    {
      key: "INACTIVE",
      label: "Inactive",
      subLabel: null,
      value: stats?.inactive ?? configs.filter((c) => c.billingStatus === "INACTIVE").length,
      icon: Ban,
      color: "bg-slate-500 text-white",
      active: configStatusFilter === "INACTIVE" && approvalStatusFilter === "ALL",
    },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Page Header */}
      <PageHeader
        title="Project Billing Setup — Overview"
        subtitle="A snapshot of billing configuration coverage across enterprise and standalone projects."
        actions={
          <Button
            variant="primary"
            onClick={() => navigate("/account-receivable/project-billing-setup/workspace")}
          >
            + Create Billing Setup
          </Button>
        }
      />

      {/* 2. KPIs Sections — divided into Approval Status and Configuration Status */}
      <div className="space-y-3">
        {/* Section 1: Approval Status */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-slate-800 px-0.5 select-none">
            Approval Status
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {approvalKpis.map((kpi) => (
              <button
                key={kpi.key}
                type="button"
                onClick={() => handleKpiClick(kpi.key)}
                className="text-left rounded-xl transition-transform active:scale-[0.99] focus:outline-none"
              >
                <ARKPICard
                  label={kpi.label}
                  subLabel={kpi.subLabel}
                  value={loadingStats ? "…" : kpi.value}
                  icon={<kpi.icon className="h-5 w-5" />}
                  color={kpi.color}
                  active={kpi.active}
                  className={cn(
                    "h-full w-full cursor-pointer bg-white shadow-sm transition-all hover:shadow-md",
                    kpi.isTotal && !kpi.active && "border-indigo-200/80 bg-gradient-to-br from-indigo-50/30 to-white"
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Configuration Status */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-slate-800 px-0.5 select-none">
            Configuration Status
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {configurationKpis.map((kpi) => (
              <button
                key={kpi.key}
                type="button"
                onClick={() => handleKpiClick(kpi.key)}
                className="text-left rounded-xl transition-transform active:scale-[0.99] focus:outline-none"
              >
                <ARKPICard
                  label={kpi.label}
                  subLabel={kpi.subLabel}
                  value={loadingStats ? "…" : kpi.value}
                  icon={<kpi.icon className="h-5 w-5" />}
                  color={kpi.color}
                  active={kpi.active}
                  className="h-full w-full cursor-pointer bg-white shadow-sm transition-all hover:shadow-md"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Billing Configurations */}
      <PageCard>
        <PageCardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 w-full lg:max-w-md">
              <SearchInput
                value={filters.search}
                onChange={handleSearchInputChange}
                placeholder="Search by project, code or client..."
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setApprovalStatusFilter("ALL");
                  setConfigStatusFilter("ALL");
                  setCurrentPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap",
                  approvalStatusFilter === "ALL" && configStatusFilter === "ALL" && !filters.search
                    ? "border-blue-300 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                )}
                title="Show all configurations"
              >
                All Configurations ({filteredConfigs.length})
              </button>

              <div className="w-48 sm:w-52">
                <FilterListbox
                  options={APPROVAL_STATUS_OPTIONS}
                  value={approvalStatusFilter}
                  onChange={(val) => {
                    setApprovalStatusFilter(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Approval Status"
                />
              </div>

              <div className="w-48 sm:w-52">
                <FilterListbox
                  options={CONFIG_STATUS_OPTIONS}
                  value={configStatusFilter}
                  onChange={(val) => {
                    setConfigStatusFilter(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Configuration Status"
                />
              </div>

              {(approvalStatusFilter !== "ALL" || configStatusFilter !== "ALL" || filters.search) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  title="Clear all search and status filters"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                >
                  <FilterX className="h-3.5 w-3.5 text-slate-500" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {!loadingConfigs && filteredConfigs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">No Billing Configurations Found</h3>
              <p className="text-xs text-slate-500">
                {approvalStatusFilter !== "ALL" || configStatusFilter !== "ALL" || filters.search
                  ? "Try adjusting your search or filter, or create a new billing setup."
                  : "Try adjusting your search query, or create a new billing setup."}
              </p>
            </div>
          ) : (
            <>
              <ARTable
                headers={TABLE_HEADERS}
                columns={TABLE_COLUMNS}
                rows={tableRows}
                alignments={{ client: "left", project: "left" }}
                loading={loadingConfigs}
              />
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPrevious={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                onNext={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
              />
            </>
          )}
        </PageCardContent>
      </PageCard>

      {/* Deactivation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deactivateTarget)}
        title="Deactivate Billing Configuration"
        message={
          deactivateTarget
            ? `Are you sure you want to deactivate the billing setup for ${deactivateTarget.projectName}? Invoice generation will stop until it is reactivated.`
            : ""
        }
        confirmText="Deactivate"
        variant="danger"
        isLoading={deactivateLoading}
        onCancel={closeDeactivateModal}
        onConfirm={handleConfirmDeactivate}
      />

      {/* Delete Draft Modal */}
      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Draft Billing Configuration"
        message={
          deleteTarget
            ? `Are you sure you want to permanently delete the draft billing setup for ${deleteTarget.projectName}? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        variant="danger"
        isLoading={deleteLoading}
        onCancel={closeDeleteModal}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
