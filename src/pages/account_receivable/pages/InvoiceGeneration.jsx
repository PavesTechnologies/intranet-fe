import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  RefreshCw,
  Search,
  CheckCircle2,
  Layers,
  DollarSign,
  Filter,
  Eye,
  ArrowRight,
} from "lucide-react";

import PageHeader from "../../../components/ui/PageHeader";
import { PageCard, PageCardContent } from "../../../components/Cards/PageCard";
import Button from "../../../components/Button/Button";
import Loader from "../../../components/ui/Loader";
import StatusBadge from "../../../components/status/statusbadge";
import { showStatusToast } from "../../../components/toastfy/toast";
import ARTable from "../components/common/ARTable";
import { formatCurrency, formatDisplayDate } from "../utils/format";
import { getInvoices, getInvoiceErrorMessage } from "../services/invoiceService";

const TAX_WORKSPACE_PATH = "/account-receivable/tax-calculation";

export default function InvoiceGeneration() {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [backendSummary, setBackendSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setLoading(true);
    setError(null);

    try {
      const { invoices: fetchedInvoices, summary } = await getInvoices();
      setInvoices(fetchedInvoices || []);
      setBackendSummary(summary || null);

      if (isManualRefresh) {
        showStatusToast("Invoice generation queue refreshed.", "success");
      }
    } catch (err) {
      console.error("[InvoiceGeneration] Error loading invoices:", err);
      const message = getInvoiceErrorMessage(err, "Failed to load invoices.");
      setError(message);
      showStatusToast(message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const st = (inv.invoiceStatus || "").toUpperCase();

      // Status filter
      if (statusFilter === "GENERATED") {
        if (st !== "GENERATED") return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (inv.invoiceNumber || "").toLowerCase();
        const client = (inv.clientName || "").toLowerCase();
        const project = (inv.projectName || "").toLowerCase();
        const snapNum = (inv.snapshotNumber || "").toLowerCase();

        const matches =
          num.includes(q) ||
          client.includes(q) ||
          project.includes(q) ||
          snapNum.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  // Invoice KPIs: If backend provided summary, use it. Otherwise compute list-level display metrics.
  const kpis = useMemo(() => {
    if (backendSummary) {
      return {
        totalInvoices: backendSummary.totalInvoices ?? invoices.length,
        generatedInvoices: backendSummary.generatedInvoices ?? invoices.filter((i) => (i.invoiceStatus || "").toUpperCase() === "GENERATED").length,
        totalInvoicedAmount: backendSummary.totalInvoicedAmount ?? 0,
        currency: backendSummary.currency || invoices[0]?.currency || "USD",
      };
    }

    const totalInvoices = invoices.length;
    const generatedInvoices = invoices.filter(
      (inv) => (inv.invoiceStatus || "").toUpperCase() === "GENERATED"
    ).length;

    // Use backend-authoritative grandTotal values directly from returned records
    const totalInvoicedAmount = invoices.reduce(
      (sum, inv) => sum + (Number(inv.grandTotal) || 0),
      0
    );

    const primaryCurrency = invoices[0]?.currency || "USD";

    return {
      totalInvoices,
      generatedInvoices,
      totalInvoicedAmount,
      currency: primaryCurrency,
    };
  }, [invoices, backendSummary]);

  const handleViewInvoice = (inv) => {
    const targetSnapshotId = inv.billingSnapshotId || inv.snapshotId;
    if (!targetSnapshotId) {
      showStatusToast("Snapshot identifier is missing for this invoice.", "error");
      return;
    }
    navigate(`/account-receivable/invoices/${targetSnapshotId}`);
  };

  if (loading && !refreshing) {
    return (
      <div className="flex h-80 items-center justify-center">
        <Loader size="lg" text="Loading Invoice Generation Workspace..." />
      </div>
    );
  }

  // Error State: Display proper enterprise error card with Retry
  if (error && !loading && invoices.length === 0) {
    return (
      <div className="w-full space-y-6">
        <PageHeader
          title="Invoice Generation"
          subtitle="Workspace containing generated invoices created from completed tax calculations."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Retry
            </Button>
          }
        />

        <PageCard>
          <PageCardContent className="p-12 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
              <FileText className="h-8 w-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-slate-800">
                Failed to Load Invoices
              </h3>
              <p className="text-sm text-red-600">
                {error}
              </p>
            </div>
            <div className="pt-3">
              <Button
                onClick={() => loadData(true)}
                className="bg-[#0A0082] text-white hover:bg-[#0A0082]/90 font-semibold px-6 py-2.5"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </PageCardContent>
        </PageCard>
      </div>
    );
  }

  // Enterprise Empty State when no invoices generated yet
  if (!loading && invoices.length === 0) {
    return (
      <div className="w-full space-y-6">
        <PageHeader
          title="Invoice Generation"
          subtitle="Workspace containing generated invoices created from completed tax calculations."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          }
        />

        <PageCard>
          <PageCardContent className="p-12 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <FileText className="h-8 w-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-slate-800">
                No invoices generated yet
              </h3>
              <p className="text-sm text-slate-500">
                Complete a tax calculation and generate an invoice to see it here.
              </p>
            </div>
            <div className="pt-3">
              <Button
                onClick={() => navigate(TAX_WORKSPACE_PATH)}
                className="bg-[#0A0082] text-white hover:bg-[#0A0082]/90 font-semibold px-6 py-2.5"
              >
                Go to Tax Calculation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </PageCardContent>
        </PageCard>
      </div>
    );
  }

  const tableHeaders = [
    "Invoice Number",
    "Client",
    "Project",
    "Billing Period",
    "Invoice Date",
    "Due Date",
    "Currency",
    "Grand Total",
    "Status",
    "Action",
  ];

  const tableColumns = [
    "invoiceNumber",
    "client",
    "project",
    "billingPeriod",
    "invoiceDate",
    "dueDate",
    "currency",
    "grandTotal",
    "status",
    "action",
  ];

  const tableRows = filteredInvoices.map((item) => ({
    onRowClick: () => handleViewInvoice(item),
    invoiceNumber: (
      <div className="text-left">
        <span className="font-mono font-bold text-indigo-700">
          {item.invoiceNumber || "—"}
        </span>
        {item.snapshotNumber && (
          <div className="text-xs font-mono text-slate-400">
            {item.snapshotNumber}
          </div>
        )}
      </div>
    ),
    client: (
      <span className="font-semibold text-slate-800">
        {item.clientName || "Account Management"}
      </span>
    ),
    project: (
      <div className="text-left">
        <div className="font-bold text-slate-900">
          {item.projectName || "Website Redesign"}
        </div>
        {item.projectCode && (
          <div className="text-xs font-mono text-slate-400">
            {item.projectCode}
          </div>
        )}
      </div>
    ),
    billingPeriod: (
      <span className="font-medium text-slate-700">
        {item.billingPeriod || "—"}
      </span>
    ),
    invoiceDate: (
      <span className="font-medium text-slate-700">
        {item.invoiceDate ? formatDisplayDate(item.invoiceDate) : "—"}
      </span>
    ),
    dueDate: (
      <span className="font-medium text-slate-700">
        {item.dueDate ? formatDisplayDate(item.dueDate) : "—"}
      </span>
    ),
    currency: (
      <span className="font-semibold text-slate-700">
        {item.currency || "USD"}
      </span>
    ),
    grandTotal: (
      <span className="font-mono font-bold text-slate-900">
        {formatCurrency(item.grandTotal || 0, item.currency || "USD")}
      </span>
    ),
    status: (
      <StatusBadge
        label={item.invoiceStatus || "GENERATED"}
        size="sm"
      />
    ),
    action: (
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          handleViewInvoice(item);
        }}
        className="text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold"
      >
        <Eye className="mr-1.5 h-3.5 w-3.5" />
        View Invoice
      </Button>
    ),
  }));

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Invoice Generation"
        subtitle="Workspace containing generated invoices created from completed tax calculations."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      {/* KPI Section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total Invoices
            </span>
            <Layers className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            {kpis.totalInvoices}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Generated Invoices
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-900">
            {kpis.generatedInvoices}
          </div>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Invoiced Amount
            </span>
            <DollarSign className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-950 font-mono">
            {formatCurrency(kpis.totalInvoicedAmount, kpis.currency)}
          </div>
        </div>
      </div>

      {/* Controls & Invoice Table */}
      <PageCard>
        <PageCardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by invoice number, project, client, or snapshot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Filter className="h-3.5 w-3.5" /> Status:
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="GENERATED">Invoice Generated</option>
              </select>
            </div>
          </div>

          <ARTable
            headers={tableHeaders}
            columns={tableColumns}
            rows={tableRows}
            emptyMessage="No invoices match your search or filter."
          />
        </PageCardContent>
      </PageCard>
    </div>
  );
}
