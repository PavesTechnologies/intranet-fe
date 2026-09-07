// Month scope for the approval queues: the current month and the previous one.
//
// The backend accepts optional ?month=1-12&year=YYYY on all three queue endpoints,
// defaults to the current month, and rejects anything that is not the current or
// previous calendar month (see MonthScope.java) — so these are the only two options
// we ever offer.

import { useMemo, useState } from "react";

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const monthScopeKey = (year, month) =>
  `${year}-${String(month).padStart(2, "0")}`;

const iso = (year, month, day) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Day 0 of the next month is the last day of this one. */
const lastDayOf = (year, month) => new Date(year, month, 0).getDate();

/**
 * [current, previous] as { value, label, month, year }.
 * `month` is 1-based to match the API. new Date(y, m - 1, 1) with m = 0 rolls the
 * year back on its own, so January correctly offers "Dec <y-1>".
 */
export const buildMonthScopeOptions = (now = new Date()) => {
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return [
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    { year: previous.getFullYear(), month: previous.getMonth() + 1 },
  ].map(({ year, month }) => ({
    value: monthScopeKey(year, month),
    label: `${SHORT_MONTHS[month - 1]} ${year}`,
    month,
    year,
    // Endpoints that take a range instead of month/year (the manager summary) use
    // these, so every read on the screen stays on the same window.
    startDate: iso(year, month, 1),
    endDate: iso(year, month, lastDayOf(year, month)),
  }));
};

export default function useMonthScope() {
  // Built once per mount: a stable array keeps FilterListbox's option identity stable.
  const options = useMemo(() => buildMonthScopeOptions(), []);
  const [monthKey, setMonthKey] = useState(options[0].value);

  const selected = options.find((o) => o.value === monthKey) || options[0];

  return {
    month: selected.month,
    year: selected.year,
    startDate: selected.startDate,
    endDate: selected.endDate,
    label: selected.label,
    monthKey,
    setMonthKey,
    options,
  };
}
