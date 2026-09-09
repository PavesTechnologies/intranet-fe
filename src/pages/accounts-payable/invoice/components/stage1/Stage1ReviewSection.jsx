import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Stage1Header from "./Stage1Header";
import InvoiceDetailsPanel from "./InvoiceDetailsPanel";
import InvoiceAmountsSection from "./InvoiceAmountsSection";
import InvoiceLineItemsSection from "./InvoiceLineItemsSection";
import PartyValidationPanel from "./PartyValidationPanel";
import GstTaxValidationPanel from "./GstTaxValidationPanel";
import InvoiceDocumentViewer from "./InvoiceDocumentViewer";
import FieldDocumentConnector from "./FieldDocumentConnector";
import { getFieldLocation } from "../../utils/fieldLocation";
import {
  useCorrectVendorMutation,
  useCorrectBuyerMutation,
  useCorrectTaxMutation,
  useCorrectAmountsMutation,
} from "../../hooks/useInvoiceMutations";

const TAB_ORDER = ["vendor", "buyer", "gst"];

/**
 * Full-width Stage 1 review workspace, rendered by InvoiceUploadPage once extraction has
 * produced field data. Pipeline status (Stage1Header's stepper) always renders first.
 *
 * Two distinct modes below it, matching whether there's anything real to compare against yet:
 *  - Extraction Validation FAILED: Vendor/Buyer/GST never ran (they're SKIPPED, not WAITING),
 *    so there's nothing to switch between — this renders one plain form (Invoice Details,
 *    Amounts, Line Items) instead of a tab switcher. Every field writes straight to local
 *    pipeline state; there's no per-section save, just the one page-level Save Invoice button.
 *  - Otherwise: the normal Vendor/Buyer/GST tab switcher with real field-comparison verdicts,
 *    stepper-driven, unchanged from before.
 *
 * @param {Object} props
 * @param {Object} props.extractedInvoice - pipeline.extractionResult.extracted_invoice
 * @param {Record<string, Object>} props.stages - pipeline.validation.stages
 * @param {string|null} props.extractionId
 * @param {string|null} props.fileUrl - local blob URL of the just-uploaded file, or null
 * @param {string} [props.originalFilename]
 * @param {(section: "vendor"|"buyer"|"tax"|"amounts", updatedSection: Object, corrections: Array) => void} props.onCorrected
 * @param {(section: string, field: string, value: string) => void} props.onFieldChange
 * @param {(index: number, field: string, value: string) => void} props.onLineChange
 */
