import React, { useState, useMemo } from "react";
import { AlertTriangle, Inbox, Calendar, DollarSign, RefreshCw, CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import Button from "@/components/Button/Button";
import LoadingSpinner from "@/components/LoadingSpinner";
import GenericTable from "@/components/Table/table";
import Pagination from "@/components/Pagination/pagination";
import StatusBadge from "@/components/status/statusbadge";
import SearchInput from "@/components/filter/Searchbar";
import EmployeeLabel from "../../approval-engine/components/EmployeeLabel";
import { formatMoney, formatDate } from "../../approval-engine/constants/approvalLabels";
import { useApPaymentQueue } from "./hooks/useApPayments";
import { useMyHistory } from "../../approval-engine/hooks/useApprovalWorkflow";
import { expenseReportService } from "@/pages/expense-management/api/expenseReportsApi";
import ApPaymentReviewPanel from "./components/ApPaymentReviewPanel";

/**
 * AP Payments Dashboard - Surfaces finance-approved expense reports ready for payment.
 * Combines AP payment queue with approved history data so finance-approved reports always appear.
 */
export default function ApPaymentQueuePage() {
  const [page, setPage] = useState(0);
  const [reviewingReport, setReviewingReport] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const apQueueQuery = useApPaymentQueue(page, 20);
  const approvedHistoryQuery = useMyHistory("APPROVED", page, 20);
  const approvedReportsQuery = useQuery({
    queryKey: ["approvedExpenseReports", page],
    queryFn: () =>
      expenseReportService.getAll({ status: "APPROVED", page, size: 50 }).then((res) =>
        res?.data?.data !== undefined ? res.data.data : res?.data
      ),
    staleTime: 30_000,
  });

  const isLoading = apQueueQuery.isLoading || approvedHistoryQuery.isLoading || approvedReportsQuery.isLoading;
  const isError = apQueueQuery.isError && approvedHistoryQuery.isError && approvedReportsQuery.isError;

  const handleReload = () => {
    apQueueQuery.refetch();
    approvedHistoryQuery.refetch();
    approvedReportsQuery.refetch();
  };

  const items = useMemo(() => {
    const extractArray = (resData) => {
      if (!resData) return [];
      if (Array.isArray(resData)) return resData;
      if (Array.isArray(resData?.content)) return resData.content;
      if (Array.isArray(resData?.items)) return resData.items;
      if (Array.isArray(resData?.data)) return resData.data;
      if (Array.isArray(resData?.data?.content)) return resData.data.content;
      if (Array.isArray(resData?.reports)) return resData.reports;
      if (Array.isArray(resData?.expenseReports)) return resData.expenseReports;
      if (Array.isArray(resData?.result)) return resData.result;
      if (Array.isArray(resData?.records)) return resData.records;
      if (Array.isArray(resData?.list)) return resData.list;
      return [];
    };

    const resolveRoutingStatus = (item) => {
      const raw = item?.paymentRoutingStatus || item?.paymentStatus;
      if (!raw || raw === "NONE" || raw === "PENDING") return "APPROVED_FOR_PAYMENT";
      return raw;
    };

    const apItems = extractArray(apQueueQuery.data);
    const historyItems = extractArray(approvedHistoryQuery.data);
    const approvedItems = extractArray(approvedReportsQuery.data);

    const mergedMap = new Map();

    const isFullyApproved = (item) => {
      const status = (item?.reportStatus || item?.status || "").toUpperCase();
      const routingStatus = (item?.paymentRoutingStatus || item?.paymentStatus || "").toUpperCase();

      // Exclude reports that are not fully approved by Finance
      if (
        status === "PENDING_APPROVAL" ||
        status === "PENDING_FINANCE_VERIFICATION" ||
        status === "DRAFT" ||
        status === "SUBMITTED" ||
        status === "REJECTED" ||
        status === "CANCELLED" ||
        status === "AWAITING_CORRECTION" ||
        status === "QUERY_RAISED"
      ) {
        return false;
      }

      // Exclude already completed/paid items from the pending queue
      if (routingStatus === "PAYMENT_COMPLETED" || routingStatus === "COMPLETED" || routingStatus === "PAID") {
        return false;
      }

      // Include if reportStatus is APPROVED or routingStatus is APPROVED_FOR_PAYMENT
      return status === "APPROVED" || routingStatus === "APPROVED_FOR_PAYMENT";
    };

    apItems.forEach((item) => {
      const id = item?.reportId || item?.id;
      if (id && isFullyApproved(item)) {
        mergedMap.set(String(id), {
          ...item,
          reportId: id,
          reportNumber: item.reportNumber || item.reportId || item.id,
          reportStatus: item.reportStatus || item.status || "APPROVED",
          paymentRoutingStatus: resolveRoutingStatus(item),
        });
      }
    });

    historyItems.forEach((item) => {
      const id = item?.reportId || item?.id;
      if (id && !mergedMap.has(String(id)) && isFullyApproved(item)) {
        mergedMap.set(String(id), {
          ...item,
          reportId: id,
          reportNumber: item.reportNumber || item.reportId || item.id,
          reportStatus: item.reportStatus || item.status || "APPROVED",
          paymentRoutingStatus: resolveRoutingStatus(item),
        });
      }
    });

    approvedItems.forEach((item) => {
      const id = item?.reportId || item?.id;
      if (id && !mergedMap.has(String(id)) && isFullyApproved(item)) {
        mergedMap.set(String(id), {
          ...item,
          reportId: id,
          reportNumber: item.reportNumber || item.reportId || item.id,
          reportStatus: item.reportStatus || item.status || "APPROVED",
          paymentRoutingStatus: resolveRoutingStatus(item),
        });
      }
    });

    return Array.from(mergedMap.values());
  }, [apQueueQuery.data, approvedHistoryQuery.data, approvedReportsQuery.data]);

  const getItemTime = (item) => {
    const d = item?.approvedAt || item?.createdAt || item?.paymentDate || item?.submittedAt || item?.expenseDate || item?.date || "";
    if (!d) return 0;
    const t = new Date(d).getTime();
    return isNaN(t) ? 0 : t;
  };

  const sortedItems = useMemo(() => {
    const list = searchTerm
      ? items.filter((item) => {
          const q = searchTerm.toLowerCase();
          const reportNum = String(item.reportNumber || item.reportId || item.id || "").toLowerCase();
          const empId = String(item.employeeId || item.userId || item.submittedBy || "").toLowerCase();
          const title = String(item.title || item.businessPurpose || "").toLowerCase();
          return reportNum.includes(q) || empId.includes(q) || title.includes(q);
        })
      : items;

    return [...list].sort((a, b) => getItemTime(b) - getItemTime(a));
  }, [items, searchTerm]);

  const filteredItems = sortedItems;

  const ITEMS_PER_PAGE = 5;

  const totalAmountSum = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (Number(item.totalAmount ?? item.amount ?? item.total) || 0), 0);
  }, [filteredItems]);

  const primaryCurrency = filteredItems[0]?.currencyCode || filteredItems[0]?.currency || items[0]?.currencyCode || "INR";

  const allGroupedByDate = useMemo(() => {
    const groupsMap = {};
    filteredItems.forEach((item) => {
      const rawDate = item.approvedAt || item.createdAt || item.paymentDate || item.submittedAt || item.expenseDate || item.date || "";
      const dateLabel = rawDate ? formatDate(rawDate) : "Unscheduled Date";

      if (!groupsMap[dateLabel]) {
        groupsMap[dateLabel] = {
          dateLabel,
          rawDate,
          items: [],
          totalAmount: 0,
          currencyCode: item.currencyCode || item.currency || "INR",
        };
      }
      groupsMap[dateLabel].items.push(item);
      groupsMap[dateLabel].totalAmount += Number(item.totalAmount ?? item.amount ?? item.total) || 0;
    });

    return Object.values(groupsMap).sort((a, b) => {
      const timeA = a.rawDate ? getItemTime(a) : 0;
      const timeB = b.rawDate ? getItemTime(b) : 0;
      return timeB - timeA;
    });
  }, [filteredItems]);

  const totalPages = useMemo(() => {
    const clientPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const serverPages = Math.max(
      apQueueQuery.data?.totalPages || 1,
      approvedHistoryQuery.data?.totalPages || 1,
      approvedReportsQuery.data?.totalPages || 1
    );
    return Math.max(1, clientPages, serverPages);
  }, [filteredItems.length, apQueueQuery.data, approvedHistoryQuery.data, approvedReportsQuery.data]);

  const safePage = Math.min(page, totalPages - 1);

  const displayedItems = useMemo(() => {
    const start = safePage * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, safePage]);

  const groupedByDate = useMemo(() => {
    const groupsMap = {};
    displayedItems.forEach((item) => {
      const rawDate = item.approvedAt || item.createdAt || item.paymentDate || item.submittedAt || item.expenseDate || item.date || "";
      const dateLabel = rawDate ? formatDate(rawDate) : "Unscheduled Date";

      if (!groupsMap[dateLabel]) {
        groupsMap[dateLabel] = {
          dateLabel,
          rawDate,
          items: [],
          totalAmount: 0,
          currencyCode: item.currencyCode || item.currency || "INR",
        };
      }
      groupsMap[dateLabel].items.push(item);
      groupsMap[dateLabel].totalAmount += Number(item.totalAmount ?? item.amount ?? item.total) || 0;
    });

    const groups = Object.values(groupsMap);
    groups.forEach((g) => g.items.sort((a, b) => getItemTime(b) - getItemTime(a)));

    return groups.sort((a, b) => {
      const timeA = a.rawDate ? getItemTime(a) : 0;
      const timeB = b.rawDate ? getItemTime(b) : 0;
      return timeB - timeA;
    });
  }, [displayedItems]);

  return (
    <div className="p-4 sm:p-6 space-y-3">
      <Breadcrumb
        items={[
          { label: "Expense Management", to: "/expense-management/dashboard" },
          { label: "AP Payments" },
        ]}
      />

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[#0a174e]">AP Payments Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Review and process date-wise approved expense reimbursements.</p>
        </div>

        <button
          onClick={handleReload}
          title="Reload payment queue"
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-md transition self-start lg:self-auto"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <CreditCard size={18} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Pending Payments</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{filteredItems.length}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-green-50 text-green-600 rounded-lg">
            <DollarSign size={18} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Queue Value</p>
            <p className="text-xl font-bold text-green-600 mt-0.5">{formatMoney(totalAmountSum, primaryCurrency)}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Calendar size={18} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Payment Dates</p>
            <p className="text-xl font-bold text-indigo-600 mt-0.5">{allGroupedByDate.length} Date Groups</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="max-w-md">
          <label className="block text-xs font-medium text-gray-700 mb-1">Search Payments</label>
          <SearchInput
            value={searchTerm}
            onSearch={(val) => setSearchTerm(val || "")}
            placeholder="Search by report number or employee..."
            className="!py-1.5 !px-3 !text-xs"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <LoadingSpinner text="Loading payment queue…" />
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          <p className="text-sm text-rose-700">Failed to load the payment queue.</p>
          <Button size="small" variant="outline" onClick={handleReload}>Retry</Button>
        </div>
      )}

      {!isLoading && !isError && filteredItems.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Inbox className="h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">
            {searchTerm ? "No payments match the search criteria." : "No expenses pending payment right now."}
          </p>
          {!searchTerm && <p className="text-xs text-gray-400">Reports Finance has approved for payment will show up here.</p>}
        </div>
      )}

      {!isLoading && !isError && groupedByDate.length > 0 && (
        <div className="space-y-4">
          {groupedByDate.map((group) => (
            <div key={group.dateLabel} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-md">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900">{group.dateLabel}</h2>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {group.items.length} {group.items.length === 1 ? "payment" : "payments"}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Total for Date: <span className="font-semibold text-gray-900">{formatMoney(group.totalAmount, group.currencyCode)}</span>
                </div>
              </div>

              <div className="w-full overflow-x-auto rounded-lg">
                <GenericTable
                  headers={["Report", "Employee", "Approved Amount", "Currency", "Approved On", "Payment Status", "Action"]}
                  columns={["report", "employee", "amount", "currency", "approvedOn", "status", "action"]}
                  rows={group.items.map((item) => ({
                    report: item.reportNumber || item.reportId || item.id || "—",
                    employee: <EmployeeLabel employeeId={item.employeeId || item.userId || item.submittedBy} />,
                    amount: formatMoney(item.totalAmount ?? item.amount ?? item.total, item.currencyCode || item.currency),
                    currency: item.currencyCode || item.currency || "INR",
                    approvedOn: formatDate(item.approvedAt || item.createdAt || item.submittedAt || item.paymentDate),
                    status: (
                      <StatusBadge
                        label={!item.paymentRoutingStatus || item.paymentRoutingStatus === "NONE" ? "APPROVED_FOR_PAYMENT" : item.paymentRoutingStatus}
                        size="sm"
                      />
                    ),
                    action: (
                      <Button size="small" variant="outline" onClick={() => setReviewingReport(item)}>
                        Review
                      </Button>
                    ),
                  }))}
                />
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination
                currentPage={safePage + 1}
                totalPages={totalPages}
                onPrevious={() => setPage((p) => Math.max(p - 1, 0))}
                onNext={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
              />
            </div>
          )}
        </div>
      )}

      {reviewingReport && (
        <ApPaymentReviewPanel
          isOpen={reviewingReport != null}
          onClose={() => setReviewingReport(null)}
          reportId={reviewingReport.reportId || reviewingReport.id}
          queueItem={reviewingReport}
        />
      )}
    </div>
  );
}
