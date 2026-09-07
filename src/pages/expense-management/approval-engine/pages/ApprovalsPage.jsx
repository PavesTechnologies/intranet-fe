import React, { useState } from "react";
import { Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import PendingApprovalsPage from "./PendingApprovalsPage";
import ApprovalHistoryPage from "./ApprovalHistoryPage";
import { useMyQueue, useMyHistory } from "../hooks/useApprovalWorkflow";
import SearchInput from "@/components/filter/Searchbar";
import FormSelect from "@/components/forms/FormSelect";

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "approved" | "rejected"
  const [reloadKey, setReloadKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const breadcrumbs = [
    { label: "Expense Management", to: "/expense-management/dashboard" },
    { label: "Approvals" },
  ];

  // Fetch counts/stats for approvals (each page query is limited to size=1 for performance)
  const queueQuery = useMyQueue(0, 1);
  const approvedQuery = useMyHistory("APPROVED", 0, 1);
  const rejectedQuery = useMyHistory("REJECTED", 0, 1);

  const pendingCount = queueQuery.data?.totalElements ?? queueQuery.data?.content?.length ?? 0;
  const approvedCount = approvedQuery.data?.totalElements ?? approvedQuery.data?.content?.length ?? 0;
  const rejectedCount = rejectedQuery.data?.totalElements ?? rejectedQuery.data?.content?.length ?? 0;

  const handleReload = () => {
    setReloadKey((prev) => prev + 1);
    queueQuery.refetch();
    approvedQuery.refetch();
    rejectedQuery.refetch();
  };

  const handleSearch = (value) => {
    setSearchTerm(value || "");
  };

  const statusFilterOptions = [
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];

  return (
    <div className="space-y-3 p-4 sm:p-6">
      {/* Scope custom styles to hide child component breadcrumbs & headers, and remove child outer padding */}
      <style>{`
        .approvals-tab-container nav[aria-label="Breadcrumb"] {
          display: none !important;
        }
        .approvals-tab-container h1 {
          display: none !important;
        }
        .approvals-tab-container > div {
          padding: 0 !important;
        }
      `}</style>

      <Breadcrumb items={breadcrumbs} />

      {/* Dashboard-style Page Header Card */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[#0a174e]">My Approvals</h1>
          <p className="text-xs text-gray-500 mt-0.5">Review and manage expense report approval requests.</p>
        </div>

        <button
          onClick={handleReload}
          title="Reload current tab data"
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-md transition self-start lg:self-auto animate-none"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Pending Approvals</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{pendingCount}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-green-50 text-green-600 rounded-lg">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Approved Approvals</p>
            <p className="text-xl font-bold text-green-600 mt-0.5">{approvedCount}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <XCircle size={18} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Rejected Approvals</p>
            <p className="text-xl font-bold text-rose-600 mt-0.5">{rejectedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <SearchInput
              value={searchTerm}
              onSearch={handleSearch}
              placeholder="Search by report number or merchant/category..."
              className="!py-1.5 !px-3 !text-xs"
            />
          </div>
          <FormSelect
            label="Status"
            name="activeTab"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            options={statusFilterOptions}
            className="[&>label]:text-xs [&>label]:mb-1"
            buttonClassName="!py-1.5 !px-3 !text-xs"
          />
        </div>
      </div>

      {/* Tab Content container */}
      <div className="approvals-tab-container">
        {activeTab === "pending" ? (
          <PendingApprovalsPage key={`pending-${reloadKey}`} searchTerm={searchTerm} />
        ) : activeTab === "approved" ? (
          <ApprovalHistoryPage key={`approved-${reloadKey}`} outcome="APPROVED" title="Approved" breadcrumbLabel="Approved" searchTerm={searchTerm} />
        ) : (
          <ApprovalHistoryPage key={`rejected-${reloadKey}`} outcome="REJECTED" title="Rejected" breadcrumbLabel="Rejected" searchTerm={searchTerm} />
        )}
      </div>
    </div>
  );
}
