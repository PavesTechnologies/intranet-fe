import { Check, X } from "lucide-react";
import { PROCUREMENT_STAGES, getProcurementStageIndex } from "../constants/procurementStages";

/**
 * Horizontal progress indicator showing where one purchase requisition sits across the six
 * procurement stages. Purely derived from the PR's existing status_code — see
 * getProcurementStageIndex for the mapping. PO Acknowledged is always rendered inactive: the
 * backend doesn't expose a vendor-acknowledgement step yet, so it can never be "completed" here.
 * @param {{ prStatusCode?: string }} props
 */
export default function ProcurementWorkflowStepper({ prStatusCode }) {
  const stage = getProcurementStageIndex(prStatusCode);
  if (!stage) return null;

  const { index: currentIndex, terminal } = stage;

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white px-4 py-4 sm:px-6">
      <ol className="flex min-w-max items-start">
        {PROCUREMENT_STAGES.map((s, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isHalted = isCurrent && terminal;
          const isLast = i === PROCUREMENT_STAGES.length - 1;

          const circleClasses = isHalted
            ? "border-rose-500 bg-rose-500 text-white"
            : isCompleted
              ? "border-[#0A0082] bg-[#0A0082] text-white"
              : isCurrent
                ? "border-[#0A0082] bg-white text-[#0A0082]"
                : "border-gray-300 bg-white text-gray-400";

          const labelClasses = isHalted
            ? "text-rose-700 font-semibold"
            : isCompleted || isCurrent
              ? "text-gray-900 font-semibold"
              : "text-gray-400";

          return (
            <li key={s.key} className="flex items-start">
              <div className="flex w-20 flex-col items-center sm:w-24">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${circleClasses}`}
                >
                  {isHalted ? <X className="h-3.5 w-3.5" /> : isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`mt-2 text-center text-[11px] leading-tight sm:text-xs ${labelClasses}`}>
                  {s.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`mt-3.5 h-0.5 w-6 shrink-0 sm:w-10 ${isCompleted ? "bg-[#0A0082]" : "bg-gray-200"}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
