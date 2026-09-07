import { STATUS_ICON_VISUALS } from "./FieldComparisonTable";

const LEGEND_ITEMS = [
  { status: "MATCH", label: "Match" },
  { status: "MISMATCH", label: "Mismatch" },
  { status: "MISSING_EXTRACTED", label: "Not Found" },
];

/** Legend for the icon-only Status column in FieldComparisonTable — shares its icon/color map so the two never drift apart. */
export default function FieldStatusLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
      {LEGEND_ITEMS.map((item) => {
        const { Icon, className } = STATUS_ICON_VISUALS[item.status];
        return (
          <span key={item.status} className="flex items-center gap-1.5">
            <Icon className={`h-4 w-4 ${className}`} aria-hidden="true" />
            {item.label}
          </span>
        );
      })}
    </div>
  );
}
