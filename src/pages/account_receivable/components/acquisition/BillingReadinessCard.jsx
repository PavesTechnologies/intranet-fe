import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  BellRing,
  RefreshCw,
  XCircle,
  FileCheck,
  Info,
  SlidersHorizontal,
  FileSpreadsheet,
} from "lucide-react";
import StatusBadge from "../../../../components/status/statusbadge";
import Button from "../../../../components/Button/Button";

export default function BillingReadinessCard({
  config,
  acquisitionResults,
  onViewPending,
  onRemindPM,
  reminding = false,
}) {
  if (!config) return null;

  const status = config.billingStatus || "NOT_ACQUIRED";
  const laborRes = acquisitionResults?.labor || {};
  const readiness = laborRes.readiness || {};

  const isApprovedStatus = ["READY", "READY_TO_TAX", "READY_FOR_TAX", "TAX_COMPLETED", "IN_TAX"].includes(status);
  const approvedCount = readiness.approvedCount ?? (isApprovedStatus ? laborRes.records?.length || 0 : 0);
  const pendingCount = readiness.pendingCount ?? 0;
  const approvedHours = readiness.approvedHours ?? (isApprovedStatus ? laborRes.records?.reduce((acc, r) => acc + Number(r.hours || 0), 0) : 0);
  const pendingHours = readiness.pendingHours ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <FileCheck className="h-4 w-4 text-indigo-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Billing Readiness</h3>
        </div>
        <StatusBadge label={status} size="sm" />
      </div>

      {/* State-driven Content */}
      {status === "NOT_ACQUIRED" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-slate-800 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
            <Info className="h-4 w-4 text-slate-500 flex-shrink-0" />
            Snapshot Not Acquired
          </div>
          <p className="text-xs text-slate-600">
            Billing data has not been acquired for this billing period yet.
          </p>
        </div>
      ) : status === "VALIDATING" ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-indigo-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900 text-xs">
            <RefreshCw className="h-4 w-4 text-indigo-600 animate-spin flex-shrink-0" />
            Validating Readiness...
          </div>
          <p className="text-xs text-indigo-800">
            Checking timesheet approval readiness and billing configuration rules...
          </p>
        </div>
      ) : status === "READY" || status === "READY_TO_TAX" || status === "READY_FOR_TAX" || status === "TAX_COMPLETED" || status === "IN_TAX" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            {status === "TAX_COMPLETED"
              ? "Tax Calculation Completed"
              : status === "IN_TAX"
              ? "Tax Calculation In Progress"
              : "100% Approved — Ready for Billing"}
          </div>
          <p className="text-xs text-emerald-700">
            {status === "TAX_COMPLETED"
              ? "Tax has been calculated successfully for this billing snapshot."
              : status === "IN_TAX"
              ? "Tax calculation is currently processing."
              : "All required timesheets are approved and billing is ready."}
          </p>
          <div className="flex items-center gap-3 text-xs font-semibold text-emerald-800 border-t border-emerald-200/60 pt-1.5">
            <span>Approved: <strong className="font-mono">{approvedCount}</strong></span>
            <span>&middot;</span>
            <span>Billable Hours: <strong className="font-mono">{approvedHours} hrs</strong></span>
          </div>
        </div>
      ) : status === "PARTIALLY_READY" ? (
        <div className="space-y-2.5">
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              Approvals Pending
            </div>
            <p className="text-xs text-amber-800">
              Some required timesheets are still awaiting approval.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-2 text-center">
              <div className="text-[11px] text-slate-500 font-medium">Approved</div>
              <div className="font-mono font-bold text-emerald-700">{approvedCount} ({approvedHours}h)</div>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50/50 p-2 text-center">
              <div className="text-[11px] text-amber-700 font-medium">Pending</div>
              <div className="font-mono font-bold text-amber-800">{pendingCount} ({pendingHours}h)</div>
            </div>
          </div>
        </div>
      ) : status === "PENDING_APPROVAL" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
            Timesheets Awaiting Approval
          </div>
          <p className="text-xs text-amber-800">
            Timesheets were found, but approval is required before billing can proceed ({pendingCount} pending, {pendingHours} hrs).
          </p>
        </div>
      ) : status === "NO_BILLABLE_DATA" || status === "NO_DATA" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-slate-800 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
            <Info className="h-4 w-4 text-slate-500 flex-shrink-0" />
            No Billable Activity
          </div>
          <p className="text-xs text-slate-600">
            No billable timesheet activity was found for this billing period.
          </p>
        </div>
      ) : status === "CONFIGURATION_REQUIRED" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
            <SlidersHorizontal className="h-4 w-4 text-amber-600 flex-shrink-0" />
            Billing Setup Incomplete
          </div>
          <p className="text-xs text-amber-800">
            Billing configuration is incomplete. Complete setup before acquiring billing data.
          </p>
        </div>
      ) : status === "ALREADY_BILLED" ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
            <FileSpreadsheet className="h-4 w-4 text-blue-600 flex-shrink-0" />
            Billing Period Invoiced
          </div>
          <p className="text-xs text-blue-800">
            This billing period has already been invoiced.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-rose-900 text-xs">
            <XCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
            Acquisition Failed
          </div>
          <p className="text-xs text-rose-800">
            We couldn't retrieve billing data at this time.
          </p>
        </div>
      )}

      {/* Contextual Actions — approval-chase actions only; acquire/re-validate
          live as the page-level primary action to avoid duplicate controls */}
      {(status === "PARTIALLY_READY" || status === "PENDING_APPROVAL") && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <Button variant="outline" size="small" onClick={onViewPending} className="text-xs py-1">
            <Eye className="h-3 w-3" />
            View Pending ({pendingCount})
          </Button>

          <Button
            variant="primary"
            size="small"
            onClick={onRemindPM}
            disabled={reminding}
            className="bg-amber-600 hover:bg-amber-700 text-white border-amber-600 text-xs py-1"
          >
            <BellRing className={`h-3 w-3 ${reminding ? "animate-spin" : ""}`} />
            {reminding ? "Sending..." : "Remind PM"}
          </Button>
        </div>
      )}
    </div>
  );
}
