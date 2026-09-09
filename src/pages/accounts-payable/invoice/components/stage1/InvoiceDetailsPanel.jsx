import FormInput from "../../../../../components/forms/FormInput";

const FIELDS = [
  { name: "invoice_number", label: "Invoice Number", section: "document" },
  { name: "invoice_date", label: "Invoice Date", section: "document", type: "date" },
  { name: "due_date", label: "Due Date", section: "document", type: "date" },
  { name: "currency", label: "Currency", section: "document" },
  { name: "po_number", label: "PO Number", section: "reference" },
  { name: "payment_terms", label: "Payment Terms", section: "payment" },
];

/**
 * Invoice Number / Invoice Date / Due Date / PO Number / Payment Terms / Currency — the
 * header-level fields actually persisted to the Invoice table (see
 * InvoiceExtractionService.create_invoice in the backend: invoice_number and invoice_date are
 * required there, due_date falls back to invoice_date, payment_terms/currency flow straight
 * through). None of these has a backend validation stage or correction endpoint of its own
 * (only vendor/buyer/tax/amounts do), so every field here is a plain controlled input that
 * writes straight into local pipeline state on change — no per-field "save", no round trip.
 * The single page-level Save Invoice button sends whatever is currently in state.
 *
 * Whether the invoice is created as PO or Non-PO is derived automatically from whether PO
 * Number is filled in (create_invoice: InvoiceType.PO if reference.po_number else NON_PO) —
 * there's no separate PO/Non-PO field to set directly, so this just shows the resulting type
 * as a label next to the PO Number field.
 */
export default function InvoiceDetailsPanel({ extractedInvoice, onFieldChange }) {
  const sourceBySection = {
    document: extractedInvoice?.document || {},
    reference: extractedInvoice?.reference || {},
    payment: extractedInvoice?.payment || {},
  };
  const isPo = Boolean(sourceBySection.reference.po_number);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Invoice Details</h3>
        <span className="text-xs font-medium text-gray-500">
          Type: <span className="text-gray-700">{isPo ? "PO" : "Non-PO"}</span>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <FormInput
            key={field.name}
            type={field.type || "text"}
            label={field.label}
            name={field.name}
            value={sourceBySection[field.section]?.[field.name] ?? ""}
            onChange={(e) => onFieldChange(field.section, field.name, e.target.value)}
          />
        ))}
      </div>
    </div>
  );
}
