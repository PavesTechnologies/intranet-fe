/**
 * Maps a Stage 1 field comparison (as returned in validate-fields status
 * `stages.<stage>.field_comparisons[].field`, e.g. "gstin", "line_2.igst_amount")
 * back to the raw extraction key used in the /extract-fields response's
 * `extraction.field_details` / `extraction.field_confidence` maps (e.g.
 * "vendor_gstin", "igst_amount"). The two use different naming conventions
 * because the comparison list is produced by the validation stage while
 * field_details is produced by the raw Textract extraction step.
 *
 * Only vendor/buyer comparisons are section-prefixed (name -> vendor_name);
 * GST comparisons that carry a per-line prefix ("line_2.igst_amount") fall
 * back to the header-level key ("igst_amount") since only header-level
 * bounding boxes exist in field_details today.
 *
 * @param {"vendor"|"buyer"|"gst"} section
 * @param {string} comparisonField
 * @returns {string}
 */
export function buildRawFieldKey(section, comparisonField) {
  if (!comparisonField) return "";

  if (section === "vendor" || section === "buyer") {
    return `${section}_${comparisonField}`;
  }

  // GST comparisons: strip a "line_N." prefix, keep the bare tax-code/field name.
  const dotIndex = comparisonField.indexOf(".");
  return dotIndex === -1 ? comparisonField : comparisonField.slice(dotIndex + 1);
}

/**
 * @param {Object} extraction - ExtractedInvoiceResponse.extraction
 * @param {string} rawKey
 * @returns {{page: number, left: number, top: number, width: number, height: number} | null}
 */
export function getFieldLocation(extraction, rawKey) {
  const box = extraction?.field_details?.[rawKey]?.bounding_box;
  if (!box) return null;
  return box;
}

/**
 * @param {Object} extraction - ExtractedInvoiceResponse.extraction
 * @param {string} rawKey
 * @returns {number | null}
 */
export function getFieldConfidence(extraction, rawKey) {
  const fromDetails = extraction?.field_details?.[rawKey]?.confidence;
  if (typeof fromDetails === "number") return fromDetails;
  const fromMap = extraction?.field_confidence?.[rawKey];
  return typeof fromMap === "number" ? fromMap : null;
}
