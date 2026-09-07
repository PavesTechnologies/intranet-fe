import { useState } from "react";
import BillingSummaryGrid from "./BillingSummaryGrid";
import TimesheetDataTable from "./TimesheetDataTable";
import CommercialCalculationCard from "./CommercialCalculationCard";
import BillingReadinessCard from "./BillingReadinessCard";
import PendingTimesheetsModal from "./PendingTimesheetsModal";

// Renders the body of a Billing Snapshot: overview fields, the line-item
// table, readiness context and commercial value. Page-level identity
// (title/status/breadcrumb) and workflow actions live in AcquisitionDetail.
export default function SnapshotWorkspace({
  config,
  acquisitionResults,
  acquiring,
  onRemindPM,
  remindingPM = false,
}) {
  const [showPendingModal, setShowPendingModal] = useState(false);

  const timesheetRecords = acquisitionResults?.labor?.records || [];
  const laborAmount = acquisitionResults?.labor?.amount || 0;
  const pendingTimesheets = acquisitionResults?.labor?.readiness?.pendingTimesheets || [];

  return (
    <div className="space-y-5">
      {/* Snapshot Overview */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Snapshot Overview</h2>
        <BillingSummaryGrid config={config} />
      </section>

      {/* Financial Operations Workspace */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* Left: Billing Items (dominant working area) */}
        <div className="lg:col-span-8 min-w-0">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Billing Items</h2>
          <TimesheetDataTable
            records={timesheetRecords}
            currency={config.currency}
            loading={acquiring}
            billingType={config.billingType}
            billingStatus={config.billingStatus}
          />
        </div>

        {/* Right: Readiness + Commercial Value (sticky control rail) */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-6 self-start">
          <BillingReadinessCard
            config={config}
            acquisitionResults={acquisitionResults}
            onViewPending={() => setShowPendingModal(true)}
            onRemindPM={onRemindPM}
            reminding={remindingPM}
          />

          <CommercialCalculationCard
            laborAmount={laborAmount}
            expenseAmount={0}
            adjustments={0}
            currency={config.currency}
          />
        </aside>
      </div>

      <PendingTimesheetsModal
        isOpen={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        pendingTimesheets={pendingTimesheets}
        config={config}
        onRemindPM={onRemindPM}
        reminding={remindingPM}
      />
    </div>
  );
}
