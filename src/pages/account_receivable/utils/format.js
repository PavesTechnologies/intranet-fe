export function formatCurrency(amount, currency = "INR") {
  const value = Number(amount) || 0;
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

/**
 * Accepts either an ISO date string ("2026-08-05...") or a Java LocalDate
 * tuple ([year, month, day], 1-indexed month) as returned by some backends.
 */
export function formatDisplayDate(value) {
  if (value === null || value === undefined || value === "") return "—";

  let date;
  if (Array.isArray(value)) {
    const [year, month, day] = value;
    if (year == null || month == null || day == null) return "—";
    date = new Date(year, month - 1, day);
  } else if (typeof value === "string") {
    const datePart = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return value;
    date = new Date(`${datePart}T00:00:00`);
  } else {
    return String(value);
  }

  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDisplayDateTime(isoValue) {
  if (!isoValue) return "—";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return isoValue;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
