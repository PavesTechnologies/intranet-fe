import { useState } from "react";
import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";
import Button from "../../../../../components/Button/Button";
import FieldComparisonTable from "./FieldComparisonTable";
import FieldStatusBadge from "./FieldStatusBadge";
import TaxCorrectionModal from "./TaxCorrectionModal";
import AmountsCorrectionModal from "./AmountsCorrectionModal";
import { buildRawFieldKey, getFieldConfidence, getFieldLocation } from "../../utils/fieldLocation";
import { buildGstCalculationCards, buildTaxRuleFlow, formatGstFieldLabel } from "../../utils/gstPresentation";

const TAX_FIELD_NAMES = new Set(["place_of_supply", "reverse_charge", "tax_type", "hsn_sac", "cgst_rate", "sgst_rate", "igst_rate", "ugst_rate", "cess_rate"]);
const AMOUNT_FIELD_NAMES = new Set(["subtotal", "taxable_amount", "discount", "cgst_amount", "sgst_amount", "igst_amount", "ugst_amount", "cess_amount", "total_tax", "grand_total"]);

const BANNER_TONE = {
  emerald: { className: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: CheckCircle2 },
  red: { className: "border-red-200 bg-red-50 text-red-800", Icon: XCircle },
  gray: { className: "border-gray-200 bg-gray-50 text-gray-700", Icon: AlertTriangle },
};

function resolveGstBanner(stageState) {
  if (!stageState || stageState.status === "WAITING") return null;
  if (stageState.status === "RUNNING") return { tone: "gray", title: "Validating GST tax details..." };
  if (stageState.status === "SUCCESS") return { tone: "emerald", title: "GST Tax Validation Complete" };
  if (stageState.status === "FAILED") return { tone: "red", title: "GST Tax Validation Failed" };
  if (stageState.status === "SKIPPED") return { tone: "gray", title: "GST Tax Validation Skipped" };
  return null;
}

/**
 * Fields Verification + Calculation Verification + Tax Rule Validation, all derived from
 * `stages.gst.field_comparisons` (see utils/gstPresentation.js — pure re-formatting, no new
 * validation logic; every MATCH/MISMATCH verdict comes straight from the backend comparison).
 */
