/**
 * Shared display formatters for the AP module. Kept currency-symbol-aware (not hardcoded to ₹)
 * since Invoice/Vendor records carry their own currency, but defaults to INR when absent.
 */

/**
 * Formats a numeric amount as currency, e.g. formatCurrency(125000) -> "₹1,25,000.00".
 * Treats null/undefined/NaN as 0 rather than throwing or rendering "NaN"/"undefined".
 * @param {number|null|undefined} amount
 * @param {string} [currencySymbol="₹"]
 * @returns {string}
 */
export function formatCurrency(amount, currencySymbol = "₹") {
  const safeAmount = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(safeAmount));
  const sign = safeAmount < 0 ? "-" : "";
  return `${sign}${currencySymbol}${formatted}`;
}

/**
 * Formats an ISO date string for display, e.g. "2026-08-07" -> "07 Aug 2026".
 * Returns a placeholder rather than "Invalid Date" for empty/unparsable input.
 * @param {string|null|undefined} isoDate
 * @param {string} [placeholder="—"]
 * @returns {string}
 */
export function formatDate(isoDate, placeholder = "—") {
  if (!isoDate) return placeholder;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return placeholder;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Formats an ISO datetime string for display, e.g. "2026-08-07T14:05:00Z" -> "07 Aug 2026, 2:05 pm".
 * Returns a placeholder rather than "Invalid Date" for empty/unparsable input.
 * @param {string|null|undefined} isoDateTime
 * @param {string} [placeholder="—"]
 * @returns {string}
 */
export function formatDateTime(isoDateTime, placeholder = "—") {
  if (!isoDateTime) return placeholder;
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return placeholder;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Balance = net amount - amount paid, clamped so floating-point noise never displays as e.g.
 * "-0.00" for a fully paid invoice.
 * @param {number|null|undefined} netAmount
 * @param {number|null|undefined} amountPaid
 * @returns {number}
 */
export function calculateBalance(netAmount, amountPaid) {
  const net = typeof netAmount === "number" && Number.isFinite(netAmount) ? netAmount : 0;
  const paid = typeof amountPaid === "number" && Number.isFinite(amountPaid) ? amountPaid : 0;
  const balance = net - paid;
  return Math.abs(balance) < 0.005 ? 0 : balance;
}

/** True once a due date has passed and the invoice still carries an outstanding balance. */
export function isOverdue(dueDate, netAmount, amountPaid) {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now() && calculateBalance(netAmount, amountPaid) > 0;
}
