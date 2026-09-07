// utils/timesheetApi.js
import { showStatusToast } from "../../components/toastfy/toast";
import api from "../../api/axiosInstance";

const apiEndpoint = window.__APP_CONFIG__.TIMESHEET_API_ENDPOINT;

export const fetchProjectTaskInfo = async () => {
  try {
    const response = await api.get(`${apiEndpoint}/api/project-info`);
    return response.data;
  } catch (error) {
    showStatusToast({
      type: "error",
      message: "Failed to fetch project/task info. Please try again.",
    });
    console.error("Fetch error:", error);
    return [];
  }
};

export const reviewTimesheet = async (timesheetId, comment, status) => {
  try {
    await api.put(
      `${apiEndpoint}/api/timesheets/review?status=${encodeURIComponent(
        status,
      )}`,
      {
        timesheetId,
        comment: comment,
      },
    );

    showStatusToast(`Timesheet ${status} successfully`, "success");
    return;
  } catch (err) {
    showStatusToast("Update failed", "error");
    throw err;
  }
};

export async function updateTimesheet(timesheetId, payload) {
  try {
    const response = await api.put(
      `${apiEndpoint}/api/timesheet/updateEntries/${timesheetId}`,
      payload,
    );

    const responseData = response.data;
    const message =
      typeof responseData === "string"
        ? responseData
        : responseData?.message || "Timesheet updated successfully.";
    showStatusToast(message, "success");
    return responseData;
  } catch (err) {
    // ❌ Server error response (4xx/5xx) — preserve original error toast text
    if (err.response) {
      const responseData = err.response.data;
      const errorMessage =
        typeof responseData === "string"
          ? responseData
          : responseData?.message || "Failed to update timesheet.";
      showStatusToast(errorMessage, "error");
      throw new Error(errorMessage);
    }
    // 🧠 Network / unexpected errors
    const message = err.message || "Unexpected error while updating timesheet.";
    showStatusToast(message, "error");
    throw err;
  }
}

export async function fetchTimesheetHistory() {
  try {
    const res = await api.get(`${apiEndpoint}/api/timesheet/history`);
    return res.data;
  } catch (err) {
    const message =
      err.response?.data?.message ||
      err.message ||
      "Failed to fetch timesheet history";
    showStatusToast(message || "Fetch failed", "error");
    throw err;
  }
}

export async function addEntryToTimesheet(timesheetId, workdate, payload) {
  try {
    if (timesheetId === undefined) {
      await api.post(
        `${apiEndpoint}/api/timesheet/create?workDate=${workdate}`,
        payload,
      );
    } else {
      await api.post(`${apiEndpoint}/api/timesheet/addEntries`, {
        timeSheetId: timesheetId,
        entries: payload,
      });
    }
    showStatusToast("Timesheet entry added successfully", "success");
  } catch (err) {
    let message;
    if (err.response) {
      const status = err.response.status;
      const data = err.response.data;
      if (status === 400) {
        message =
          (typeof data === "string" ? data : data?.message) ||
          "Failed to add entry to timesheet";
      } else {
        message =
          (typeof data === "string" ? data : data?.message) ||
          "Failed to add entry to timesheet";
      }
    } else {
      message = err.message || "Update failed";
    }
    showStatusToast(message, "error");
    throw new Error(message);
  }
}

/**
 * Save a whole week, one day at a time.
 *
 * The backend has no week-level upsert, so this fans out per day:
 *   • brand-new day  → POST /create
 *   • existing day   → POST /addEntries for the added rows
 *   • edited rows    → PUT  /updateEntries/{id}
 *
 * Unlike addEntryToTimesheet it stays quiet and hands every per-day outcome back
 * to the caller, so the UI can report the whole week in one message.
 *
 * @param {Array<{workDate, timesheetId?, status?, newEntries?, updatedEntries?}>} days
 * @returns {Promise<Array<{workDate, ok, message}>>}
 */
