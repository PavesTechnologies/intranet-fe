import { useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import Modal from "../../../../components/Modal/modal";
import Button from "../../../../components/Button/Button";
import { validateDocumentFile, formatFileSize, ACCEPTED_DOCUMENT_EXTENSIONS } from "../../utils/documentUpload";

/**
 * Reusable "Upload Document" modal for the AP Vendor PO/GRN document upload feature — used by
 * VendorPoTab (Upload PO Document) and VendorGrnTab (Upload GRN Document) as an additional option
 * alongside the existing manual-entry Add PO / Add GRN flow, not a replacement for it.
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {string} title
 * @param {(file: File) => Promise<void>} onUpload - rejecting keeps the selected file so the user can retry
 * @param {boolean} isUploading
 */
export default function VendorDocumentUploadModal({ isOpen, onClose, title, onUpload, isUploading = false }) {
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setSelectedFile(null);
    setError("");
    setIsDragging(false);
  };

  const handleClose = () => {
    if (isUploading) return; // prevent closing mid-upload
    reset();
    onClose();
  };

  const handleFileSelected = (file) => {
    if (!file) return;
    const validationError = validateDocumentFile(file);
    setError(validationError);
    setSelectedFile(validationError ? null : file);
  };

  const handleInputChange = (e) => {
    handleFileSelected(e.target.files?.[0]);
    e.target.value = ""; // allow re-selecting the same file after Remove
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelected(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError("Please select a file to upload.");
      return;
    }
    try {
      await onUpload(selectedFile);
      reset();
    } catch {
      // caller already surfaced a toast — keep the file selected so the user can retry
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="lg"
      closeOnBackdrop={!isUploading}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isUploading}
            loadingText="Uploading..."
            disabled={!selectedFile || Boolean(error)}
          >
            Upload
          </Button>
        </div>
      }
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? "border-[#0A0082] bg-[#0A0082]/5" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <UploadCloud className="h-8 w-8 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">Drag &amp; drop the document here, or click to browse</p>
        <p className="text-xs text-gray-500">Supported: PDF, PNG, JPG, JPEG · Max 10MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_DOCUMENT_EXTENSIONS.join(",")}
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {selectedFile && !error && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-[#0A0082]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            className="shrink-0 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Remove selected file"
            disabled={isUploading}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </Modal>
  );
}
