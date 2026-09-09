import FormInput from "../../../../../components/forms/FormInput";
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
 * Plain editable amounts form — no confidence scores or match/mismatch badges, since Extraction
 * Validation is a holistic reconciliation check (not a per-field comparison against master
 * data), so there's no per-field verdict to show. Every field writes straight into local
 * pipeline state on change; the single page-level Save Invoice button sends whatever is
 * currently in state. Focusing a field highlights its location in the document when known.
 */
export default function InvoiceAmountsSection({ extractedInvoice, extraction, onFieldFocus, onFieldChange }) {
  const amounts = extractedInvoice?.amounts || {};

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-800">Amounts</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {AMOUNT_FIELDS.map((field) => {
          const rawKey = buildRawFieldKey("gst", field.name);
          const hasLocation = Boolean(getFieldLocation(extraction, rawKey));
          return (
            <FormInput
              key={field.name}
              type="number"
              label={field.label}
              name={field.name}
              value={amounts[field.name] ?? ""}
              onChange={(e) => onFieldChange("amounts", field.name, e.target.value)}
              onFocus={hasLocation ? () => onFieldFocus(rawKey) : undefined}
              onBlur={hasLocation ? () => onFieldFocus(null) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
