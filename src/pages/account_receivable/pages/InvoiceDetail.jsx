import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FileText,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  DollarSign,
  Clock,
  Briefcase,
  CheckCircle2,
} from "lucide-react";

import { PageCard, PageCardContent } from "../../../components/Cards/PageCard";
import Button from "../../../components/Button/Button";
import Loader from "../../../components/ui/Loader";
import StatusBadge from "../../../components/status/statusbadge";
import Breadcrumb from "../../../components/Breadcrumb/Breadcrumb";
import { showStatusToast } from "../../../components/toastfy/toast";
import { formatCurrency, formatDisplayDate } from "../utils/format";
import { getInvoice, getInvoiceErrorMessage } from "../services/invoiceService";
import { formatBillingPeriod } from "../services/billingDataAcquisitionService";

const TAX_WORKSPACE_PATH = "/account-receivable/tax-calculation";

const formatRatePercentage = (rate) => {
  if (rate === null || rate === undefined || rate === "") return null;
  const num = Number(rate);
  if (Number.isNaN(num)) return null;
  return `${num.toFixed(2)}%`;
};

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

function Field({ label, children, emptyLabel = "Not provided" }) {
  const content = children || emptyLabel;
  const isDefaultEmpty = !children || children === "—";
  return (
    <div>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span
        className={`mt-0.5 block truncate text-sm ${
          isDefaultEmpty ? "text-slate-400 italic" : "font-semibold text-slate-800"
        }`}
        title={typeof children === "string" ? children : undefined}
      >
        {content}
      </span>
    </div>
  );
}

