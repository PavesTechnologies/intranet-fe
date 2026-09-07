/**
 * Badge for the real backend `FieldComparisonStatus` enum (MATCH / MISMATCH / MISSING_EXTRACTED /
 * MISSING_MASTER / NOT_COMPARED). Kept local to Stage 1 rather than added to the shared
 * src/components/status/statusbadge.jsx, which is keyword-matched and reused by 100+ files across
 * unrelated modules — this avoids any risk of changing behavior there.
 */
const STATUS_STYLES = {
  MATCH: { label: "Match", className: "bg-emerald-100 text-emerald-700" },
  MISMATCH: { label: "Mismatch", className: "bg-red-100 text-red-700" },
  MISSING_EXTRACTED: { label: "Not found in document", className: "bg-slate-100 text-slate-600" },
  MISSING_MASTER: { label: "Not found in master data", className: "bg-slate-100 text-slate-600" },
  NOT_COMPARED: { label: "Not compared", className: "bg-gray-100 text-gray-500" },
};

export default function FieldStatusBadge({ status }) {
  const entry = STATUS_STYLES[status] || { label: status || "Unknown", className: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${entry.className}`}>
      {entry.label}
    </span>
  );
}
