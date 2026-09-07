import { useEffect, useRef, useState } from "react";
import Stage1Header from "./Stage1Header";
import PartyValidationPanel from "./PartyValidationPanel";
import GstTaxValidationPanel from "./GstTaxValidationPanel";
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
 */
export default function Stage1ReviewSection({ extractedInvoice, stages, extractionId, fileUrl, originalFilename, onCorrected }) {
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
  // manually picks a stepper item, then stop overriding their choice.
  useEffect(() => {
    if (manualTab) return;
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

  const showConnector = activeTab === "vendor" || activeTab === "buyer";

  return (
    <div>
      <Stage1Header stages={stages} activeTab={activeTab} onSelectStage={handleSelectStage} />

      <div ref={gridRef} className="relative grid grid-cols-1 gap-6 lg:grid-cols-[44%_1fr]">
        <div>
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
