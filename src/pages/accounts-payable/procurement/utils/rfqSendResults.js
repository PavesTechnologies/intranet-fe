/**
 * Best-effort parser for whatever POST /apm/rfq/{id}/send returns. The frontend has no
 * confirmed contract for a per-vendor send result (the RFQ route may just return the updated
 * RFQ), so this only surfaces a per-vendor breakdown when the response actually contains one —
 * it never fabricates results. Recognizes a top-level array, or a `results`/`vendor_results`/
 * `send_results`/`email_results` array on an object response.
 * @param {unknown} responseData
 * @returns {Array<{ vendorId?: number|string, vendorName?: string, email?: string, success: boolean, message?: string }> | null}
 */
export function extractRfqSendResults(responseData) {
  const candidate = Array.isArray(responseData)
    ? responseData
    : responseData?.results ??
      responseData?.vendor_results ??
      responseData?.send_results ??
      responseData?.email_results ??
      null;

  if (!Array.isArray(candidate) || candidate.length === 0) return null;

  // Require every entry to look like a per-vendor send outcome (an id/email plus some kind of
  // status signal) before treating this as a recognized shape — otherwise fall through to the
  // plain success toast rather than rendering something misleading.
  const looksLikeVendorResult = candidate.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      (entry.vendor_id != null || entry.vendorId != null || entry.email != null) &&
      (entry.success != null || entry.sent != null || entry.status != null || entry.error != null),
  );
  if (!looksLikeVendorResult) return null;

  return candidate.map((entry) => {
    const status = typeof entry.status === "string" ? entry.status.toLowerCase() : null;
    const success =
      entry.success === true ||
      entry.sent === true ||
      status === "sent" ||
      status === "success" ||
      (entry.error == null && entry.success !== false && entry.sent !== false && status !== "failed" && status !== "error");

    return {
      vendorId: entry.vendor_id ?? entry.vendorId,
      vendorName: entry.vendor_name ?? entry.vendorName,
      email: entry.email,
      success,
      message: entry.error || entry.message || entry.detail || null,
    };
  });
}
