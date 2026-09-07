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
} from "lucide-react";

import PageHeader from "../../../components/ui/PageHeader";
import { PageCard, PageCardContent } from "../../../components/Cards/PageCard";
import { KPICard } from "../../../components/kpi/KPI";
import Button from "../../../components/Button/Button";
import SearchInput from "../../../components/filter/Searchbar";
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

// Finance Executive (Maker) view — create/save-draft/edit/submit only.
// Approve/Reject are Finance Manager (Checker) actions and live entirely in
// BillingApprovals.jsx / billingApprovalService.js; this page must never call
// them, and never calls the removed /activate endpoint either.
const INITIAL_FILTERS = { search: "" };
const PAGE_SIZE = 6;

// Keys for the interactive KPI-as-filter row below. "ACTIVE" is a synthetic
// bucket (APPROVED + billingStatus ACTIVE) that has no direct match against
// config.approvalStatus, so it's handled separately in filteredConfigs.
const STATUS_FILTERS = {
  ALL: "ALL",
  ACTIVE: "ACTIVE",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  DRAFT: "DRAFT",
  REJECTED: "REJECTED",
};

const TABLE_HEADERS = ["Client", "Project", "Billing Type", "Approval Status", "Billing Status", "Actions"];
const TABLE_COLUMNS = ["client", "project", "billingType", "approvalStatus", "billingStatus", "actions"];

export default function Overview() {
  const navigate = useNavigate();

  // Overview Stats State
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Billing Configurations State
  const [configs, setConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ALL);
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
    // initial load
    loadConfigurations();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearchInputChange = (event) => {
    setFilters((prev) => ({ ...prev, search: event.target.value }));
    setCurrentPage(1);
  };

  const handleSearch = (value) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setCurrentPage(1);
  };

  const handleStatusFilterClick = (key) => {
    setStatusFilter(key);
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

      let matchesStatus = true;
      if (statusFilter === STATUS_FILTERS.ACTIVE) {
        matchesStatus = config.approvalStatus === "APPROVED" && config.billingStatus === "ACTIVE";
      } else if (statusFilter !== STATUS_FILTERS.ALL) {
        matchesStatus = config.approvalStatus === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [configs, filters, statusFilter]);

  const totalPages = Math.ceil(filteredConfigs.length / PAGE_SIZE) || 1;
  const paginatedConfigs = filteredConfigs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
        approvalStatus: <StatusBadge label={config.approvalStatusLabel} size="sm" />,
        billingStatus: <StatusBadge label={config.billingStatusLabel} size="sm" />,
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

  // Each KPI doubles as a status filter for the table below — clicking one
  // toggles statusFilter instead of a separate dropdown/tab control.
  const kpiCards = [
    {
      key: STATUS_FILTERS.ALL,
      label: "Total Configurations",
      value: stats?.total ?? "—",
      icon: FolderKanban,
      color: "bg-[#0A0082] text-white",
    },
    {
      key: STATUS_FILTERS.ACTIVE,
      label: "Active",
      value: stats?.active ?? "—",
      icon: CheckCircle2,
      color: "bg-emerald-600 text-white",
    },
    {
      key: STATUS_FILTERS.PENDING_APPROVAL,
      label: "Pending Approval",
      value: stats?.pending ?? "—",
      icon: Clock,
      color: "bg-amber-500 text-white",
    },
    {
      key: STATUS_FILTERS.DRAFT,
      label: "Draft",
      value: stats?.draft ?? "—",
      icon: FileText,
      color: "bg-slate-400 text-white",
    },
    {
      key: STATUS_FILTERS.REJECTED,
      label: "Rejected",
      value: stats?.rejected ?? "—",
      icon: XCircle,
      color: "bg-rose-600 text-white",
    },
  ];

  const tabCounts = useMemo(() => {
    return {
      ALL: configs.length,
      ACTIVE: configs.filter((c) => c.approvalStatus === "APPROVED" && c.billingStatus === "ACTIVE").length,
      PENDING_APPROVAL: configs.filter((c) => c.approvalStatus === "PENDING_APPROVAL").length,
      DRAFT: configs.filter((c) => c.approvalStatus === "DRAFT").length,
      REJECTED: configs.filter((c) => c.approvalStatus === "REJECTED").length,
    };
  }, [configs]);

  const tabs = [
    { key: STATUS_FILTERS.ALL, label: "All Records", icon: FolderKanban, count: tabCounts.ALL },
    { key: STATUS_FILTERS.ACTIVE, label: "Active", icon: CheckCircle2, count: tabCounts.ACTIVE },
    { key: STATUS_FILTERS.PENDING_APPROVAL, label: "Pending Approval", icon: Clock, count: tabCounts.PENDING_APPROVAL },
    { key: STATUS_FILTERS.DRAFT, label: "Draft", icon: FileText, count: tabCounts.DRAFT },
    { key: STATUS_FILTERS.REJECTED, label: "Rejected", icon: XCircle, count: tabCounts.REJECTED },
  ];

  return (
    <div className="space-y-3">
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

      {/* 2. KPIs Row — each card is also a status filter for the table below */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((kpi) => (
          <button key={kpi.key} type="button" onClick={() => handleStatusFilterClick(kpi.key)} className="text-left">
            <KPICard
              label={kpi.label}
              value={loadingStats ? "…" : kpi.value}
              icon={<kpi.icon className="h-5 w-5" />}
              color={kpi.color}
              className="h-full w-full cursor-pointer bg-white shadow-sm transition-shadow hover:shadow-md"
            />
          </button>
        ))}
      </div>

      {/* 3. Billing Configurations */}
      <PageCard>
        <PageCardContent className="p-4 sm:p-5 space-y-4">
          {/* Enterprise Status Tabs */}
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-2 overflow-x-auto sm:space-x-4" aria-label="Status Tabs">
              {tabs.map((tab) => {
                const isActive = statusFilter === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleStatusFilterClick(tab.key)}
                    className={`group inline-flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? "border-[#0A0082] text-[#0A0082]"
                        : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? "text-[#0A0082]" : "text-slate-400 group-hover:text-slate-500"}`} />
                    <span>{tab.label}</span>
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        isActive
                          ? "bg-[#0A0082]/10 text-[#0A0082]"
                          : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                      }`}
                    >
                      {loadingConfigs ? "…" : tab.count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-md">
              <SearchInput
                value={filters.search}
                onChange={handleSearchInputChange}
                onSearch={handleSearch}
                placeholder="Search by project, code or client..."
              />
            </div>
            {statusFilter !== STATUS_FILTERS.ALL && (
              <button
                type="button"
                onClick={() => handleStatusFilterClick(STATUS_FILTERS.ALL)}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 sm:self-auto"
              >
                Filtered: {kpiCards.find((kpi) => kpi.key === statusFilter)?.label}
                <span aria-hidden="true">&times;</span>
              </button>
            )}
          </div>

          {!loadingConfigs && filteredConfigs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">No Billing Configurations Found</h3>
              <p className="text-xs text-slate-500">
                {statusFilter !== STATUS_FILTERS.ALL || filters.search
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
