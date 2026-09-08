import EditableFieldForm from "./EditableFieldForm";

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
 * (only vendor/buyer/tax/amounts do) — nothing here is re-validated, so edits apply directly to
 * local pipeline state via `onCorrected`, no server round-trip and no revalidation triggered.
 *
 * Whether the invoice is created as PO or Non-PO is derived automatically from whether PO
 * Number is filled in (create_invoice: InvoiceType.PO if reference.po_number else NON_PO) —
 * there's no separate PO/Non-PO field to set directly, so this just shows the resulting type
 * as a label next to the PO Number field.
 */
export default function InvoiceDetailsPanel({ extractedInvoice, onCorrected }) {
  const sourceBySection = {
    document: extractedInvoice?.document || {},
    reference: extractedInvoice?.reference || {},
    payment: extractedInvoice?.payment || {},
  };

  const fields = FIELDS.map((f) => ({ ...f, value: sourceBySection[f.section]?.[f.name] }));
  const isPo = Boolean(sourceBySection.reference.po_number);

  const handleSave = async (patch) => {
    const bySection = {};
    Object.entries(patch).forEach(([name, value]) => {
      const section = FIELDS.find((f) => f.name === name)?.section;
      if (!section) return;
      bySection[section] = { ...(bySection[section] || {}), [name]: value };
    });
    return bySection;
  };

  const handleSaved = (bySection) => {
    Object.entries(bySection).forEach(([section, patch]) => onCorrected(section, patch));
  };

  return (
    <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Invoice Details</h3>
        <span className="text-xs font-medium text-gray-500">
          Type: <span className="text-gray-700">{isPo ? "PO" : "Non-PO"}</span> (set by whether PO Number is filled in)
        </span>
      </div>
      <EditableFieldForm fields={fields} onSave={handleSave} onSaved={handleSaved} saveLabel="Save Invoice Details" />
    </div>
  );
}
