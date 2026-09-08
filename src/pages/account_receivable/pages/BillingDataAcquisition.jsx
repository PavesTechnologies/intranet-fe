import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../../components/ui/PageHeader";
import Loader from "../../../components/ui/Loader";
import { showStatusToast } from "../../../components/toastfy/toast";

import {
  fetchActiveBillingConfigurations,
  getBillingSnapshotByPeriod,
  getAcquiredSnapshotMetadata,
  formatBillingPeriod,
  toIsoDateOnly,
} from "../services/billingDataAcquisitionService";

import AcquisitionHeader from "../components/acquisition/AcquisitionHeader";
import AcquisitionMetrics from "../components/acquisition/AcquisitionMetrics";
import AcquisitionQueue from "../components/acquisition/AcquisitionQueue";

export default function BillingDataAcquisition() {
  const navigate = useNavigate();

  const [activeConfigs, setActiveConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState("");

  // Centralized filter state shared between KPI cards and Acquisition Queue
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);

    const now = new Date();
    const formatted =
      now.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }) +
      " " +
      now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    setLastSyncTime(formatted);

    try {
      const configs = await fetchActiveBillingConfigurations();

      // Batch query existing snapshots using the actual acquired snapshot period
      const updatedConfigs = await Promise.all(
        configs.map(async (cfg) => {
          if (!cfg.projectId) return cfg;

          // Check if there is an acquired snapshot period for this project
          const savedMeta = getAcquiredSnapshotMetadata(cfg.projectId);
          const snapStart = savedMeta?.billingPeriodStart;
          const snapEnd = savedMeta?.billingPeriodEnd;

          // CRITICAL: Only query by-period if we have the actual acquired snapshot period.
          // Do NOT call by-period using the project configuration period (cfg.periodStart / cfg.periodEnd).
          if (snapStart && snapEnd) {
            const existingSnapshot = await getBillingSnapshotByPeriod(
              cfg.projectId,
              snapStart,
              snapEnd
            );
            if (existingSnapshot && existingSnapshot.snapshotId) {
              const effectiveStatus = existingSnapshot.status || savedMeta?.status || cfg.billingStatus || "READY_FOR_TAX";
              const actualStart = existingSnapshot.billingPeriodStart || snapStart;
              const actualEnd = existingSnapshot.billingPeriodEnd || snapEnd;
              const actualPeriod = existingSnapshot.billingPeriod || formatBillingPeriod(actualStart, actualEnd);

              return {
                ...cfg,
                projectPeriodStart: cfg.periodStart,
                projectPeriodEnd: cfg.periodEnd,
                billingStatus: effectiveStatus,
                snapshotNumber: existingSnapshot.snapshotNumber,
                snapshotId: existingSnapshot.snapshotId,
                snapshotPeriodStart: actualStart,
                snapshotPeriodEnd: actualEnd,
                billingPeriodStart: actualStart,
                billingPeriodEnd: actualEnd,
                billingPeriod: actualPeriod,
                existingSnapshot,
              };
            }
          }
          return cfg;
        })
      );

      setActiveConfigs(updatedConfigs);
      if (isManualRefresh) {
        showStatusToast("Acquisition console synchronized with source systems.", "success");
      }
    } catch (err) {
      console.error("[BillingDataAcquisition] Load error:", err);
    } finally {
      setLoadingConfigs(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleViewConfig = (config) => {
    navigate(`/account-receivable/billing-data-acquisition/${config.projectId}`, { state: { config } });
  };

  const handleClearFilters = () => {
    setSelectedStatusFilter("ALL");
    setSearchQuery("");
  };

  if (loadingConfigs) {
    return (
      <div className="flex h-[500px] items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Billing Data Acquisition Console"
        subtitle="Manage source data acquisition, review billing snapshots, and prepare commercial records for invoicing."
        actions={
          <AcquisitionHeader
            lastSync={lastSyncTime}
            onRefresh={() => loadData(true)}
            refreshing={refreshing}
          />
        }
      />

      {/* KPI Metrics Summary (Interactive cards synchronized with Queue filter) */}
      <AcquisitionMetrics
        configs={activeConfigs}
        loading={loadingConfigs}
        selectedStatusFilter={selectedStatusFilter}
        onSelectStatusFilter={setSelectedStatusFilter}
      />

      {/* Acquisition Queue — full-width, scalable enterprise table */}
      <AcquisitionQueue
        configs={activeConfigs}
        onViewConfig={handleViewConfig}
        loading={loadingConfigs}
        selectedStatusFilter={selectedStatusFilter}
        onStatusFilterChange={setSelectedStatusFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onClearFilters={handleClearFilters}
      />
    </div>
  );
}
