import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Stage1Header from "./Stage1Header";
import InvoiceDetailsPanel from "./InvoiceDetailsPanel";
import PartyValidationPanel from "./PartyValidationPanel";
import GstTaxValidationPanel from "./GstTaxValidationPanel";
import ExtractionAmountsPanel from "./ExtractionAmountsPanel";
import InvoiceDocumentViewer from "./InvoiceDocumentViewer";
import FieldDocumentConnector from "./FieldDocumentConnector";
import {
  useCorrectVendorMutation,
  useCorrectBuyerMutation,
  useCorrectTaxMutation,
  useCorrectAmountsMutation,
} from "../../hooks/useInvoiceMutations";

const TAB_ORDER = ["vendor", "buyer", "gst"];

/**
 * Full-width Stage 1 review workspace: Stage1Header (title + the numbered stepper, which also
 * doubles as the tab switcher) over a two-column layout — field comparisons on the left (~44%),
 * the shared document viewer on the right (~56%). WAITING stages are disabled in the header — the
 * user can review any stage already reached, but never jump ahead. Rendered by InvoiceUploadPage
 * once extraction has produced field data.
 *
 * @param {Object} props
 * @param {Object} props.extractedInvoice - pipeline.extractionResult.extracted_invoice
 * @param {Record<string, Object>} props.stages - pipeline.validation.stages
 * @param {string|null} props.extractionId
 * @param {string|null} props.fileUrl - local blob URL of the just-uploaded file, or null
 * @param {string} [props.originalFilename]
 * @param {(section: "vendor"|"buyer"|"tax"|"amounts", updatedSection: Object, corrections: Array) => void} props.onCorrected
 * @param {(section: "document"|"reference"|"payment", updatedSection: Object) => void} props.onDetailsCorrected
 */
export default function Stage1ReviewSection({
  extractedInvoice,
  stages,
  extractionId,
  fileUrl,
  originalFilename,
  onCorrected,
  onDetailsCorrected,
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

  // Follow validation progress (auto-advance to the furthest-reached stage) until the user
  // manually picks a stepper item, then stop overriding their choice. A failed Extraction stage
  // takes priority over the loop below — Vendor/Buyer/GST never actually ran (they're SKIPPED,
  // not WAITING), so landing there would show three blank panels instead of the one place the
  // user can actually act: correcting the amount fields that failed reconciliation.
  useEffect(() => {
    if (manualTab) return;
    if (stages?.extraction?.status === "FAILED") {
      setActiveTab("extraction");
      return;
    }
    let next = "vendor";
    for (const key of TAB_ORDER) {
      if (stages?.[key]?.status && stages[key].status !== "WAITING") next = key;
    }
    setActiveTab(next);
  }, [stages, manualTab]);

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

  const handleSelectStage = (key) => {
    if (stages?.[key]?.status === "WAITING" || !stages?.[key]?.status) return;
    setManualTab(true);
    setActiveTab(key);
  };

  const showConnector = activeTab === "vendor" || activeTab === "buyer" || activeTab === "extraction";
  const extractionFailed = stages?.extraction?.status === "FAILED";
  const extractionIssues = stages?.extraction?.issues || [];

  return (
    <div>
      <InvoiceDetailsPanel extractedInvoice={extractedInvoice} onCorrected={onDetailsCorrected} />

      <Stage1Header stages={stages} activeTab={activeTab} onSelectStage={handleSelectStage} />

      {/* Vendor/Buyer/GST panels only ever say "Skipped" — this is the one place the actual
          extraction-validation failure reason is shown, since none of those three tabs has a
          panel for the "extraction" stage itself. */}
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
                Vendor, Buyer, and GST Tax validation were skipped because this earlier stage failed.
              </p>
            </div>
          </div>
        </div>
      )}

      <div ref={gridRef} className="relative grid grid-cols-1 gap-6 lg:grid-cols-[44%_1fr]">
        <div>
          {activeTab === "extraction" && (
            <ExtractionAmountsPanel
              extractedInvoice={extractedInvoice}
              extraction={extractedInvoice?.extraction}
              onFieldSelect={handleFieldSelect}
              correctionMutation={correctAmounts}
              extractionId={extractionId}
              onCorrected={onCorrected}
            />
          )}
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
