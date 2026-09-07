import React from "react";
import clsx from "clsx";

const StatusBadge = ({ label, size = "md" }) => {
  const raw = label?.toLowerCase() || "";
  const normalized = raw.replace(/_/g, " ").trim();

  let bgColor = "bg-gray-200";
  let textColor = "text-gray-700";

  // Account Receivable Billing Statuses
  let displayLabel = label;
  const rawUpper = (label || "").toString().trim().toUpperCase();

  if (rawUpper === "READY_TO_TAX" || rawUpper === "READY_FOR_TAX" || rawUpper === "READY" || normalized === "ready" || normalized === "ready to tax" || normalized === "ready for tax") {
    displayLabel = "Ready for Tax";
    bgColor = "bg-emerald-100 border border-emerald-300";
    textColor = "text-emerald-800 font-bold";
  } else if (rawUpper === "IN_TAX" || normalized === "in tax") {
    displayLabel = "Tax Calculation in Progress";
    bgColor = "bg-amber-100 border border-amber-300";
    textColor = "text-amber-800 font-bold";
  } else if (rawUpper === "TAX_COMPLETED" || normalized === "tax completed") {
    displayLabel = "Tax Completed";
    bgColor = "bg-blue-100 border border-blue-300";
    textColor = "text-blue-800 font-bold";
  } else if (rawUpper === "IN_PROGRESS" || normalized === "in progress") {
    displayLabel = "In Progress";
    bgColor = "bg-indigo-50 border border-indigo-200";
    textColor = "text-indigo-700 font-medium";
  } else if (rawUpper === "INVOICED" || normalized === "invoiced") {
    displayLabel = "Invoiced";
    bgColor = "bg-blue-100 border border-blue-300";
    textColor = "text-blue-800 font-bold";
  } else if (rawUpper === "CANCELLED" || rawUpper === "CANCELED" || normalized === "cancelled" || normalized === "canceled") {
    displayLabel = "Cancelled";
    bgColor = "bg-rose-100 border border-rose-300";
    textColor = "text-rose-800 font-bold";
  } else if (normalized === "not acquired") {
    bgColor = "bg-slate-100 border border-slate-300";
    textColor = "text-slate-700 font-medium";
  } else if (normalized === "validating") {
    bgColor = "bg-indigo-50 border border-indigo-200";
    textColor = "text-indigo-700 font-medium";
  } else if (normalized === "partially ready" || normalized === "needs approval") {
    bgColor = "bg-amber-100 border border-amber-300";
    textColor = "text-amber-800 font-bold";
  } else if (normalized === "pending approval") {
    bgColor = "bg-amber-100 border border-amber-300";
    textColor = "text-amber-800 font-bold";
  } else if (normalized === "no billable data" || normalized === "no data") {
    bgColor = "bg-slate-100 border border-slate-300";
    textColor = "text-slate-700 font-medium";
  } else if (normalized === "configuration required" || normalized === "setup required") {
    bgColor = "bg-amber-100 border border-amber-300";
    textColor = "text-amber-800 font-bold";
  } else if (normalized.includes("billed") || normalized === "already billed") {
    bgColor = "bg-blue-100 border border-blue-300";
    textColor = "text-blue-800 font-bold";
  } else if (normalized === "acquisition failed") {
    bgColor = "bg-rose-100 border border-rose-300";
    textColor = "text-rose-800 font-bold";
  } else if (normalized === "joining pending") {
    bgColor = "bg-red-100";
    textColor = "text-red-700";
  } else if (normalized === "joining") {
    bgColor = "bg-purple-100";
    textColor = "text-purple-700";
  } else if (normalized === "completed") {
    bgColor = "bg-blue-100";
    textColor = "text-blue-700";
  } else if (
    normalized === "active" ||
    normalized === "done" ||
    normalized.includes("approve") ||
    normalized.includes("complete") ||
    normalized.includes("release")
  ) {
    bgColor = "bg-green-100";
    textColor = "text-green-700";
  } else if (
    normalized.includes("pending") ||
    normalized.includes("hold") ||
    normalized.includes("progress") ||
    normalized.includes("planning") ||
    normalized.includes("blocked")
  ) {
    bgColor = "bg-yellow-100";
    textColor = "text-yellow-700";
  } else if (
    normalized.includes("reject") ||
    normalized.includes("cancel") ||
    normalized.includes("fail") ||
    normalized.includes("inactive")
  ) {
    bgColor = "bg-red-100";
    textColor = "text-red-600";
  }

  if (raw === "offered") {
    bgColor = "bg-blue-100";
    textColor = "text-blue-700";
  }

  if (raw === "created") {
    bgColor = "bg-gray-100";
    textColor = "text-gray-700";
  }

  if (raw === "reject") {
    bgColor = "bg-red-100";
    textColor = "text-red-700";
  }

  if (raw === "verified" || raw === "passed" || normalized.includes("pass")) {
    bgColor = "bg-green-100";
    textColor = "text-green-700";
  }

  if (raw === "accepted") {
    bgColor = "bg-orange-100";
    textColor = "text-orange-700";
  }

  if (raw === "submitted") {
    bgColor = "bg-yellow-100";
    textColor = "text-yellow-700";
  }
  if (normalized === "rescheduled") {
    bgColor = "bg-yellow-100";
    textColor = "text-yellow-700";
  }

  // Accounts Payable invoice statuses not covered by the generic keyword branches above
  // (see the standing note in constants/invoiceStatus.js).
  if (normalized === "ocr processing") {
    bgColor = "bg-blue-100";
    textColor = "text-blue-700";
  }

  if (rawUpper === "APPROVED_FOR_PAYMENT" || normalized === "approved for payment" || rawUpper === "NONE") {
    displayLabel = "Approved for Payment";
    bgColor = "bg-indigo-100 border border-indigo-200";
    textColor = "text-indigo-700 font-semibold";
  }

  if (rawUpper === "PAYMENT_COMPLETED" || normalized === "payment completed") {
    displayLabel = "Payment Completed";
    bgColor = "bg-emerald-100 border border-emerald-300";
    textColor = "text-emerald-800 font-bold";
  }

  if (normalized === "ready for payment") {
    bgColor = "bg-indigo-100";
    textColor = "text-indigo-700";
  }

  if (raw === "paid") {
    bgColor = "bg-green-100";
    textColor = "text-green-700";
  }

  if (normalized === "partially paid") {
    bgColor = "bg-sky-100";
    textColor = "text-sky-700";
  }

  if (normalized === "duplicate") {
    bgColor = "bg-orange-100";
    textColor = "text-orange-700";
  }

  if (normalized === "disputed") {
    bgColor = "bg-rose-100";
    textColor = "text-rose-700";
  }

  // Procurement (PR / RFQ) statuses not covered by the generic keyword branches above.
  if (normalized === "returned" || normalized === "returned for clarification") {
    bgColor = "bg-orange-100 border border-orange-300";
    textColor = "text-orange-800 font-bold";
  }

  if (normalized === "sent") {
    bgColor = "bg-blue-100";
    textColor = "text-blue-700";
  }

  if (normalized === "response received") {
    bgColor = "bg-indigo-100";
    textColor = "text-indigo-700";
  }

  if (normalized === "closed" || normalized === "vendor selection") {
    bgColor = "bg-indigo-100";
    textColor = "text-indigo-700";
  }

  if (normalized === "po generated" || normalized === "selected") {
    bgColor = "bg-green-100";
    textColor = "text-green-700";
  }

  if (normalized === "received") {
    bgColor = "bg-blue-100";
    textColor = "text-blue-700";
  }

  const sizeStyles = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  return (
    <span
      className={clsx(
        "inline-block rounded-full font-medium",
        bgColor,
        textColor,
        sizeStyles[size]
      )}
    >
      {displayLabel}
    </span>
  );
};


export default StatusBadge;
