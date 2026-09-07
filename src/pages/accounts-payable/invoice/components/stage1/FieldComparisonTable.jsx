import { CheckCircle2, AlertTriangle, MinusCircle, MapPin } from "lucide-react";
import Button from "../../../../../components/Button/Button";

/** Shared with FieldStatusLegend so the table's icons and the legend never drift apart. */
export const STATUS_ICON_VISUALS = {
  MATCH: { Icon: CheckCircle2, className: "text-emerald-600", label: "Match" },
  MISMATCH: { Icon: AlertTriangle, className: "text-amber-500", label: "Mismatch" },
  MISSING_EXTRACTED: { Icon: MinusCircle, className: "text-gray-400", label: "Not Found" },
  MISSING_MASTER: { Icon: MinusCircle, className: "text-gray-400", label: "Not Found" },
  NOT_COMPARED: { Icon: MinusCircle, className: "text-gray-400", label: "Not Found" },
};

function StatusIcon({ status }) {
  const entry = STATUS_ICON_VISUALS[status] || STATUS_ICON_VISUALS.NOT_COMPARED;
  const Icon = entry.Icon;
  return <Icon className={`h-5 w-5 ${entry.className}`} aria-hidden="true" title={entry.label} />;
}

function ConfidenceBadge({ confidence }) {
  if (confidence == null || Number.isNaN(confidence)) {
    return <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">—</span>;
  }
  const rounded = Math.round(confidence);
  const tone = rounded >= 90 ? "bg-emerald-100 text-emerald-700" : rounded >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{rounded}%</span>;
}

function formatValue(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

/**
 * Field / Extracted Value / Confidence / [compare column] / Status / [Action] comparison table,
 * shared by Vendor, Buyer, and GST field verification. Built on CSS grid rather than a real
 * <table> so the selected row can render as a distinct bordered card (per the target design)
 * without table border-collapse fighting the per-row border.
 *
 * @param {Object} props
 * @param {string} [props.compareLabel] - header for an optional comparison-value column (GST
 *   passes "Invoice Value"; omitted entirely for Vendor/Buyer, which don't show a compare column)
 * @param {Array<{key,label,extractedValue,confidence,masterValue,status,rawKey,hasLocation,correctable?}>} props.rows
 * @param {string|null} props.selectedFieldKey
 * @param {(row: Object) => void} props.onSelectField
 * @param {(row: Object) => void} [props.onCorrect] - when provided, renders an Action column with
 *   a per-row "Correct" link for rows marked `correctable`
 * @param {React.Ref} [props.selectedRowRef] - attached to the currently selected row's DOM node,
 *   used by FieldDocumentConnector to anchor the arrow to it
 */
export default function FieldComparisonTable({ compareLabel, rows, selectedFieldKey, onSelectField, onCorrect, selectedRowRef }) {
  if (!rows || rows.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No fields to display yet.</p>;
  }

  const columns = ["1.1fr", "1.5fr", "0.8fr"];
  if (compareLabel) columns.push("1.4fr");
  columns.push("0.7fr");
  if (onCorrect) columns.push("0.7fr");
  const gridTemplateColumns = columns.join(" ");

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <div
        className="grid min-w-[520px] gap-x-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
        style={{ gridTemplateColumns }}
      >
        <span>Field</span>
        <span>Extracted Value</span>
        <span>Confidence</span>
        {compareLabel && <span>{compareLabel}</span>}
        <span>Status</span>
        {onCorrect && <span>Action</span>}
      </div>

      <div className="divide-y divide-gray-100 p-1">
        {rows.map((row) => {
          const isSelected = selectedFieldKey === row.rawKey;
          return (
            <div
              key={row.key}
              ref={isSelected ? selectedRowRef : undefined}
              onClick={() => onSelectField?.(row)}
              className={`grid min-w-[500px] cursor-pointer items-center gap-x-3 rounded-lg px-3 py-3 text-sm transition-colors ${
                isSelected ? "border-2 border-blue-500 bg-blue-50" : "border-2 border-transparent hover:bg-blue-50/60"
              }`}
              style={{ gridTemplateColumns }}
            >
              <span className={`flex items-center gap-1.5 font-medium ${isSelected ? "text-blue-700" : "text-gray-800"}`}>
                {row.hasLocation && (
                  <MapPin className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-blue-500" : "text-gray-400"}`} aria-hidden="true" />
                )}
                {row.label}
              </span>
              <span className="truncate text-gray-700" title={formatValue(row.extractedValue)}>
                {formatValue(row.extractedValue)}
              </span>
              <span>
                <ConfidenceBadge confidence={row.confidence} />
              </span>
              {compareLabel && (
                <span className="truncate text-gray-700" title={formatValue(row.masterValue)}>
                  {formatValue(row.masterValue)}
                </span>
              )}
              <span>
                <StatusIcon status={row.status} />
              </span>
              {onCorrect && (
                <span>
                  {row.correctable && (
                    <Button
                      variant="link"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCorrect(row);
                      }}
                    >
                      Correct
                    </Button>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