export async function saveWeekDraftEntries(days = []) {
  const results = [];

  for (const day of days) {
    const added = day.newEntries || [];
    const edited = day.updatedEntries || [];
    try {
      if (added.length) {
        if (day.timesheetId == null) {
          const res = await api.post(
            `${apiEndpoint}/api/timesheet/create?workDate=${day.workDate}`,
            added,
          );
          results.push({ workDate: day.workDate, ok: true, message: pickMessage(res.data) });
        } else {
          const res = await api.post(`${apiEndpoint}/api/timesheet/addEntries`, {
            timeSheetId: day.timesheetId,
            entries: added,
          });
          results.push({ workDate: day.workDate, ok: true, message: pickMessage(res.data) });
        }
      }

      if (edited.length && day.timesheetId != null) {
        const res = await api.put(
          `${apiEndpoint}/api/timesheet/updateEntries/${day.timesheetId}`,
          { workDate: day.workDate, status: day.status, entries: edited },
        );
        results.push({ workDate: day.workDate, ok: true, message: pickMessage(res.data) });
      }
    } catch (err) {
      const data = err.response?.data;
      results.push({
        workDate: day.workDate,
        ok: false,
        message:
          (typeof data === "string" ? data : data?.message) ||
          err.message ||
          "Could not be saved",
      });
    }
  }

  return results;
}

/** Delete saved entries from one day. Quiet — the caller reports the outcome. */
export async function deleteDayEntries(timesheetId, entryIds = []) {
  const res = await api.delete(
    `${apiEndpoint}/api/timesheet/deleteEntries/${timesheetId}`,
    { data: { entryIds } },
  );
  return pickMessage(res.data);
}

const pickMessage = (data) =>
  (typeof data === "string" ? data : data?.message) || "Saved";

export async function bulkReviewTimesheet(timesheetIds, status, comment) {
  try {
    // example body
    // {
    //   "timesheetIds": [14,15
    //   ],
    //   "status": "Approved",
    //   "comment": "Testing Bulk"
    // }
    await api.put(`${apiEndpoint}/api/timesheets/review/bulk`, {
      timesheetIds,
      status,
      comment: status === "Rejected" ? comment : "Bulk Approved",
    });

    showStatusToast(`Timesheet ${status} successfully`, "success");
    return;
  } catch (err) {
    showStatusToast("Update failed", "error");
    throw err;
  }
}

// Dashboard Summary API
export async function fetchDashboardSummary() {
  try {
    const response = await api.get(`${apiEndpoint}/api/dashboard/summary`);
    return response.data;
  } catch (error) {
    showStatusToast({
      type: "error",
      message: "Failed to fetch dashboard summary. Please try again.",
    });
    console.error("Fetch dashboard summary error:", error);
    return null; // Return null so calling code can check for loading/error
  }
}

export async function filterByRange(startDate, endDate) {
  try {
    const res = await api.get(
      `${apiEndpoint}/api/timesheet/filter?startDate=${startDate}&endDate=${endDate}`,
    );
    return res.data;
  } catch (err) {
    const message =
      err.response?.data?.message ||
      err.message ||
      "Failed to filter timesheet";
    showStatusToast(message || "Filter failed", "error");
    throw err;
  }
}

export async function getManagerDashboardData(startDate, endDate) {
  try {
    // The endpoint takes an optional startDate/endDate and defaults to the current
    // month. These arguments used to be declared and then dropped, so the summary
    // always showed the current month no matter what the caller asked for.
    const res = await api.get(`${apiEndpoint}/api/manager/summary`, {
      params: startDate && endDate ? { startDate, endDate } : undefined,
    });
    return res.data;
  } catch (err) {
    const message =
      err.response?.data?.message ||
      err.message ||
      "Failed to fetch manager dashboard data";
    showStatusToast(message, "error");
    throw err;
  }
}

// export async function submitWeeklyTimesheet(timesheetIds) {
//   try {
//     const res = await fetch(`${apiEndpoint}/api/weeklyReview/submit`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${localStorage.getItem("token")}`,
//       },
//       body: JSON.stringify(timesheetIds),
//     });