export default function Stage1ReviewSection({
  extractedInvoice,
  stages,
  extractionId,
  fileUrl,
  originalFilename,
  onCorrected,
  onFieldChange,
  onLineChange,
}) {
  const [activeTab, setActiveTab] = useState("vendor");
  const [manualTab, setManualTab] = useState(false);
  const [selectedFieldKey, setSelectedFieldKey] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const prevActiveTab = useRef(activeTab);

  const gridRef = useRef(null);
  const selectedRowRef = useRef(null);
  const highlightRef = useRef(null);

  const correctVendor = useCorrectVendorMutation();
  const correctBuyer = useCorrectBuyerMutation();
  const correctTax = useCorrectTaxMutation();
  const correctAmounts = useCorrectAmountsMutation();

  const extractionFailed = stages?.extraction?.status === "FAILED";
  const extractionIssues = stages?.extraction?.issues || [];

  // Follow validation progress (auto-advance to the furthest-reached stage) until the user
  // manually picks a stepper item, then stop overriding their choice. No-op while extraction has
  // failed — there's no tab switcher in that mode.
  useEffect(() => {
    if (manualTab || extractionFailed) return;
    let next = "vendor";
    for (const key of TAB_ORDER) {
      if (stages?.[key]?.status && stages[key].status !== "WAITING") next = key;
    }
    setActiveTab(next);
  }, [stages, manualTab, extractionFailed]);

  useEffect(() => {
    if (prevActiveTab.current !== activeTab) {
      setSelectedFieldKey(null);
      setSelectedLocation(null);
      prevActiveTab.current = activeTab;
    }
  }, [activeTab]);

  const handleFieldSelect = (rawKey, location) => {
    setSelectedFieldKey(rawKey);
    setSelectedLocation(location);
  };

  const handleAmountFieldFocus = (rawKey) =>
    handleFieldSelect(rawKey, rawKey ? getFieldLocation(extractedInvoice?.extraction, rawKey) : null);

  const handleSelectStage = (key) => {
    if (stages?.[key]?.status === "WAITING" || !stages?.[key]?.status) return;
    setManualTab(true);
    setActiveTab(key);
  };

  const showConnector = !extractionFailed && (activeTab === "vendor" || activeTab === "buyer");

  return (
    <div>
      <Stage1Header stages={stages} activeTab={extractionFailed ? null : activeTab} onSelectStage={extractionFailed ? undefined : handleSelectStage} />

      {extractionFailed && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-800">Extraction Validation Failed</p>
              {extractionIssues.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {extractionIssues.map((issue, index) => (
                    <li key={index} className="text-sm text-red-700">
                      • {issue}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-red-700">
                  {stages.extraction.message || "The extracted invoice data could not be validated."}
                </p>
              )}
              <p className="mt-2 text-xs text-red-600">
                Vendor, Buyer, and GST Tax validation were skipped because this earlier stage failed. Correct the
                fields below, then use Save Invoice.
              </p>
            </div>
          </div>
        </div>
      )}

      <div ref={gridRef} className="relative grid grid-cols-1 gap-6 lg:grid-cols-[44%_1fr]">
        <div className="space-y-6">
          {extractionFailed ? (
            <>
              <InvoiceDetailsPanel extractedInvoice={extractedInvoice} onFieldChange={onFieldChange} />
              <InvoiceAmountsSection
                extractedInvoice={extractedInvoice}
                extraction={extractedInvoice?.extraction}
                onFieldFocus={handleAmountFieldFocus}
                onFieldChange={onFieldChange}
              />
              <InvoiceLineItemsSection lines={extractedInvoice?.invoice_lines} onLineChange={onLineChange} />
            </>
          ) : (
            <>
              <InvoiceDetailsPanel extractedInvoice={extractedInvoice} onFieldChange={onFieldChange} />
              {activeTab === "vendor" && (
                <PartyValidationPanel
                  section="vendor"
                  title="Vendor"
                  extractedParty={extractedInvoice?.vendor}
                  stageState={stages?.vendor}
                  extraction={extractedInvoice?.extraction}
                  selectedFieldKey={selectedFieldKey}
                  onFieldSelect={handleFieldSelect}
                  correctionMutation={correctVendor}
                  extractionId={extractionId}
                  onCorrected={onCorrected}
                  selectedRowRef={selectedRowRef}
                />
              )}
              {activeTab === "buyer" && (
                <PartyValidationPanel
                  section="buyer"
                  title="Buyer"
                  extractedParty={extractedInvoice?.buyer}
                  stageState={stages?.buyer}
                  extraction={extractedInvoice?.extraction}
                  selectedFieldKey={selectedFieldKey}
                  onFieldSelect={handleFieldSelect}
                  correctionMutation={correctBuyer}
                  extractionId={extractionId}
                  onCorrected={onCorrected}
                  selectedRowRef={selectedRowRef}
                />
              )}
              {activeTab === "gst" && (
                <GstTaxValidationPanel
                  extractedInvoice={extractedInvoice}
                  stageState={stages?.gst}
                  extraction={extractedInvoice?.extraction}
                  selectedFieldKey={selectedFieldKey}
                  onFieldSelect={handleFieldSelect}
                  taxCorrectionMutation={correctTax}
                  amountsCorrectionMutation={correctAmounts}
                  extractionId={extractionId}
                  onCorrected={onCorrected}
                />
              )}
            </>
          )}
        </div>

        <div className="h-[75vh] min-h-[520px]">
          <InvoiceDocumentViewer
            fileUrl={fileUrl}
            originalFilename={originalFilename}
            page={selectedLocation?.page}
            highlights={selectedLocation ? [selectedLocation] : []}
            highlightRef={highlightRef}
            noteMessage={selectedFieldKey && !selectedLocation ? "No document location available for the selected field." : null}
          />
        </div>

        {showConnector && (
          <FieldDocumentConnector
            containerRef={gridRef}
            fromRef={selectedRowRef}
            toRef={highlightRef}
            active={Boolean(selectedFieldKey && selectedLocation)}
          />
        )}
      </div>
    </div>
  );
}

