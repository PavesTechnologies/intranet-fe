import { CheckCircle2, XCircle } from "lucide-react";

/**
 * Per-vendor outcome list shown after "Send RFQ", when the backend response actually contained
 * one (see utils/rfqSendResults.js). Read-only — this only reports what already happened.
 * @param {{ results: Array<{ vendorId?: number|string, vendorName?: string, email?: string, success: boolean, message?: string }> }} props
 */
export default function RfqSendResultsPanel({ results }) {
  const failedCount = results.filter((r) => !r.success).length;

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-700">
        {failedCount === 0
          ? `RFQ sent to all ${results.length} vendor(s).`
          : `RFQ sent to ${results.length - failedCount} of ${results.length} vendor(s); ${failedCount} could not be reached.`}
      </p>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {results.map((r, i) => (
          <li key={r.vendorId ?? r.email ?? i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">{r.vendorName || r.email || `Vendor #${r.vendorId}`}</p>
              {r.message && !r.success && <p className="truncate text-xs text-rose-600">{r.message}</p>}
            </div>
            {r.success ? (
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Sent
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-rose-600">
                <XCircle className="h-4 w-4" /> Failed
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