export default function GstTaxValidationPanel({
  extractedInvoice,
  stageState,
  extraction,
  selectedFieldKey,
  onFieldSelect,
  taxCorrectionMutation,
  amountsCorrectionMutation,
  extractionId,
  onCorrected,
}) {
  const [activeModal, setActiveModal] = useState(null); // "tax" | "amounts" | null
  const [lastCorrection, setLastCorrection] = useState(null);

  const comparisons = stageState?.field_comparisons || [];

  const rows = comparisons.map((comparison) => {
    const rawKey = buildRawFieldKey("gst", comparison.field);
    const isLineLevel = comparison.field.startsWith("line_");
    const correctAs = !isLineLevel && TAX_FIELD_NAMES.has(comparison.field) ? "tax" : !isLineLevel && AMOUNT_FIELD_NAMES.has(comparison.field) ? "amounts" : null;

    return {
      key: comparison.field,
      rawKey,
      label: formatGstFieldLabel(comparison.field),
      extractedValue: comparison.extracted_value,
      masterValue: comparison.master_value,
      status: comparison.status,
      confidence: getFieldConfidence(extraction, rawKey),
      hasLocation: Boolean(getFieldLocation(extraction, rawKey)),
      correctable: Boolean(correctAs),
      correctAs,
    };
  });

  const calculationCards = buildGstCalculationCards(comparisons, extractedInvoice?.amounts);
  const taxRuleFlow = buildTaxRuleFlow(comparisons, extractedInvoice);
  const banner = resolveGstBanner(stageState);
  const selectedRow = rows.find((r) => r.rawKey === selectedFieldKey);

  const handleCorrect = (row) => setActiveModal(row.correctAs);

  const handleCorrected = (section, response) => {
    setLastCorrection({ section, corrections: response.corrections || [] });
    onCorrected(section, response.updated, response.corrections || []);
  };

  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-4">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">GST Fields Verification</h3>

        {lastCorrection && lastCorrection.corrections.length > 0 && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-semibold">Correction applied</p>
              <button type="button" onClick={() => setLastCorrection(null)} aria-label="Dismiss">
                <X className="h-3.5 w-3.5 text-emerald-700" />
              </button>
            </div>
            <ul className="space-y-0.5">
              {lastCorrection.corrections.map((c, index) => (
                <li key={index}>
                  <span className="font-medium">{c.field}</span>: "{c.before ?? "—"}" → "{c.after ?? "—"}"
                </li>
              ))}
            </ul>
          </div>
        )}

        <FieldComparisonTable
          compareLabel="Invoice Value"
          rows={rows}
          selectedFieldKey={selectedFieldKey}
          onSelectField={(row) => onFieldSelect(row.rawKey, row.hasLocation ? getFieldLocation(extraction, row.rawKey) : null)}
          onCorrect={handleCorrect}
        />

        {selectedRow && !selectedRow.hasLocation && (
          <p className="mt-2 text-xs text-gray-400">No document location available for "{selectedRow.label}".</p>
        )}
      </div>

      {calculationCards.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">GST Calculation Verification</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {calculationCards.map((card) => (
              <div key={card.code} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{card.label}</span>
                  {card.amount && <FieldStatusBadge status={card.amount.status} />}
                </div>
                {card.taxableAmount != null && (
                  <p className="text-xs text-gray-500">
                    Taxable Amount: <span className="font-mono text-gray-700">{card.taxableAmount}</span>
                  </p>
                )}
                {card.rate && (
                  <p className="text-xs text-gray-500">
                    Rate — Extracted: <span className="font-mono text-gray-700">{card.rate.extracted ?? "—"}</span>
                    {" · "}Expected: <span className="font-mono text-gray-700">{card.rate.master ?? "—"}</span>
                  </p>
                )}
                {card.amount && (
                  <>
                    <p className="mt-1 text-xs text-gray-500">
                      Invoice Amount: <span className="font-mono text-gray-700">{card.amount.extracted ?? "—"}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Expected Amount: <span className="font-mono text-gray-700">{card.amount.master ?? "—"}</span>
                    </p>
                    {card.amount.difference != null && (
                      <p className="text-xs text-gray-500">
                        Difference: <span className="font-mono text-gray-700">{card.amount.difference.toFixed(2)}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {taxRuleFlow && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Tax Rule Validation</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {[
              ["Vendor State", taxRuleFlow.vendorState],
              ["Place of Supply", taxRuleFlow.placeOfSupply],
              ["Supply Type", taxRuleFlow.supplyType],
              ["Expected Tax", taxRuleFlow.expectedTax],
              ["Invoice Tax", taxRuleFlow.invoiceTax],
            ].map(([label, value], index) => (
              <span key={label} className="flex items-center gap-2">
                {index > 0 && <span className="text-gray-300">→</span>}
                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
                  {label}: <span className="font-medium">{value ?? "—"}</span>
                </span>
              </span>
            ))}
            <span className="text-gray-300">→</span>
            <FieldStatusBadge status={taxRuleFlow.status} />
            <span className="text-xs text-gray-500">{taxRuleFlow.ruleResult}</span>
          </div>
        </div>
      )}

      {banner && (
        <div className={`rounded-lg border p-3 ${BANNER_TONE[banner.tone].className}`}>
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = BANNER_TONE[banner.tone].Icon;
              return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
            })()}
            <p className="text-sm font-semibold">{banner.title}</p>
          </div>
          {stageState?.issues?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {stageState.issues.map((issue, index) => (
                <li key={index} className="text-sm">
                  • {issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeModal === "tax" && (
        <TaxCorrectionModal
          isOpen
          onClose={() => setActiveModal(null)}
          currentValues={extractedInvoice?.tax}
          onSubmit={(patch) => taxCorrectionMutation.mutateAsync({ extractionId, patch })}
          onCorrected={(response) => {
            handleCorrected("tax", response);
            setActiveModal(null);
          }}
        />
      )}

      {activeModal === "amounts" && (
        <AmountsCorrectionModal
          isOpen
          onClose={() => setActiveModal(null)}
          currentValues={extractedInvoice?.amounts}
          onSubmit={(patch) => amountsCorrectionMutation.mutateAsync({ extractionId, patch })}
          onCorrected={(response) => {
            handleCorrected("amounts", response);
            setActiveModal(null);
          }}
        />
      )}
    </div>
  );
}
