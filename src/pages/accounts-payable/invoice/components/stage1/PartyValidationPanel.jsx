import { useEffect, useState } from "react";
import { ArrowRight, Pencil } from "lucide-react";
import { toast } from "react-toastify";
import Button from "../../../../../components/Button/Button";
import FieldComparisonTable from "./FieldComparisonTable";
import FieldStatusLegend from "./FieldStatusLegend";
import EditableFieldForm from "./EditableFieldForm";
import { buildRawFieldKey, getFieldConfidence, getFieldLocation } from "../../utils/fieldLocation";
import { getApiErrorMessage } from "../../../utils/apiError";

const FIELD_LABELS = {
  name: "Name",
  legal_name: "Legal Name",
  trade_name: "Trade Name",
  gstin: "GSTIN",
  pan: "PAN",
  address: "Address",
  state: "State",
  state_code: "State Code",
};

/**
 * Vendor and Buyer validation share the same comparison fields, correction request shape, and
 * layout — one panel serves both (see `section`).
 *
 * Two distinct UIs depending on whether this stage actually ran:
 *  - It ran and produced field_comparisons -> the real match/mismatch comparison table, with a
 *    row selected to reveal a Before/After editor below (unchanged, existing behavior).
 *  - It was SKIPPED/never ran -> nothing to compare against yet, so this is just a plain editable
 *    form of the extracted fields (no confidence scores or match/mismatch badges — there's no
 *    verdict to show). Which branch renders can change across re-renders (e.g. once the user
 *    corrects Extraction and revalidation actually runs this stage), so every hook below is
 *    called unconditionally regardless of which branch ultimately renders.
 */
export default function PartyValidationPanel({
  section,
  title,
  extractedParty,
  stageState,
  extraction,
  selectedFieldKey,
  onFieldSelect,
  correctionMutation,
  extractionId,
  onCorrected,
  selectedRowRef,
}) {
  const comparisons = stageState?.field_comparisons || [];
  const hasComparisons = comparisons.length > 0;

  const rows = hasComparisons
    ? comparisons.map((comparison) => {
        const rawKey = buildRawFieldKey(section, comparison.field);
        return {
          key: comparison.field,
          field: comparison.field,
          rawKey,
          label: FIELD_LABELS[comparison.field] || comparison.field,
          extractedValue: comparison.extracted_value,
          masterValue: comparison.master_value,
          status: comparison.status,
          confidence: getFieldConfidence(extraction, rawKey),
          hasLocation: Boolean(getFieldLocation(extraction, rawKey)),
        };
      })
    : [];

  const selectedRow = rows.find((r) => r.rawKey === selectedFieldKey);

  const [draftValue, setDraftValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDraftValue(selectedRow?.extractedValue ?? "");
    // Only re-sync when the selected field itself changes — not on every extractedValue update —
    // so a correction response's merged value doesn't clobber the field the user is mid-edit on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRow?.rawKey]);

  const handleClearAll = () => setDraftValue(selectedRow?.extractedValue ?? "");

  const handleConfirm = async () => {
    if (!selectedRow) return;
    setSubmitting(true);
    try {
      const response = await correctionMutation.mutateAsync({ extractionId, patch: { [selectedRow.field]: draftValue } });
      toast.success(`${title} ${selectedRow.label} updated.`);
      onCorrected(section, response.updated, response.corrections || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Unable to update ${title.toLowerCase()} details.`));
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasComparisons) {
    const fields = Object.keys(FIELD_LABELS)
      .filter((field) => field !== "state_code" || extractedParty?.state_code != null)
      .map((field) => {
        const rawKey = buildRawFieldKey(section, field);
        return {
          name: field,
          label: FIELD_LABELS[field],
          value: extractedParty?.[field],
          rawKey,
          hasLocation: Boolean(getFieldLocation(extraction, rawKey)),
        };
      });

    return (
      <div>
        <p className="mb-3 text-sm text-gray-500">
          Correct any {title.toLowerCase()} field below, then save to re-run validation against the corrected values.
        </p>
        <EditableFieldForm
          fields={fields}
          onFieldFocus={(rawKey) => onFieldSelect(rawKey, rawKey ? getFieldLocation(extraction, rawKey) : null)}
          onSave={(patch) => correctionMutation.mutateAsync({ extractionId, patch })}
          onSaved={(response) => onCorrected(section, response.updated, response.corrections || [])}
          saveLabel={`Save ${title}`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-800">Extracted {title} Fields</h3>
        </div>
        <div className="p-4">
          <FieldComparisonTable
            rows={rows}
            selectedFieldKey={selectedFieldKey}
            onSelectField={(row) => onFieldSelect(row.rawKey, row.hasLocation ? getFieldLocation(extraction, row.rawKey) : null)}
            selectedRowRef={selectedRowRef}
          />
          <FieldStatusLegend />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Field Change (if any)</h3>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={!selectedRow}
            className="text-xs font-medium text-[#0A0082] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear All
          </button>
        </div>

        {!selectedRow ? (
          <p className="py-4 text-center text-sm text-gray-400">Select a field on the left to review or correct its value.</p>
        ) : (
          <>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-gray-500">BEFORE (Extracted)</label>
                <input
                  readOnly
                  value={selectedRow.extractedValue ?? ""}
                  className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-gray-700"
                />
              </div>
              <ArrowRight className="hidden h-5 w-5 shrink-0 text-gray-300 sm:block" aria-hidden="true" />
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-gray-500">AFTER (Verified)</label>
                <div className="relative">
                  <input
                    value={draftValue ?? ""}
                    onChange={(e) => setDraftValue(e.target.value)}
                    className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 pr-8 text-sm text-gray-800"
                  />
                  <Pencil className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-500" aria-hidden="true" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <Button variant="primary" size="small" onClick={handleConfirm} loading={submitting} loadingText="Saving...">
                Confirm &amp; Proceed <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="mt-2 text-right text-xs text-gray-400">Changes will be used for further validation.</p>
          </>
        )}
      </div>
    </div>
  );
}
