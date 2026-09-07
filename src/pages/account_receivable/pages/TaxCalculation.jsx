import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { RefreshCw, FileText, ShieldCheck } from "lucide-react";

import { PageCard, PageCardContent } from "../../../components/Cards/PageCard";
import Button from "../../../components/Button/Button";
import Loader from "../../../components/ui/Loader";
import StatusBadge from "../../../components/status/statusbadge";
import Breadcrumb from "../../../components/Breadcrumb/Breadcrumb";
import { showStatusToast } from "../../../components/toastfy/toast";
import { formatCurrency, formatDisplayDate } from "../utils/format";

import {
  getTaxCalculation,
  getTaxCalculationErrorMessage,
} from "../services/taxCalculationService";
import TaxCalculationConsole from "../components/tax_calculation/TaxCalculationConsole";

const CONSOLE_PATH = "/account-receivable/tax-calculation";

const formatRatePercentage = (rate) => {
  if (rate === null || rate === undefined || rate === "") return null;
  const num = Number(rate);
  if (Number.isNaN(num)) return null;
  return `${num.toFixed(2)}%`;
};

// Applicability is decided entirely by the backend tax engine; this only
// maps known enum values to a readable label and falls back to a generic
// title-case conversion so an unrecognized future value never breaks the UI.
const APPLICABILITY_LABELS = {
  SAME_JURISDICTION: "Same Jurisdiction",
  DIFFERENT_JURISDICTION: "Different Jurisdiction",
  ALL: "All Jurisdictions",
};

