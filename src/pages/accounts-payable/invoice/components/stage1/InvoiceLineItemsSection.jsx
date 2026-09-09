const COLUMNS = [
  { name: "description", label: "Description", type: "text", width: "min-w-[180px]" },
  { name: "hsn_sac", label: "HSN/SAC", type: "text", width: "w-24" },
  { name: "quantity", label: "Qty", type: "number", width: "w-20" },
  { name: "unit", label: "Unit", type: "text", width: "w-20" },
  { name: "unit_price", label: "Unit Price", type: "number", width: "w-28" },
  { name: "taxable_amount", label: "Taxable Amount", type: "number", width: "w-28" },
  { name: "total_tax", label: "Tax Amount", type: "number", width: "w-28" },
  { name: "line_total", label: "Line Total", type: "number", width: "w-28" },
];

const cellClass =
  "w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 outline-none transition focus:border-[#0A0082] focus:ring-1 focus:ring-[#0A0082]/30";

/**
 * Editable table of the extracted invoice_lines — the same shape sent to /create-invoice's
 * invoice_lines (see InvoiceLineRequest in the backend: description, hsn_sac, quantity, unit,
 * unit_price, taxable_amount, tax_amount, line_amount). No backend correction endpoint exists
 * for lines any more than for the header fields above, so every cell writes straight into local
 * pipeline state on change — nothing here is re-validated, the single page-level Save Invoice
 * button just sends whatever is currently in state.
 */
export default function InvoiceLineItemsSection({ lines, onLineChange }) {
  if (!lines || lines.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-800">Line Items</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {COLUMNS.map((col) => (
                <th key={col.name} className={`border-b border-gray-200 px-2 py-2 text-left ${col.width}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.line_number ?? index} className="border-b border-gray-100 last:border-0">
                {COLUMNS.map((col) => (
                  <td key={col.name} className="px-2 py-1.5">
                    <input
                      type={col.type}
                      value={line[col.name] ?? ""}
                      onChange={(e) => onLineChange(index, col.name, e.target.value)}
                      className={cellClass}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