//     if (!res.ok) {
//       let errorMessage = "Failed to submit weekly timesheet";

//       try {
//         const errorData = await res.json();
//         errorMessage = errorData?.message || errorData || errorMessage;
//       } catch {
//         // fallback if response isn't JSON (e.g. plain text)
//         const text = await res.text();
//         if (text) errorMessage = text;
//       }

//       throw new Error(errorMessage);
//     }

//     // Handle both JSON and text responses
//     let responseMessage = "Weekly timesheet submitted successfully";
//     const contentType = res.headers.get("content-type");

//     if (contentType && contentType.includes("application/json")) {
//       const data = await res.json();
//       responseMessage = data.message || responseMessage;
//     } else {
//       const text = await res.text();
//       responseMessage = text || responseMessage;
//     }

//     showStatusToast(responseMessage, "success");
//     return responseMessage;
//   } catch (err) {
//     showStatusToast(
//       err.message || "Failed to submit weekly timesheet",
//       "error"
//     );
//     throw err;
//   }
// }
export async function submitWeeklyTimesheet(timesheetIds) {
  try {
    const res = await api.post(
      `${apiEndpoint}/api/weeklyReview/submit`,
      timesheetIds,
    );

    // ✅ Handle success response (either JSON or text — axios auto-parses)
    let responseMessage = "Weekly timesheet submitted successfully";
    const data = res.data;
    if (typeof data === "string") {
      responseMessage = data || responseMessage;
    } else {
      responseMessage = data?.message || responseMessage;
    }

    showStatusToast(responseMessage, "success");
    return responseMessage;
  } catch (err) {
    let errorMessage = "Failed to submit weekly timesheet";
    if (err.response) {
      const data = err.response.data;
      if (typeof data === "string") {
        errorMessage = data || errorMessage;
      } else if (data) {
        errorMessage = data?.message || JSON.stringify(data);
      }
    } else if (err.message) {
      errorMessage = err.message;
    }
    showStatusToast(errorMessage, "error");
    throw new Error(errorMessage);
  }
}

export async function fetchCalendarHolidays() {
  try {
    const response = await api.get(
      `${apiEndpoint}/api/holidays/currentMonthLeaves`,
    );
    return response.data;
  } catch (error) {
    showStatusToast({
      type: "error",
      message: "Failed to fetch calendar holidays. Please try again.",
    });
    console.error("Fetch calendar holidays error:", error);
    return null; // Return null so calling code can check for loading/error
  }
}

export async function fetchProjects() {
  try {
    const response = await api.get(`${apiEndpoint}/api/project-info/all`);
    return response.data;
  } catch (error) {
    console.error("Error fetching timesheets:", error);
    showStatusToast("Failed to fetch timesheets", "error");
    return [];
  }
}

export const handleBulkReview = async (
  userId,
  timesheetIds,
  status,
  comments = "",
) => {
  try {
    const response = await api.post(
      `${window.__APP_CONFIG__.TIMESHEET_API_ENDPOINT}/timesheets/review`,
      {
        userId,
        timesheetIds,
        status,
        comments: comments || (status === "APPROVED" ? "approved" : ""),
      },
    );

    const data = response.data;

    // ✅ Show the exact message returned from backend
    const message =
      data?.message || `Timesheets ${status.toLowerCase()} successfully`;
    showStatusToast(message, "success");
  } catch (err) {
    console.error("❌ Error reviewing timesheets:", err);
    const message =
      err.response?.data?.message ||
      err.message ||
      "Failed to update timesheet status";
    showStatusToast(message, "error");
  }
};
export async function fetchDashboardLastMonth() {
  try {
    const response = await api.get(
      `${apiEndpoint}/api/dashboard/summary/lastMonth`,
    );
    return response.data;
  } catch (error) {
    showStatusToast({
      type: "error",
      message: "Failed to fetch dashboard summary. Please try again.",
    });
    console.error("Fetch dashboard summary error:", error);
    return null; // Return null so calling code can check for loading/error
  }
}
export async function fetchDashboardLast3Months() {
  try {
    const response = await api.get(
      `${apiEndpoint}/api/dashboard/summary/last3Months`,
    );
    return response.data;
  } catch (error) {
    showStatusToast({
      type: "error",
      message: "Failed to fetch dashboard summary. Please try again.",
    });
    console.error("Fetch dashboard summary error:", error);
    return null; // Return null so calling code can check for loading/error
  }
}