const humanizeApplicability = (value) => {
  if (!value) return "Not specified";
  if (APPLICABILITY_LABELS[value]) return APPLICABILITY_LABELS[value];
  return String(value)
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

function Field({ label, children }) {
  return (
    <div>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="mt-0.5 block truncate text-sm font-semibold text-slate-800" title={typeof children === "string" ? children : undefined}>
        {children || "—"}
      </span>
    </div>
  );
}

export default function TaxCalculation() {
  const { snapshotId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const passedState = location.state || {};
  const [taxCalc, setTaxCalc] = useState(passedState.taxCalculation || null);
  const [loading, setLoading] = useState(Boolean(snapshotId || passedState.config?.snapshotId || passedState.config?.id) && !passedState.taxCalculation);
  const [errorMsg, setErrorMsg] = useState("");

  const config = passedState.config || {};
  const effectiveSnapshotId = snapshotId || taxCalc?.billingSnapshotId || config?.snapshotId || config?.id;

  const loadTaxCalculationData = async () => {
    if (!effectiveSnapshotId) {
      setErrorMsg("No billing snapshot selected. Please select a billing snapshot from Billing Data Acquisition to view or calculate tax.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const data = await getTaxCalculation(effectiveSnapshotId);
      if (data) {
        setTaxCalc(data);
      } else {
        setErrorMsg("Tax calculation could not be found for this billing snapshot.");
      }
    } catch (err) {
      const msg = getTaxCalculationErrorMessage(err, "Unable to load tax calculation. Please try again.");
      setErrorMsg(msg);
      showStatusToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!taxCalc) {
      if (effectiveSnapshotId) {
        loadTaxCalculationData();
      } else {
        setLoading(false);
        setErrorMsg("No billing snapshot selected.");
      }
    }
  }, [effectiveSnapshotId]);

  // If no snapshotId exists (standalone route /account-receivable/tax-calculation), render Tax Calculation Console
  if (!effectiveSnapshotId) {
    return <TaxCalculationConsole />;
  }

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <Loader size="lg" text="Loading tax calculation..." />
      </div>
    );
  }

  // Handle case where snapshotId was specified but backend fetch failed/returned null
  if (errorMsg || !taxCalc) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <Breadcrumb items={[{ label: "Tax Calculation", to: CONSOLE_PATH }, { label: "Not Found" }]} />

        <PageCard>
          <PageCardContent className="p-10 text-center space-y-4">
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-slate-800">
                {errorMsg || "Tax calculation could not be found."}
              </h3>
              <p className="text-sm text-slate-500">
                Please verify that billing data acquisition has been completed and tax calculation was executed for this snapshot.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-3">
              <Button
                onClick={() => navigate(CONSOLE_PATH)}
                className="bg-[#0A0082] text-white hover:bg-[#0A0082]/90 font-medium px-5"
              >
                Go to Tax Calculation Queue
              </Button>
              <Button variant="outline" onClick={loadTaxCalculationData}>
                Retry Loading
              </Button>
            </div>
          </PageCardContent>
        </PageCard>
      </div>
    );
  }

  // Derive metadata and currency
  const currency =
    taxCalc.currencyCode ||
    taxCalc.currency ||
    config.currency ||
    passedState.currency ||
    "USD";

  const projectName =
    taxCalc.projectName ||
    taxCalc.project_name ||
    config.projectName ||
    config.project ||
    passedState.projectName ||
    "—";

  const clientName =
    taxCalc.clientName ||
    taxCalc.client_name ||
    config.client ||
    config.clientName ||
    passedState.clientName ||
    "—";

  const snapshotNum =
    taxCalc.snapshotNumber ||
    taxCalc.snapshot_number ||
    config.snapshotNumber ||
    effectiveSnapshotId;

  const rawPeriodStart =
    taxCalc.billingPeriodStart ||
    taxCalc.billing_period_start ||
    taxCalc.periodStart ||
    config.periodStart ||
    config.billingPeriodStart;

  const rawPeriodEnd =
    taxCalc.billingPeriodEnd ||
    taxCalc.billing_period_end ||
    taxCalc.periodEnd ||
    config.periodEnd ||
    config.billingPeriodEnd;

  const billingPeriod =
    rawPeriodStart && rawPeriodEnd
      ? `${formatDisplayDate(rawPeriodStart)} – ${formatDisplayDate(rawPeriodEnd)}`
      : config.billingPeriod || passedState.billingPeriod || "—";

  // Tax Breakdown: render whatever components the backend returned — never a
  // fixed set of tax types. The backend has already computed every rate and
  // amount below; this page only displays them.
  const components = Array.isArray(taxCalc.components) ? taxCalc.components : [];

  const taxableAmount = taxCalc.taxableAmount ?? passedState.acquisitionResults?.labor?.amount ?? 0;
  const totalTaxAmount = taxCalc.totalTaxAmount ?? 0;
  const grandTotal = taxCalc.grandTotal ?? (taxableAmount + totalTaxAmount);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <Breadcrumb items={[{ label: "Tax Calculation", to: CONSOLE_PATH }, { label: snapshotNum }]} />

      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Tax Calculation</h1>
            <StatusBadge label={taxCalc.status || "CALCULATED"} size="sm" />
          </div>
          <p className="text-sm text-slate-600">
            Snapshot <span className="ml-1 font-mono font-semibold text-slate-800">{snapshotNum}</span>
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{projectName}</span>
            <span className="mx-1.5 text-slate-300">&middot;</span>
            {clientName}
          </p>
        </div>

        <Button variant="outline" size="small" onClick={loadTaxCalculationData} className="flex items-center gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Financial statement */}
      <PageCard className="divide-y divide-slate-100">
        {/* Calculation Context */}
        <div className="p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Calculation Context</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Field label="Project">{projectName}</Field>
            <Field label="Client">{clientName}</Field>
            <Field label="Snapshot">
              <span className="font-mono">{snapshotNum}</span>
            </Field>
            <Field label="Billing Period">{billingPeriod}</Field>
            <Field label="Currency">
              <span className="font-mono">{currency}</span>
            </Field>
          </div>
        </div>

        {/* Commercial Value */}
        <div className="p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Commercial Value</h2>
          <div className="max-w-sm space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono font-semibold text-slate-800">{formatCurrency(taxableAmount, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Expenses</span>
              <span className="font-mono font-semibold text-slate-800">{formatCurrency(0, currency)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
              <span>Taxable Amount</span>
              <span className="font-mono text-base text-indigo-900">{formatCurrency(taxableAmount, currency)}</span>
            </div>
          </div>
        </div>

        {/* Tax Breakdown */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <FileText className="h-3.5 w-3.5 text-indigo-600" /> Tax Breakdown
            </span>
            <span className="text-[11px] font-medium text-slate-400">Applicable Rates &amp; Amounts</span>
          </div>

          {components.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
              No tax components applicable for this configuration.
            </div>
          ) : (
            <>
              {/* Desktop / tablet table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-2 pr-3 font-bold">Tax Component</th>
                      <th className="pb-2 px-3 font-bold">Applicability</th>
                      <th className="pb-2 px-3 text-right font-bold">Rate</th>
                      <th className="pb-2 pl-3 text-right font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {components.map((component) => (
                      <tr key={component.id}>
                        <td className="py-3 pr-3 align-top">
                          <div className="font-semibold text-slate-800">
                            {component.taxTypeName || component.taxTypeCode || "Tax Component"}
                          </div>
                          {component.taxTypeCode && component.taxTypeName && (
                            <span className="mt-1 inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                              {component.taxTypeCode}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top text-slate-600">
                          {humanizeApplicability(component.applicabilityType)}
                        </td>
                        <td className="py-3 px-3 align-top text-right font-mono font-semibold text-slate-700">
                          {formatRatePercentage(component.appliedRate) ?? "—"}
                        </td>
                        <td className="py-3 pl-3 align-top text-right font-mono font-bold text-slate-900">
                          {formatCurrency(component.taxAmount, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked cards */}
              <div className="space-y-2.5 sm:hidden">
                {components.map((component) => (
                  <div key={component.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        {component.taxTypeName || component.taxTypeCode || "Tax Component"}
                      </span>
                      {component.taxTypeCode && component.taxTypeName && (
                        <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                          {component.taxTypeCode}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {humanizeApplicability(component.applicabilityType)}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-200 pt-2.5">
                      <span className="text-xs text-slate-500">Rate</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {formatRatePercentage(component.appliedRate) ?? "—"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Amount</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(component.taxAmount, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tax Summary — compact calculation flow */}
        <div className="p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Tax Summary</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-[130px]">
              <span className="block text-[11px] text-slate-400">Taxable Amount</span>
              <span className="block font-mono text-base font-semibold text-slate-800">
                {formatCurrency(taxableAmount, currency)}
              </span>
            </div>
            <span className="text-base text-slate-300">+</span>
            <div className="min-w-[130px]">
              <span className="block text-[11px] text-slate-400">Total Tax Amount</span>
              <span className="block font-mono text-base font-semibold text-slate-800">
                {formatCurrency(totalTaxAmount, currency)}
              </span>
            </div>
            <span className="text-base text-slate-300">&rarr;</span>
            <div className="min-w-[130px]">
              <span className="block text-[11px] text-slate-400">Grand Total</span>
              <span className="block font-mono text-base font-semibold text-indigo-900">
                {formatCurrency(grandTotal, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Grand Total — the single strongest visual element on the page */}
        <div className="p-5">
          <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/80 p-4 sm:p-5 flex items-center justify-between shadow-sm">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-indigo-700">Grand Total</span>
              <span className="text-xs text-indigo-600">Taxable Amount + Total Tax</span>
            </div>
            <div className="font-mono text-2xl font-extrabold text-indigo-950 sm:text-3xl">
              {formatCurrency(grandTotal, currency)}
            </div>
          </div>
        </div>
      </PageCard>

      {/* Authoritative Record — reassurance only, deliberately understated */}
      <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-600" />
        <p>
          <span className="font-semibold text-slate-700">Authoritative Financial Record.</span>{" "}
          Tax calculation amounts are generated by the backend tax engine and are read-only for this billing snapshot.
        </p>
      </div>
    </div>
  );
}
