import EditableFieldForm from "./EditableFieldForm";
import { buildRawFieldKey, getFieldLocation } from "../../utils/fieldLocation";

const AMOUNT_FIELDS = [
  { name: "subtotal", label: "Subtotal" },
  { name: "taxable_amount", label: "Taxable Amount" },
  { name: "discount", label: "Discount" },
  { name: "cgst_amount", label: "CGST Amount" },
  { name: "sgst_amount", label: "SGST Amount" },
  { name: "igst_amount", label: "IGST Amount" },
  { name: "ugst_amount", label: "UGST Amount" },
  { name: "cess_amount", label: "Cess Amount" },
  { name: "total_tax", label: "Total Tax" },
  { name: "grand_total", label: "Grand Total" },
];

/**
 * Shown in place of the Vendor/Buyer/GST panels when Extraction Validation itself fails — that
 * stage never produces field_comparisons (it's a holistic reconciliation check, not a per-field
 * match against master data), so there's nothing to show a match/mismatch verdict for. Just a
 * plain editable form of the extracted amounts; focusing a field highlights it in the document
 * when a location is known.
 */
export default function ExtractionAmountsPanel({
  extractedInvoice,
  extraction,
  onFieldSelect,
  correctionMutation,
  extractionId,
  onCorrected,
}) {
  const amounts = extractedInvoice?.amounts || {};

  const fields = AMOUNT_FIELDS.map((field) => {
    const rawKey = buildRawFieldKey("gst", field.name); // no "line_N." prefix on header amounts -> unchanged
    return {
      name: field.name,
      label: field.label,
      value: amounts[field.name],
      type: "number",
      rawKey,
      hasLocation: Boolean(getFieldLocation(extraction, rawKey)),
    };
  });

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500">
        Correct any amount below, then save to re-run validation against the corrected values.
      </p>
      <EditableFieldForm
        fields={fields}
        onFieldFocus={(rawKey) => onFieldSelect(rawKey, rawKey ? getFieldLocation(extraction, rawKey) : null)}
        onSave={(patch) => correctionMutation.mutateAsync({ extractionId, patch })}
        onSaved={(response) => onCorrected("amounts", response.updated, response.corrections || [])}
        saveLabel="Save Amounts"
      />
    </div>
  );
}
