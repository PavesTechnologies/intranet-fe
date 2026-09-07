import React, { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, FileText, Image as ImageIcon, Eye, Download, Trash2, Loader2 } from "lucide-react";
import Button from "@/components/Button/Button";
import ConfirmationModal from "@/components/confirmation_modal/ConfirmationModal";
import { useAuth } from "@/contexts/AuthContext";
import { showStatusToast } from "@/components/toastfy/toast";
import { receiptService } from "@/pages/expense-management/api/expenseReportsApi";

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
};

const isImageFile = (fileName = "") => /\.(png|jpe?g|gif|webp|heic)$/i.test(fileName);

const extractUrl = (data) => {
  if (!data) return null;
  if (typeof data === "string") return data;
  return data.url || data.viewUrl || data.downloadUrl || data.presignedUrl || null;
};

/**
 * Drag-and-drop receipt upload + management for a single expense line item.
 * No dropzone library exists in this repo (only a bare FileUpload input), so
 * drag/drop handlers are hand-rolled over a native file input, matching
 * FileUpload.jsx's styling conventions.
 */
export default function ReceiptDropzone({ lineItemId }) {
  const { hasRole } = useAuth();
  const canManage = hasRole(["General", "Manager"]);

  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]); // [{name, progress}]
  const [receiptToDelete, setReceiptToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef(null);

  const fetchReceipts = useCallback(async () => {
    if (!lineItemId) return;
    try {
      setLoading(true);
      const res = await receiptService.getAll(lineItemId);
      const list = Array.isArray(res.data) ? res.data : res.data?.receipts || res.data?.content || res.data?.data || [];
      setReceipts(list);
    } catch (err) {
      console.error("Failed to fetch receipts:", err);
    } finally {
      setLoading(false);
    }
  }, [lineItemId]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const uploadFiles = async (files) => {
    if (!lineItemId || !files?.length) return;
    for (const file of Array.from(files)) {
      setUploadingFiles((prev) => [...prev, { name: file.name, progress: 0 }]);
      const formData = new FormData();
      formData.append("file", file);
      try {
        await receiptService.upload(lineItemId, formData, (evt) => {
          if (!evt.total) return;
          const progress = Math.round((evt.loaded / evt.total) * 100);
          setUploadingFiles((prev) =>
            prev.map((f) => (f.name === file.name ? { ...f, progress } : f))
          );
        });
        showStatusToast(`Receipt "${file.name}" uploaded successfully!`, "success");
      } catch (err) {
        console.error("Failed to upload receipt:", err);
        const errMsg = err.response?.data?.message || err.response?.data?.detail || `Failed to upload "${file.name}".`;
        showStatusToast(errMsg, "error");
      } finally {
        setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
      }
    }
    fetchReceipts();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canManage) return;
    uploadFiles(e.dataTransfer.files);
  };

  const handleView = async (receipt) => {
    try {
      const res = await receiptService.getViewUrl(receipt.receiptId);
      const url = extractUrl(res.data);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showStatusToast("Failed to open receipt preview.", "error");
    }
  };

  const handleDownload = async (receipt) => {
    try {
      const res = await receiptService.getDownloadUrl(receipt.receiptId);
      const url = extractUrl(res.data);
      if (url) {
        const link = document.createElement("a");
        link.href = url;
        link.download = receipt.fileName || "receipt";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      showStatusToast("Failed to download receipt.", "error");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!receiptToDelete) return;
    try {
      setDeleting(true);
      await receiptService.delete(receiptToDelete.receiptId);
      showStatusToast("Receipt deleted successfully!", "success");
      setReceiptToDelete(null);
      fetchReceipts();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to delete receipt.";
      showStatusToast(errMsg, "error");
    } finally {
      setDeleting(false);
    }
  };

  if (!lineItemId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-xs text-gray-400">Save the line item first to attach receipts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition ${
            isDragging ? "border-[#0A0082] bg-indigo-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
          }`}
        >
          <UploadCloud className={isDragging ? "text-[#0A0082]" : "text-gray-400"} size={22} />
          <p className="text-xs font-medium text-gray-600">
            Drag &amp; drop a receipt, or <span className="text-[#0A0082] font-semibold">browse</span>
          </p>
          <p className="text-[10px] text-gray-400">PDF, PNG, JPG up to 10MB</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
            onChange={(e) => {
              uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {uploadingFiles.map((f) => (
        <div key={f.name} className="rounded-lg border border-gray-200 bg-white p-2.5">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="truncate text-gray-600 font-medium">{f.name}</span>
            <span className="text-gray-400">{f.progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#0A0082] transition-all duration-200"
              style={{ width: `${f.progress}%` }}
            />
          </div>
        </div>
      ))}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 className="animate-spin" size={18} />
        </div>
      ) : receipts.length === 0 ? (
        <p className="text-center text-xs text-gray-400 py-2">No receipts uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {receipts.map((r) => (
            <div
              key={r.receiptId}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5 hover:border-gray-300 hover:shadow-sm transition"
            >
              <div className="shrink-0 p-2 rounded-lg bg-blue-50 text-blue-600">
                {isImageFile(r.fileName) ? <ImageIcon size={16} /> : <FileText size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800 truncate">{r.fileName || "Receipt"}</p>
                <p className="text-[10px] text-gray-400">
                  {formatFileSize(r.fileSize)} &bull; {formatDate(r.uploadedAt)}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  type="button"
                  variant="link"
                  size="icon"
                  title="View Receipt"
                  className="h-7 w-7 p-0 text-gray-600 hover:bg-gray-100 rounded-md"
                  onClick={() => handleView(r)}
                >
                  <Eye size={14} />
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="icon"
                  title="Download Receipt"
                  className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50 rounded-md"
                  onClick={() => handleDownload(r)}
                >
                  <Download size={14} />
                </Button>
                {canManage && (
                  <Button
                    type="button"
                    variant="link"
                    size="icon"
                    title="Delete Receipt"
                    className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 rounded-md"
                    onClick={() => setReceiptToDelete(r)}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!receiptToDelete}
        title="Delete Receipt"
        message={`Are you sure you want to delete the receipt "${receiptToDelete?.fileName}"? This action cannot be undone.`}
        confirmText="Delete Receipt"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setReceiptToDelete(null)}
        isLoading={deleting}
        variant="danger"
      />
    </div>
  );
}
