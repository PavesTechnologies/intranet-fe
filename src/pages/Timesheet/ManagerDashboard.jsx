import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import LoadingSpinner from "../../components/LoadingSpinner";
import { showStatusToast } from "../../components/toastfy/toast";
import api from "../../api/axiosInstance";

// `periodLabel` names the month the summary covers. Defaulted so the other consumers
// of this component render exactly as before.
const ManagerDashboard = ({
  data,
  loading,
  setStatusFilter,
  handleScroll,
  periodLabel = "Last 15 days",
}) => {
  const [stats, setStats] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [reminding, setReminding] = useState(false);

  // Map server weekday names to short labels
  const dayMap = {
    MONDAY: "Mon",
    TUESDAY: "Tue",
    WEDNESDAY: "Wed",
    THURSDAY: "Thu",
    FRIDAY: "Fri",
    SATURDAY: "Sat",
    SUNDAY: "Sun",
  };

  useEffect(() => {
    if (!data) return;
    setStats({
      hoursLogged: data.totalHours,
      billableUtilization: data.billablePercentage,
      missingTimesheets: data.missingTimesheets || [],
      pending: data.pending,
    });

    const summary = data.weeklySummary || {};
    const formattedWeekly = Object.entries(summary).map(([day, hours]) => ({
      day: dayMap[day] || day,
      hours,
      utilization: data.billablePercentage,
    }));

    setWeeklyData(formattedWeekly);
  }, [data]);

  if (loading) {
    return <LoadingSpinner text="Loading manager dashboard..." />;
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load dashboard data.
      </div>
    );
  }
  // ✅ NEW: Handle "Remind" button click
  const handleRemind = async () => {
    if (!stats || stats.missingTimesheets.length === 0) {
      showStatusToast("No users to remind 🎉", "info");
      return;
    }

    const emails = stats.missingTimesheets.map((u) => u.email);

    setReminding(true);
    try {
      // ✅ FIXED URL: removed extra brace and ensured correct base URL usage
      await api.post(
        `${
          window.__APP_CONFIG__.TIMESHEET_API_ENDPOINT
        }/api/timesheet/send_reminder`,
        emails,
      );

      showStatusToast(
        `Reminder emails sent to ${emails.length} users successfully!`,
        "success",
      );
    } catch (error) {
      const respData = error.response?.data;
      if (respData !== undefined) {
        const errMsg = typeof respData === "string" ? respData : respData?.message || "";
        showStatusToast(
          `Failed to send reminders. Server response: ${errMsg}`,
          "error",
        );
      } else {
        showStatusToast(`Failed to send reminders. Please try again.`, "error");
      }
    } finally {
      setReminding(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50">
      {/* Top Section: Stats then chart */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Stats */}
        <div className="flex flex-col gap-6 lg:w-1/3">
          {/* Hours logged */}
          <div className="bg-white shadow-lg rounded-2xl p-12">
            <h2 className="text-lg font-semibold text-gray-700">
              Hours logged by team
            </h2>
            <p className="text-2xl font-bold text-indigo-600 mt-2">
              {stats.hoursLogged ?? 0} hrs
            </p>
          </div>
          {/* Billable utilization */}
          <div className="bg-white shadow-lg rounded-2xl p-12">
            <h2 className="text-lg font-semibold text-gray-700">
              Billable utilization %
            </h2>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {stats.billableUtilization ?? 0}%
            </p>
            <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
              <div
                className="bg-green-600 h-3 rounded-full"
                style={{ width: `${stats.billableUtilization}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Right: Productivity Trend */}
        <div className="bg-white shadow-lg rounded-2xl p-5 flex-1">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Weekly hours logged by team
          </h2>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={weeklyData}
                margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              >
                <XAxis dataKey="day" stroke="#b0b6c1" />
                <YAxis stroke="#b0b6c1" />
                <Tooltip
                  contentStyle={{
                    background: "#23272f",
                    border: "none",
                    color: "#fff",
                  }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#38bdf8" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="#4F46E5"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center mt-4">
              No weekly data available yet.
            </p>
          )}
        </div>
      </div>

      {/* Bottom Section: Missing Timesheets + Pending Approvals side by side
       <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: Missing Timesheets */}
      <div className="bg-white shadow-lg rounded-2xl p-8 flex-1">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-700">
            Missing timesheets for {periodLabel}
          </h2>
          <button
            onClick={handleRemind}
            disabled={reminding}
            className={`${
              reminding
                ? "bg-orange-300 cursor-not-allowed"
                : "bg-orange-400 hover:bg-orange-500"
            } text-white px-4 py-2 rounded-lg shadow`}
          >
            {reminding ? "Sending..." : "Remind"}
          </button>
        </div>
        {stats.missingTimesheets.length > 0 ? (
          <div>
            <ul className="list-disc list-inside text-gray-600 overflow-y-scroll max-h-30">
              {stats.missingTimesheets.map((user, idx) => (
                <li key={idx}>
                  <span title={user.email} className="font-medium">
                    {user.fullName} - {user.email}
                  </span>
                  {/* <span className="text-sm text-gray-500">({user.email})</span> */}
                </li>
              ))}
            </ul>
            <div className="text-gray-500 font-semibold text-xs mt-2 italic">
              <span className="text-red-600">*</span> If the date is before the
              15th, use 1st of month. If on/after the 15th, use the last 15
              days.
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            No missing timesheets today 🎉
          </p>
        )}
      </div>
      {/* Right: Pending Approvals */}
      {/* <div className="bg-white shadow-lg items-center rounded-2xl p-8 flex-1">
        <div className="flex justify-between items-center mb-4 ">
          <h2 className="text-lg font-semibold text-gray-700 ">
            Pending Approvals
          </h2>
          <button
            onClick={() => {
              setStatusFilter("Submitted");
              handleScroll();
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow"
          >
            View
          </button>
        </div>
        <span>
          <p className=" justify-center text-2xl font-bold text-blue-800 mt-4">
            {stats.pending} Weeks
          </p>
        </span>
      </div> */}
    </div>
  );
};

export default ManagerDashboard;
