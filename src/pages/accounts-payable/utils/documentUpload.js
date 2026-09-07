// src/pages/accounts-payable/utils/documentUpload.js
/**
 * Shared helpers for the AP Vendor PO/GRN document upload feature — file validation and
 * blob view/download utilities used by VendorPoTab, VendorGrnTab, and VendorDocumentUploadModal.
 * Mirrors the validation rules already used by InvoiceUploadPage
 * (src/pages/accounts-payable/invoice/pages/InvoiceUploadPage.jsx) so PO/GRN documents follow
 * the same accepted types/size limit as invoices rather than inventing new restrictions.
 */

export const ACCEPTED_DOCUMENT_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];
export const ACCEPTED_DOCUMENT_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function getExtension(fileName) {
  const index = fileName.lastIndexOf(".");
  return index === -1 ? "" : fileName.slice(index).toLowerCase();
}

/** @param {File} file @returns {string} empty string if valid, otherwise a user-facing error message */
export function validateDocumentFile(file) {
  if (!file) return "Please select a file to upload.";
  const extension = getExtension(file.name);
  if (!ACCEPTED_DOCUMENT_MIME_TYPES.includes(file.type) && !ACCEPTED_DOCUMENT_EXTENSIONS.includes(extension)) {
    return "Unsupported file type. Please upload a PDF, PNG, JPG, or JPEG file.";
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return "File is too large. Maximum size is 10MB.";
  }
  return "";
}

export function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
}

/** Parses a filename out of a Content-Disposition header, if the backend sends one. */
export function extractFileNameFromContentDisposition(header, fallback = null) {
  if (!header) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^;"]+)/i.exec(header);
  return match ? decodeURIComponent(match[1].replace(/"/g, "")) : fallback;
}

/** Opens a blob in a new tab (View Document) — same pattern as InvoiceAttachmentList.handleView. */
export function openBlobInNewTab(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // Don't revoke immediately — the new tab still needs the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Triggers a browser download of a blob (Download Document) — same pattern as InvoiceDocumentViewer. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "document";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * The backend response shape for the document metadata on a PO/GRN record isn't documented yet,
 * so this defensively checks a few likely field name conventions in addition to the just-uploaded
 * local override — keeping "document available" detection honest whether or not the list/detail
 * endpoint has caught up to reflect the new document.
 * @param {Object} record - a purchase order or goods receipt row from the API
 * @param {{fileName?: string}} [localOverride] - set immediately after a successful upload in this
 *   session, before the list query has necessarily refetched
 */
export function getDocumentAvailability(record = {}, localOverride = null) {
  if (localOverride) {
    return { available: true, fileName: localOverride.fileName || null };
  }

  const fileName =
    record.document_file_name || record.file_name || record.document_name || record.filename || null;

  const available = Boolean(
    fileName ||
      record.has_document ||
      record.document_available ||
      record.document_uploaded ||
      record.document_path ||
      record.document_url,
  );

  return { available, fileName };
}
