const TAX_CODES = ["cgst", "sgst", "igst", "ugst", "cess"];

const FIELD_LABEL_OVERRIDES = {
  tax_type: "Tax Type",
  place_of_supply: "Place of Supply",
  hsn_sac: "HSN / SAC",
  reverse_charge: "Reverse Charge",
  total_tax: "Total Tax",
  total_tax_line_reconciliation: "Total Tax (Line Reconciliation)",
};

/** "line_2.igst_amount" -> "Line 2 · IGST Amount"; "cgst_rate" -> "CGST Rate"; falls back to a title-cased field name. */
export function formatGstFieldLabel(field) {
  if (!field) return "";
  if (FIELD_LABEL_OVERRIDES[field]) return FIELD_LABEL_OVERRIDES[field];

  const lineMatch = field.match(/^line_(\d+)\.(.+)$/);
  const bareField = lineMatch ? lineMatch[2] : field;
  const label =
    FIELD_LABEL_OVERRIDES[bareField] ||
    bareField
      .split("_")
      .map((part) => (TAX_CODES.includes(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(" ");

  return lineMatch ? `Line ${lineMatch[1]} · ${label}` : label;
}

/**
 * Builds one "GST Calculation Verification" card per tax code (cgst/sgst/igst/ugst/cess) that has
 * a header-level rate and/or amount comparison in `field_comparisons`. Only re-formats numbers the
 * backend already returned (taxable amount, extracted/master rate & amount) — the MATCH/MISMATCH
 * verdict always comes straight from the backend comparison's own `status`, never recomputed here.
 *
 * @param {Array} fieldComparisons - stages.gst.field_comparisons
 * @param {Object} amounts - extracted_invoice.amounts
 * @returns {Array<{code: string, label: string, taxableAmount: number|null, rate: {extracted, master, status}|null, amount: {extracted, master, status, difference: number|null}|null}>}
 */
export function buildGstCalculationCards(fieldComparisons, amounts) {
  const byField = new Map((fieldComparisons || []).map((c) => [c.field, c]));

  return TAX_CODES.map((code) => {
    const rateComparison = byField.get(`${code}_rate`);
    const amountComparison = byField.get(`${code}_amount`);
    if (!rateComparison && !amountComparison) return null;

    const extractedAmount = amountComparison?.extracted_value != null ? Number(amountComparison.extracted_value) : null;
    const masterAmount = amountComparison?.master_value != null ? Number(amountComparison.master_value) : null;
    const difference =
      extractedAmount != null && masterAmount != null && !Number.isNaN(extractedAmount) && !Number.isNaN(masterAmount)
        ? extractedAmount - masterAmount
        : null;

    return {
      code,
      label: `${code.toUpperCase()}`,
      taxableAmount: typeof amounts?.taxable_amount === "number" ? amounts.taxable_amount : null,
      rate: rateComparison
        ? { extracted: rateComparison.extracted_value, master: rateComparison.master_value, status: rateComparison.status }
        : null,
      amount: amountComparison
        ? { extracted: amountComparison.extracted_value, master: amountComparison.master_value, status: amountComparison.status, difference }
        : null,
    };
  }).filter(Boolean);
}

const SUPPLY_TYPE_LABELS = [
  { match: "INTRA", supplyType: "Intra-State", expectedTax: "CGST + SGST" },
  { match: "INTER", supplyType: "Inter-State", expectedTax: "IGST" },
];

function resolveSupplyTypeLabels(expectedTaxTypeCode) {
  const found = SUPPLY_TYPE_LABELS.find((entry) => (expectedTaxTypeCode || "").includes(entry.match));
  return found || { supplyType: expectedTaxTypeCode || "Unknown", expectedTax: expectedTaxTypeCode || "Unknown" };
}

const RULE_RESULT_LABELS = {
  MATCH: "Valid",
  MISMATCH: "Invalid",
  MISSING_EXTRACTED: "Unable to verify — not found on invoice",
  MISSING_MASTER: "Unable to verify — no expected value",
  NOT_COMPARED: "Not compared",
};

/**
 * Reconstructs the "Tax Rule Validation" flow purely by relabeling the single backend `tax_type`
 * comparison (whose master_value already encodes both the expected supply type and tax type, e.g.
 * "INTRA_STATE_CGST_SGST") plus vendor/buyer/tax fields already in the extraction response. No new
 * GST rule logic is introduced — the Rule Result is a direct relabel of the comparison's `status`.
 *
 * @param {Array} fieldComparisons - stages.gst.field_comparisons
 * @param {Object} extractedInvoice - ExtractedInvoiceResponse (vendor/buyer/tax)
 * @returns {null | {vendorState, placeOfSupply, supplyType, expectedTax, invoiceTax, ruleResult, status}}
 */
export function buildTaxRuleFlow(fieldComparisons, extractedInvoice) {
  const taxTypeComparison = (fieldComparisons || []).find((c) => c.field === "tax_type");
  if (!taxTypeComparison) return null;

  const placeOfSupplyComparison = (fieldComparisons || []).find((c) => c.field === "place_of_supply");
  const { supplyType, expectedTax } = resolveSupplyTypeLabels(taxTypeComparison.master_value);

  return {
    vendorState: extractedInvoice?.vendor?.state || null,
    placeOfSupply: placeOfSupplyComparison?.extracted_value || extractedInvoice?.tax?.place_of_supply || null,
    supplyType,
    expectedTax,
    invoiceTax: taxTypeComparison.extracted_value || null,
    ruleResult: RULE_RESULT_LABELS[taxTypeComparison.status] || taxTypeComparison.status,
    status: taxTypeComparison.status,
  };
}
