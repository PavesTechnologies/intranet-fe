import React, { useEffect, useState, useRef } from "react";
import ManagerApprovalTable from "./ManagerApprovalTable";
import Button from "../../../components/Button/Button";
import FilterListbox from "../../../components/filter/FilterListbox";
import ManagerDashboard from "../ManagerDashboard";
import TimesheetHeader from "../TimesheetHeader";
import { getManagerDashboardData } from "../api";
import { useMemo } from "react";
import LoadingSpinner from "../../../components/LoadingSpinner";
import api from "../../../api/axiosInstance";
import useMonthScope from "../components/useMonthScope";
import MonthScopeSelect from "../components/MonthScopeSelect";

const ManagerApprovalPage = () => {
  const [groupedTimesheets, setGroupedTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // ✅ Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All Users");

  // Month scope — current or previous month. Deliberately NOT cleared by the
  // Reset button below: it is a scope, not a filter.
  const {
    month,
    year,
    startDate: monthStartDate,
    endDate: monthEndDate,
    label: monthLabel,
    monthKey,
    setMonthKey,
    options: monthOptions,
  } = useMonthScope();

  const entriesTableRef = useRef(null);

  const handleScroll = () => {
    entriesTableRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ✅ Fetch Timesheets
  const fetchGroupedTimesheets = async () => {
    setLoading(true);
    try {
      const response = await api.get(
        `${window.__APP_CONFIG__.TIMESHEET_API_ENDPOINT}/api/timesheets/manager`,
        { params: { month, year } },
      );

      setGroupedTimesheets(
        Array.isArray(response.data) ? response.data : [],
      );
    } catch (error) {
      console.error("Error fetching timesheets:", error);
      setGroupedTimesheets([]);
    } finally {
      setLoading(false);
    }
  };
  const fetchDashboardData = async () => {
    setLoadingDashboard(true);
    try {
      // Scoped to the selected month so the summary above matches the queue below.
      const data = await getManagerDashboardData(monthStartDate, monthEndDate);
      setDashboardData(data);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Re-fetches the queue whenever the month scope changes (and on mount).
  useEffect(() => {
    fetchGroupedTimesheets();
  }, [monthKey]);

  // Kept separate from the queue fetch so one failing does not blank the other, but it
  // follows the same month scope.
  useEffect(() => {
    fetchDashboardData();
  }, [monthKey]);

  // ✅ Apply filters for deeply nested structureimport { useMemo } from "react";

  // ✅ Shared predicate: does a user pass the active filters?
  //    `applyUserFilter` is skipped when building the user dropdown, so the
  //    dropdown lists every user visible in the table (not the full user list).
  const passesFilters = (user, applyUserFilter) => {
    // 🔹 0️⃣ Hide users with no actionable weeks — every week is APPROVED
    const hasActionableWeek = user.weeklySummary?.some(
      (w) => w.weeklyStatus?.toUpperCase() !== "APPROVED",
    );
    if (!hasActionableWeek) return false;

    // 🔹 1️⃣ User Filter — show all users if "All Users" selected
    if (
      applyUserFilter &&
      userFilter &&
      userFilter !== "All Users" &&
      user.userName.trim().toLowerCase() !== userFilter.trim().toLowerCase()
    ) {
      return false;
    }

    // 🔹 2️⃣ Search Filter — search across username and nested entries
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();

      const userMatch = user.userName.toLowerCase().includes(lowerSearch);

      const nestedMatch = user.weeklySummary?.some((week) =>
        week.timesheets?.some((ts) =>
          ts.entries?.some(
            (entry) =>
              entry.description?.toLowerCase().includes(lowerSearch) ||
              entry.otherDescription?.toLowerCase().includes(lowerSearch) ||
              entry.workLocation?.toLowerCase().includes(lowerSearch) ||
              entry.projectName?.toLowerCase().includes(lowerSearch) ||
              entry.taskName?.toLowerCase().includes(lowerSearch),
          ),
        ),
      );

      if (!userMatch && !nestedMatch) return false;
    }

    // 🔹 3️⃣ Date Filter — match selected date exactly
    if (selectedDate) {
      const hasDate = user.weeklySummary?.some((week) =>
        week.timesheets?.some((ts) => ts.workDate === selectedDate),
      );
      if (!hasDate) return false;
    }

    // 🔹 4️⃣ Status Filter — match weekly or timesheet statuses
    if (statusFilter !== "All") {
      const hasStatus = user.weeklySummary?.some(
        (week) =>
          week.weeklyStatus?.toLowerCase() === statusFilter.toLowerCase() ||
          week.timesheets?.some(
            (ts) =>
              ts.status?.toLowerCase() === statusFilter.toLowerCase() ||
              ts.actionStatus?.some(
                (a) => a.status?.toLowerCase() === statusFilter.toLowerCase(),
              ),
          ),
      );
      if (!hasStatus) return false;
    }

    return true; // ✅ include this user
  };

  const filteredTimesheets = useMemo(() => {
    if (!groupedTimesheets.length) return [];
    return groupedTimesheets.filter((user) => passesFilters(user, true));
  }, [statusFilter, userFilter, selectedDate, searchTerm, groupedTimesheets]);

  // ✅ User dropdown options — only users actually shown in the table below.
  const userOptions = useMemo(() => {
    const names = groupedTimesheets
      .filter((user) => passesFilters(user, false))
      .map((user) => user.userName?.trim());
    return [...new Set(names)].filter(Boolean);
  }, [statusFilter, selectedDate, searchTerm, groupedTimesheets]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedDate("");
    setUserFilter("All Users");
    setStatusFilter("All");

    // Smoothly scroll down to the timesheet table after resetting filters
    if (entriesTableRef.current) {
      entriesTableRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // ✅ Add this function inside ManagerApprovalPage component, before return()
  const handleTableRefresh = async () => {
    // Month-aware without any argument: fetchGroupedTimesheets is re-created each
    // render, so it closes over the currently selected month/year.
    fetchGroupedTimesheets(); // refresh approval table
    fetchDashboardData(); // refresh dashboard summary
  };

  if (loading && loadingDashboard) {
    return (
      <div className="flex justify-center mt-10">
        <LoadingSpinner text="Loading Manager View..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <TimesheetHeader
        rightSlot={
          <MonthScopeSelect
            options={monthOptions}
            value={monthKey}
            onChange={setMonthKey}
            disabled={loading}
          />
        }
      />
      <ManagerDashboard
        data={dashboardData}
        loading={loadingDashboard}
        setStatusFilter={setStatusFilter}
        handleScroll={handleScroll}
        periodLabel={
          monthKey === monthOptions[0].value ? "Last 15 days" : monthLabel
        }
      />
      {!loadingDashboard && !dashboardData && (
        <div className="text-center text-red-600 my-4">
          Failed to load dashboard summary. Please refresh the page.
        </div>
      )}

      {/* ✅ Filter Header */}
      {/* <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by user,description,location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[220px] px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 placeholder-gray-400"
        />

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
        />

        <FilterListbox
          options={[
            { value: "All", label: "All" },
            { value: "Submitted", label: "Submitted" },
            { value: "Approved", label: "Approved" },
            { value: "Rejected", label: "Rejected" },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />

        <FilterListbox
          options={[
            { value: "All Users", label: "All Users" },
            ...[...new Set(groupedTimesheets.map((item) => item.userName?.trim()))].filter(Boolean).map((user) => ({ value: user, label: user })),
          ]}
          value={userFilter}
          onChange={setUserFilter}
        />

        <Button
          variant="destructive"
          size="medium"
          onClick={handleResetFilters}
        // className="bg-red-500 hover:bg-red-600 text-white font-medium px-5 py-2.5 rounded-full transition-colors"
        >
          Reset
        </Button>
      </div> */}
      <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-row flex-nowrap items-center gap-3 mb-6">
        {/* Search - Flexible but with a healthy minimum */}
        <input
          type="text"
          placeholder="Search by user, description, location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[280px] px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 placeholder-gray-400"
        />

        {/* Date - Fixed width to prevent squishing */}
        <div className="shrink-0">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
          />
        </div>

        {/* Status Dropdown - Wider for clarity */}
        <div className="shrink-0 min-w-[120px]">
          <FilterListbox
            options={[
              { value: "All", label: "All Statuses" },
              { value: "Submitted", label: "Submitted" },
              { value: "Approved", label: "Approved" },
              { value: "Rejected", label: "Rejected" },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {/* User Dropdown - Even wider for long names */}
        <div className="shrink-0 min-w-[150px]">
          <FilterListbox
            options={[
              { value: "All Users", label: "All Users" },
              ...userOptions.map((user) => ({ value: user, label: user })),
            ]}
            value={userFilter}
            onChange={setUserFilter}
          />
        </div>

        {/* Reset Button */}
        <div className="shrink-0">
          <Button
            variant="destructive"
            size="medium"
            onClick={handleResetFilters}
            className="whitespace-nowrap"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* ✅ Timesheet Table */}
      <ManagerApprovalTable
        loading={loading}
        groupedData={filteredTimesheets}
        statusFilter={statusFilter}
        ref={entriesTableRef}
        onRefresh={handleTableRefresh}
        emptyMessage={
          groupedTimesheets.length === 0
            ? `No timesheets were submitted for ${monthLabel}.`
            : `Every timesheet for ${monthLabel} has already been approved.`
        }
      />
    </div>
  );
};

export default ManagerApprovalPage;
