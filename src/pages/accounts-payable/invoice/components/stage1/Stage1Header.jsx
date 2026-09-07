import { Info } from "lucide-react";
import { VALIDATION_STAGES } from "../InvoiceProcessingPipeline";

const STEP_LABELS = { extraction: "Extraction", vendor: "Vendor", buyer: "Buyer", gst: "GST Tax" };
const TAB_TITLES = {
  extraction: "Extraction Validation",
  vendor: "Vendor Validation",
  buyer: "Buyer Validation",
  gst: "GST Tax Validation",
};
const TAB_NOUNS = { extraction: "amount", vendor: "vendor", buyer: "buyer", gst: "GST tax" };

const STATUS_TEXT = { SUCCESS: "Completed", RUNNING: "In Progress", FAILED: "Failed", SKIPPED: "Skipped", WAITING: "Waiting" };

const STATUS_COLOR = {
  SUCCESS: { circle: "border-emerald-500 text-emerald-600", text: "text-emerald-600" },
  RUNNING: { circle: "border-[#0A0082] text-[#0A0082]", text: "text-[#0A0082]" },
  FAILED: { circle: "border-red-500 text-red-600", text: "text-red-600" },
  SKIPPED: { circle: "border-gray-300 text-gray-400", text: "text-gray-400" },
  WAITING: { circle: "border-gray-300 text-gray-400", text: "text-gray-400" },
};

/**
 * Page header for the Stage 1 review screens: title/subtitle on the left (driven by which panel
 * is active) and the four-stage numbered stepper on the right, driven entirely by
 * `pipeline.validation.stages` — the same backend stage data InvoiceProcessingPipeline already
 * renders, just reused here in the horizontal numbered layout the target design calls for. The
 * "Extraction" is switchable only once it's FAILED (ExtractionAmountsPanel lets the user correct
 * the amount fields that failed reconciliation) — it stays informational-only otherwise, since
 * there's no panel for a passing extraction stage. Vendor/Buyer/GST Tax double as the tab switcher
 * when `onSelectStage` is provided, disabled while WAITING so users can't jump ahead of backend
 * progress.
 */
export default function Stage1Header({ stages, activeTab, onSelectStage }) {
  return (
    <div className="mb-5 flex flex-col gap-4 border-b border-gray-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          {TAB_TITLES[activeTab] || "Vendor Validation"}
          <Info
            className="h-4 w-4 text-gray-400"
            aria-hidden="true"
            title="Review each extracted field against the original document before proceeding to the next stage."
          />
        </h1>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-500">
          <span>
            Verify {TAB_NOUNS[activeTab] || "vendor"} details extracted from the invoice. Click on any field to view and compare with the
            original document.
          </span>
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {VALIDATION_STAGES.map((stage, index) => {
          const status = stages?.[stage.key]?.status || "WAITING";
          const colors = STATUS_COLOR[status] || STATUS_COLOR.WAITING;
          const isSwitchable = onSelectStage && (stage.key !== "extraction" || status === "FAILED");
          const disabled = isSwitchable && status === "WAITING";
          const isActive = stage.key === activeTab;

          const content = (
            <>
              <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${colors.circle}`}>
                {index + 1}
                {isActive && <span className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-[#0A0082]" aria-hidden="true" />}
              </span>
              <span className="text-left leading-tight">
                <span className="block text-sm font-semibold text-gray-800">{STEP_LABELS[stage.key]}</span>
                <span className={`block text-xs font-medium ${colors.text}`}>{STATUS_TEXT[status]}</span>
              </span>
            </>
          );

          if (!isSwitchable) {
            return (
              <div key={stage.key} className="flex items-center gap-2">
                {content}
              </div>
            );
          }

          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => onSelectStage(stage.key)}
              disabled={disabled}
              aria-current={isActive ? "step" : undefined}
              className={`flex items-center gap-2 rounded-md ${disabled ? "cursor-not-allowed opacity-60" : "hover:opacity-80"}`}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