export async function fetchDashboardDateRange(startDate, endDate) {
  try {
    const response = await api.get(
      `${apiEndpoint}/api/dashboard/summary/dateRangeMonths?startDate=${startDate}&endDate=${endDate}`,
    );
    return response.data;
  } catch (error) {
    showStatusToast({
      type: "error",
      message: "Failed to fetch dashboard summary. Please try again.",
    });
    console.error("Fetch dashboard summary error:", error);
    return null;
  }
}

export const handleBulkReviewAdmin = async (
  userId,
  timesheetIds,
  status,
  comments = "",
) => {
  try {
    const response = await api.post(
      `${window.__APP_CONFIG__.TIMESHEET_API_ENDPOINT}/timesheets/review/internal`,
      {
        userId,
        timesheetIds,
        status,
        comments: comments || (status === "APPROVED" ? "approved" : ""),
      },
    );

    const data = response.data;

    // ✅ Show the exact message returned from backend
    const message =
      data?.message || `Timesheets ${status.toLowerCase()} successfully`;
    showStatusToast(message, "success");
  } catch (err) {
    console.error("❌ Error reviewing timesheets:", err);
    const message =
      err.response?.data?.message ||
      err.message ||
      "Failed to update timesheet status";
    showStatusToast(message, "error");
  }
};

export const handleMixedReview = async ({
  path,
  userId,
  approvedIds = [],
  rejectedIds = [],
  comments = "",
  multiUserWrap = false,
}) => {
  const payload = {
    userId,
    approvedTimesheetIds: approvedIds,
    rejectedTimesheetIds: rejectedIds,
    comments,
  };

  try {
    const response = await api.post(
      `${window.__APP_CONFIG__.TIMESHEET_API_ENDPOINT}${path}`,
      multiUserWrap ? [payload] : payload,
    );

    const data = response.data;
    const message =
      (typeof data === "string" ? data : data?.message) ||
      `${approvedIds.length} day(s) approved, ${rejectedIds.length} day(s) rejected.`;
    showStatusToast(message, "success");
    return true;
  } catch (err) {
    console.error("❌ Error reviewing timesheets:", err);
    const respData = err.response?.data;
    const message =
      (typeof respData === "string" ? respData : respData?.message) ||
      err.message ||
      "Failed to update timesheet status";
    showStatusToast(message, "error");
    return false;
  }
};

export const getActiveHourSettings = async () => {
  try {
    const res = await api.get(
      `${window.__APP_CONFIG__.TIMESHEET_API_ENDPOINT}/api/timesheet-settings/active`,
    );
    return res.data;
  } catch (err) {
    console.error("❌ Failed to load hour settings:", err);
    showStatusToast("Failed to load hour settings", "error");
    throw err;
  }
};

export const updateHourSettings = async (payload) => {
  try {
    const res = await api.post(
      `${window.__APP_CONFIG__.TIMESHEET_API_ENDPOINT}/api/timesheet-settings`,
      payload,
    );

    showStatusToast("Hour settings updated successfully", "success");
    return res.data ?? null;
  } catch (err) {
    console.error("❌ Failed to update hour settings:", err);
    const respData = err.response?.data;
    const message =
      (typeof respData === "string" ? respData : respData?.message) ||
      err.message ||
      "Failed to update hour settings";
    showStatusToast(message, "error");
    throw new Error(message);
  }
};