export default function InvoiceDetail() {
  const { snapshotId } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadInvoice = async (isManual = false) => {
    if (!snapshotId) {
      setErrorMsg("No Billing Snapshot identifier provided.");
      setLoading(false);
      return;
    }

    if (isManual) setRefreshing(true);
    else setLoading(true);
    setErrorMsg("");

    try {
      const data = await getInvoice(snapshotId);
      if (data) {
        setInvoice(data);
        if (isManual) {
          showStatusToast("Invoice details refreshed.", "success");
        }
      } else {
        setErrorMsg("Invoice data could not be retrieved from the billing service.");
      }
    } catch (err) {
      console.error("[InvoiceDetail] Error loading invoice:", err);
      const msg = getInvoiceErrorMessage(err, "Failed to load invoice. Please verify that tax calculation was completed.");
      setErrorMsg(msg);
      showStatusToast(msg, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [snapshotId]);

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <Loader size="lg" text="Loading authoritative invoice details..." />
      </div>
    );
  }

  if (errorMsg && !invoice) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Breadcrumb
          items={[
            { label: "Billing Data Acquisition", to: "/account-receivable/billing-data-acquisition" },
            { label: "Tax Calculation", to: TAX_WORKSPACE_PATH },
            { label: "Invoice" },
          ]}
        />

        <PageCard>
          <PageCardContent className="p-10 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-slate-800">Invoice Unavailable</h3>
              <p className="text-sm text-slate-600">{errorMsg}</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-3">
              <Button
                variant="outline"
                size="small"
                onClick={() => navigate(TAX_WORKSPACE_PATH)}
                className="text-xs"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Tax Workspace
              </Button>
              {snapshotId && (
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => navigate(`/account-receivable/tax-calculation/${snapshotId}`)}
                  className="text-xs"
                >
                  Go to Tax Calculation
                </Button>
              )}
              <Button
                variant="primary"
                size="small"
                onClick={() => loadInvoice(true)}
                className="bg-[#0A0082] hover:bg-[#0A0082]/90 text-white text-xs font-semibold"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          </PageCardContent>
        </PageCard>
      </div>
    );
  }

  const currency = invoice?.currency || "USD";
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const taxBreakdown = Array.isArray(invoice?.taxBreakdown) ? invoice.taxBreakdown : [];

  // Actual snapshot billing period from backend data
  const billingPeriod =
    invoice?.billingPeriod ||
    (invoice?.billingPeriodStart && invoice?.billingPeriodEnd
      ? formatBillingPeriod(invoice.billingPeriodStart, invoice.billingPeriodEnd)
      : "—");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Billing Data Acquisition", to: "/account-receivable/billing-data-acquisition" },
          { label: "Tax Calculation", to: TAX_WORKSPACE_PATH },
          { label: "Invoice" },
          { label: invoice?.invoiceNumber || invoice?.snapshotNumber || snapshotId },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Invoice</h1>
            <StatusBadge label={invoice?.invoiceStatus || "GENERATED"} size="sm" />
          </div>
          <p className="text-sm text-slate-600">
            Invoice Number:{" "}
            <span className="ml-1 font-mono font-bold text-indigo-700">
              {invoice?.invoiceNumber || "—"}
            </span>
            {invoice?.snapshotNumber && (
              <>
                <span className="mx-2 text-slate-300">&middot;</span>
                <span className="text-xs text-slate-500">
                  Snapshot <span className="font-mono font-semibold text-slate-700">{invoice.snapshotNumber}</span>
                </span>
              </>
            )}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{invoice?.projectName || "Website Redesign"}</span>
            {invoice?.clientName && (
              <>
                <span className="mx-1.5 text-slate-300">&middot;</span>
                {invoice.clientName}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="small"
            onClick={() => navigate(TAX_WORKSPACE_PATH)}
            className="flex items-center gap-1.5 text-xs text-slate-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Tax Workspace
          </Button>

          {snapshotId && (
            <Button
              variant="outline"
              size="small"
              onClick={() => navigate(`/account-receivable/tax-calculation/${snapshotId}`)}
              className="flex items-center gap-1.5 text-xs text-slate-600"
            >
              Tax Calculation
            </Button>
          )}

          <Button
            variant="outline"
            size="small"
            onClick={() => loadInvoice(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Main Invoice Card */}
      <PageCard className="divide-y divide-slate-100">
        {/* Section 1: BILL TO */}
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Building2 className="h-3.5 w-3.5 text-indigo-600" /> Bill To
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Client Name">{invoice?.clientName}</Field>
            <Field label="Billing Address">{invoice?.billingAddress}</Field>
            <Field label="GSTIN / Tax ID">{invoice?.gstin}</Field>
            <Field label="Contact">{invoice?.contact}</Field>
          </div>
        </div>

        {/* Section 2: INVOICE CONTEXT */}
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Briefcase className="h-3.5 w-3.5 text-indigo-600" /> Invoice Context
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Field label="Project">
              {invoice?.projectName || "—"}
            </Field>
            <Field label="Project Code">
              <span className="font-mono">{invoice?.projectCode || "—"}</span>
            </Field>
            <Field label="Actual Billing Period">
              <span className="font-medium text-slate-900">{billingPeriod}</span>
            </Field>
            <Field label="Currency">
              <span className="font-mono font-bold text-slate-800">{currency}</span>
            </Field>
            <Field label="Payment Terms">
              {invoice?.paymentTerms || "Net 30"}
            </Field>
            <Field label="Invoice Date">
              {formatDisplayDate(invoice?.invoiceDate)}
            </Field>
            <Field label="Due Date">
              {formatDisplayDate(invoice?.dueDate)}
            </Field>
            <Field label="Snapshot Number">
              <span className="font-mono">{invoice?.snapshotNumber || "—"}</span>
            </Field>
            <Field label="Invoice Number">
              <span className="font-mono font-semibold text-indigo-800">{invoice?.invoiceNumber || "—"}</span>
            </Field>
          </div>
        </div>

        {/* Section 3: INVOICE ITEMS */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <FileText className="h-3.5 w-3.5 text-indigo-600" /> Invoice Items
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              {items.length} {items.length === 1 ? "Line Item" : "Line Items"}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-6 text-center text-xs text-slate-500">
              No individual invoice items returned by the backend.
            </div>
          ) : (
            <>
              {/* Desktop / Tablet Table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-2 pr-3 font-bold">Resource / Item</th>
                      <th className="pb-2 px-3 font-bold">Role</th>
                      <th className="pb-2 px-3 font-bold">Work Date</th>
                      <th className="pb-2 px-3 text-right font-bold">Quantity / Hours</th>
                      <th className="pb-2 px-3 text-right font-bold">Rate</th>
                      <th className="pb-2 pl-3 text-right font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-3 pr-3 align-top font-semibold text-slate-800">
                          {it.itemName || it.item || "—"}
                        </td>
                        <td className="py-3 px-3 align-top text-slate-600">
                          {it.role}
                        </td>
                        <td className="py-3 px-3 align-top font-mono text-xs text-slate-600">
                          {formatDisplayDate(it.workDate)}
                        </td>
                        <td className="py-3 px-3 align-top text-right font-mono font-medium text-slate-700">
                          {it.quantity}
                        </td>
                        <td className="py-3 px-3 align-top text-right font-mono font-medium text-slate-700">
                          {formatCurrency(it.rate, currency)}
                        </td>
                        <td className="py-3 pl-3 align-top text-right font-mono font-bold text-slate-900">
                          {formatCurrency(it.amount, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards */}
              <div className="space-y-2.5 sm:hidden">
                {items.map((it) => (
                  <div key={it.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-800">{it.itemName || it.item || "—"}</span>
                      <span className="shrink-0 font-mono font-bold text-slate-900">
                        {formatCurrency(it.amount, currency)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{it.role}</span>
                      <span>&middot;</span>
                      <span className="font-mono">{formatDisplayDate(it.workDate)}</span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-200 pt-2 text-xs text-slate-600">
                      <span>
                        {it.quantity} hrs @ {formatCurrency(it.rate, currency)}
                      </span>
                      <span className="font-mono font-semibold text-slate-800">
                        {formatCurrency(it.amount, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Section 4: TAX BREAKDOWN */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Layers className="h-3.5 w-3.5 text-indigo-600" /> Tax Breakdown
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              {taxBreakdown.length} {taxBreakdown.length === 1 ? "Component" : "Components"}
            </span>
          </div>

          {taxBreakdown.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
              No tax components applicable for this invoice.
            </div>
          ) : (
            <>
              {/* Desktop / Tablet Table */}
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
                    {taxBreakdown.map((comp) => (
                      <tr key={comp.id}>
                        <td className="py-3 pr-3 align-top font-semibold text-slate-800">
                          {comp.taxComponent}
                          {comp.taxTypeCode && (
                            <span className="ml-2 inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                              {comp.taxTypeCode}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top text-slate-600">
                          {humanizeApplicability(comp.applicability)}
                        </td>
                        <td className="py-3 px-3 align-top text-right font-mono font-semibold text-slate-700">
                          {formatRatePercentage(comp.rate) ?? "—"}
                        </td>
                        <td className="py-3 pl-3 align-top text-right font-mono font-bold text-slate-900">
                          {formatCurrency(comp.amount, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards */}
              <div className="space-y-2.5 sm:hidden">
                {taxBreakdown.map((comp) => (
                  <div key={comp.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-800">{comp.taxComponent}</span>
                      {comp.taxTypeCode && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                          {comp.taxTypeCode}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {humanizeApplicability(comp.applicability)}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-200 pt-2.5">
                      <span className="text-xs text-slate-500">Rate</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {formatRatePercentage(comp.rate) ?? "—"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Amount</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(comp.amount, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Section 5: FINANCIAL SUMMARY */}
        <div className="p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Financial Summary</h2>
          <div className="max-w-md space-y-2 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono font-semibold text-slate-800">
                {formatCurrency(invoice?.subtotal, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Total Tax</span>
              <span className="font-mono font-semibold text-slate-800">
                {formatCurrency(invoice?.totalTax, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
              <span>Grand Total</span>
              <span className="font-mono text-base text-indigo-900">
                {formatCurrency(invoice?.grandTotal, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Grand Total Hero Display */}
        <div className="p-5">
          <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/80 p-4 sm:p-5 flex items-center justify-between shadow-sm">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-indigo-700">Grand Total</span>
              <span className="text-xs text-indigo-600">Subtotal + Total Tax (Backend Authoritative)</span>
            </div>
            <div className="font-mono text-2xl font-extrabold text-indigo-950 sm:text-3xl">
              {formatCurrency(invoice?.grandTotal, currency)}
            </div>
          </div>
        </div>
      </PageCard>

      {/* Authoritative Record Notice */}
      <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-600" />
        <p>
          <span className="font-semibold text-slate-700">Authoritative Financial Record.</span>{" "}
          Invoice amounts and tax breakdowns are generated by the backend financial engine and are read-only for this billing snapshot.
        </p>
      </div>
    </div>
  );
}
