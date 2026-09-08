import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calculator,
  RefreshCw,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  Layers,
  Inbox,
  Loader2,
  Filter,
} from "lucide-react";

import PageHeader from "../../../../components/ui/PageHeader";
import { PageCard, PageCardContent } from "../../../../components/Cards/PageCard";
import Button from "../../../../components/Button/Button";
import Loader from "../../../../components/ui/Loader";
import StatusBadge from "../../../../components/status/statusbadge";
import { showStatusToast } from "../../../../components/toastfy/toast";
import ARTable from "../common/ARTable";

import {
  fetchActiveBillingConfigurations,
  getBillingSnapshotByPeriod,
  getAcquiredSnapshotMetadata,
  formatBillingPeriod,
} from "../../services/billingDataAcquisitionService";
import {
  calculateTax,
  getTaxCalculation,
  getTaxCalculationErrorMessage,
} from "../../services/taxCalculationService";
import { getActiveTaxRegions } from "../../services/taxRateConfigurationService";

const ACQUISITION_PATH = "/account-receivable/billing-data-acquisition";

export default function TaxCalculationConsole() {
  const navigate = useNavigate();

  const [snapshots, setSnapshots] = useState([]);
  const [taxRegions, setTaxRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calculatingIds, setCalculatingIds] = useState({});

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setLoading(true);

    try {
      const activeConfigs = await fetchActiveBillingConfigurations();
      const regionsList = await getActiveTaxRegions().catch(() => []);

      const loadedSnapshots = (
        await Promise.all(
          activeConfigs.map(async (cfg) => {
            if (!cfg.projectId && !cfg.id) return null;

            const savedMeta = getAcquiredSnapshotMetadata(cfg.projectId);
            const snapStart = savedMeta?.billingPeriodStart || null;
            const snapEnd = savedMeta?.billingPeriodEnd || null;

            let existingSnapshot = null;
            if (cfg.projectId && snapStart && snapEnd) {
              existingSnapshot = await getBillingSnapshotByPeriod(cfg.projectId, snapStart, snapEnd).catch(() => null);
            }

            const snapshotId =
              existingSnapshot?.snapshotId ||
              savedMeta?.snapshotId ||
              cfg.snapshotId ||
              null;

            const snapshotNumber =
              existingSnapshot?.snapshotNumber ||
              savedMeta?.snapshotNumber ||
              cfg.snapshotNumber ||
              null;

            let snapshotStatus =
              existingSnapshot?.status ||
              savedMeta?.status ||
              cfg.billingStatus ||
              (snapshotId ? "READY_TO_TAX" : "NOT_ACQUIRED");

            let taxableAmount =
              existingSnapshot?.totalAmount ||
              existingSnapshot?.subtotal ||
              savedMeta?.totalAmount ||
              savedMeta?.subtotal ||
              cfg.projectBudget ||
              0;

            let taxRegionName = cfg.taxRegionName || cfg.taxRegionLabel || "India";

            if (snapshotId && (snapshotStatus === "TAX_COMPLETED" || snapshotStatus === "IN_TAX" || existingSnapshot)) {
              const taxCalcData = await getTaxCalculation(snapshotId).catch(() => null);
              if (taxCalcData) {
                snapshotStatus = taxCalcData.status || snapshotStatus;
                if (taxCalcData.taxableAmount !== null && taxCalcData.taxableAmount !== undefined) {
                  taxableAmount = taxCalcData.taxableAmount;
                }
                if (taxCalcData.taxRegionName) {
                  taxRegionName = taxCalcData.taxRegionName;
                }
              }
            }

            if (typeof taxRegionName === "string" && taxRegionName.includes("-") && taxRegionName.length > 30) {
              const matched = regionsList.find(
                (r) => r.taxRegionId === taxRegionName || r.id === taxRegionName
              );
              taxRegionName = matched?.taxRegionName || matched?.label || "India";
            }

            const stUpper = (snapshotStatus || "").toUpperCase();
            if (snapshotId && stUpper === "READY") {
              snapshotStatus = "READY_TO_TAX";
            }

            const displayPeriod =
              existingSnapshot?.billingPeriod ||
              (snapStart && snapEnd ? formatBillingPeriod(snapStart, snapEnd) : cfg.billingPeriod);

            return {
              id: snapshotId || `cfg-${cfg.id || cfg.projectId}`,
              snapshotId,
              snapshotNumber,
              client: cfg.client || "Account Management",
              projectName: cfg.projectName || "Website Redesign",
              projectCode: cfg.projectCode || `PRJ-${cfg.projectId || "1"}`,
              billingPeriod: displayPeriod,
              periodStart: snapStart || cfg.periodStart,
              periodEnd: snapEnd || cfg.periodEnd,
              taxRegion: taxRegionName || "India",
              currency: cfg.currency || "USD",
              taxableAmount,
              status: snapshotStatus,
              config: {
                ...cfg,
                snapshotPeriodStart: snapStart,
                snapshotPeriodEnd: snapEnd,
                billingPeriod: displayPeriod,
                snapshotId,
                snapshotNumber,
                billingStatus: snapshotStatus,
              },
            };
          })
        )
      ).filter(Boolean);
      setSnapshots(loadedSnapshots);
      setTaxRegions(regionsList);

      if (isManualRefresh) {
        showStatusToast("Tax calculation queue refreshed.", "success");
      }
    } catch (err) {
      console.error("[TaxCalculationConsole] Error loading data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter population down to relevant tax snapshot candidates
  const relevantSnapshots = useMemo(() => {
    return snapshots.filter((s) => {
      const st = (s.status || "").toUpperCase();
      return (
        st === "READY_TO_TAX" ||
        st === "READY_FOR_TAX" ||
        st === "READY" ||
        st === "IN_TAX" ||
        st === "TAX_COMPLETED"
      );
    });
  }, [snapshots]);

  // Executive KPI Card Counts
  const kpis = useMemo(() => {
    let readyToTax = 0;
    let inTax = 0;
    let taxCompleted = 0;

    relevantSnapshots.forEach((s) => {
      const st = (s.status || "").toUpperCase();
      if (st === "READY_TO_TAX" || st === "READY_FOR_TAX" || st === "READY") readyToTax++;
      else if (st === "IN_TAX") inTax++;
      else if (st === "TAX_COMPLETED") taxCompleted++;
    });

    return {
      totalSnapshots: relevantSnapshots.length,
      readyToTax,
      inTax,
      taxCompleted,
    };
  }, [relevantSnapshots]);

  // Filtered Queue
  const filteredSnapshots = useMemo(() => {
    return relevantSnapshots.filter((s) => {
      const st = (s.status || "").toUpperCase();

      // Status filter
      if (statusFilter === "READY_TO_TAX") {
        if (st !== "READY_TO_TAX" && st !== "READY_FOR_TAX" && st !== "READY") return false;
      } else if (statusFilter === "IN_TAX") {
        if (st !== "IN_TAX") return false;
      } else if (statusFilter === "TAX_COMPLETED") {
        if (st !== "TAX_COMPLETED") return false;
      }

      // Region filter
      if (regionFilter !== "ALL") {
        if (s.taxRegion !== regionFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pName = (s.projectName || "").toLowerCase();
        const pCode = (s.projectCode || "").toLowerCase();
        const client = (s.client || "").toLowerCase();
        const snapNum = (s.snapshotNumber || "").toLowerCase();

        if (
          !pName.includes(q) &&
          !pCode.includes(q) &&
          !client.includes(q) &&
          !snapNum.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [relevantSnapshots, statusFilter, regionFilter, searchQuery]);

  // Unique Tax Regions for Filter list
  const uniqueRegions = useMemo(() => {
    const set = new Set();
    relevantSnapshots.forEach((s) => {
      if (s.taxRegion) set.add(s.taxRegion);
    });
    return Array.from(set);
  }, [relevantSnapshots]);

  // Action button handler
  const handleAction = (item) => {
    const snapId = item.snapshotId;

    if (!snapId) {
      showStatusToast("Billing snapshot information is unavailable. Please refresh the billing data.", "error");
      return;
    }

    // Always navigate to the Tax Calculation detail page where calculation is reviewed and executed
    navigate(`/account-receivable/tax-calculation/${snapId}`, {
      state: { config: item.config },
    });
  };

  const renderActionButton = (item) => {
    const st = (item.status || "").toUpperCase();
    const snapId = item.snapshotId;
    const isCalculating = calculatingIds[snapId];

    if (!snapId) {
      return (
        <Button
          size="sm"
          variant="outline"
          disabled
          className="text-xs text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed"
          title="Billing snapshot information is unavailable. Please refresh the billing data."
        >
          <Calculator className="mr-1.5 h-3.5 w-3.5" />
          Snapshot Unavailable
        </Button>
      );
    }

    if (isCalculating) {
      return (
        <Button size="sm" variant="primary" disabled className="bg-amber-600 border-amber-600 text-white text-xs">
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          Calculating Tax...
        </Button>
      );
    }

    if (st === "IN_TAX") {
      return (
        <Button size="sm" variant="outline" disabled className="text-xs text-amber-700 bg-amber-50 border-amber-200">
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          Calculation in Progress
        </Button>
      );
    }

    if (st === "TAX_COMPLETED") {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            handleAction(item);
          }}
          className="text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold"
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          View Calculation
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        variant="primary"
        onClick={(e) => {
          e.stopPropagation();
          handleAction(item);
        }}
        className="bg-[#0A0082] hover:bg-[#0A0082]/90 text-white text-xs font-semibold"
      >
        <Calculator className="mr-1.5 h-3.5 w-3.5" />
        Calculate Tax
      </Button>
    );
  };

  if (loading && !refreshing) {
    return (
      <div className="flex h-80 items-center justify-center">
        <Loader size="lg" text="Loading Tax Calculation Console..." />
      </div>
    );
  }

  // Genuine Empty State (when zero relevant snapshots exist)
  if (!loading && relevantSnapshots.length === 0) {
    return (
      <div className="w-full space-y-6">
        <PageHeader
          title="Tax Calculation"
          subtitle="Calculate and review tax for acquired billing snapshots."
          action={
            <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />

        <PageCard>
          <PageCardContent className="p-12 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Calculator className="h-8 w-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-slate-800">
                No Billing Snapshots Ready for Tax Calculation
              </h3>
              <p className="text-sm text-slate-500">
                Acquire and validate billing data before starting tax calculation.
              </p>
            </div>
            <div className="pt-3">
              <Button
                onClick={() => navigate(ACQUISITION_PATH)}
                className="bg-[#0A0082] text-white hover:bg-[#0A0082]/90 font-semibold px-6 py-2.5"
              >
                Go to Billing Data Acquisition
              </Button>
            </div>
          </PageCardContent>
        </PageCard>
      </div>
    );
  }

  const tableHeaders = [
    "Client",
    "Project",
    "Snapshot Number",
    "Billing Period",
    "Tax Region",
    "Commercial Amount",
    "Status",
    "Action",
  ];

  const tableColumns = [
    "client",
    "project",
    "snapshotNumber",
    "billingPeriod",
    "taxRegion",
    "taxableAmount",
    "status",
    "action",
  ];

  const tableRows = filteredSnapshots.map((item) => ({
    onRowClick: () => {
      if (!item.snapshotId) {
        showStatusToast("Billing snapshot information is unavailable. Please refresh the billing data.", "error");
        return;
      }
      handleAction(item);
    },
    client: <span className="font-semibold text-slate-800">{item.client}</span>,
    project: (
      <div className="text-left">
        <div className="font-bold text-slate-900">{item.projectName}</div>
        <div className="text-xs font-mono text-slate-400">{item.projectCode}</div>
      </div>
    ),
    snapshotNumber: item.snapshotNumber ? (
      <span className="font-mono font-semibold text-indigo-700">{item.snapshotNumber}</span>
    ) : (
      <span className="text-xs text-slate-400 italic">Not available</span>
    ),
    billingPeriod: <span className="font-medium text-slate-700">{item.billingPeriod}</span>,
    taxRegion: <span className="font-medium text-slate-800">{item.taxRegion}</span>,
    taxableAmount: (
      <span className="font-mono font-bold text-slate-900">
        {item.currency} {Number(item.taxableAmount || 0).toLocaleString()}
      </span>
    ),
    status: <StatusBadge label={item.status} size="sm" />,
    action: renderActionButton(item),
  }));

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <PageHeader
        title="Tax Calculation"
        subtitle="Calculate and review tax for acquired billing snapshots."
        action={
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Snapshots</span>
            <Layers className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{kpis.totalSnapshots}</div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Ready for Tax</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-900">{kpis.readyToTax}</div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold uppercase tracking-wider">In Tax</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-900">{kpis.inTax}</div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Tax Completed</span>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-blue-900">{kpis.taxCompleted}</div>
        </div>
      </div>

      {/* Queue Card & Filters */}
      <PageCard>
        <PageCardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by project, client, or snapshot number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Filter className="h-3.5 w-3.5" /> Filter:
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="ALL">All Statuses ({relevantSnapshots.length})</option>
                <option value="READY_TO_TAX">Ready for Tax ({kpis.readyToTax})</option>
                <option value="IN_TAX">In Tax ({kpis.inTax})</option>
                <option value="TAX_COMPLETED">Tax Completed ({kpis.taxCompleted})</option>
              </select>

              {/* Region Filter */}
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="ALL">All Tax Regions</option>
                {uniqueRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* AR Table */}
          <ARTable
            headers={tableHeaders}
            columns={tableColumns}
            rows={tableRows}
            loading={loading}
            emptyMessage="No billing snapshots match your current filters."
          />
        </PageCardContent>
      </PageCard>
    </div>
  );
}
