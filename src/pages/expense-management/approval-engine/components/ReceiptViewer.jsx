import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Maximize2, Minimize2, Receipt, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { receiptService } from "@/pages/expense-management/api/expenseReportsApi";

const isImageFile = (fileName = "") => /\.(png|jpe?g|gif|webp|heic)$/i.test(fileName);
const isPdfFile = (fileName = "") => /\.pdf$/i.test(fileName);

const extractUrl = (data) => {
  if (!data) return null;
  if (typeof data === "string") return data;
  const target = data.data || data;
  return target.url || target.viewUrl || target.downloadUrl || target.presignedUrl || null;
};

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <div className="rounded-full bg-gray-100 p-4 text-gray-400">
        <Receipt className="h-8 w-8" />
      </div>
      <p className="text-sm font-medium text-gray-600">No receipt attached</p>
      <p className="text-xs text-gray-400">This line item has no receipt uploaded yet.</p>
    </div>
  );
}

function ReceiptSurface({ receipt, url, zoom }) {
  if (!url) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-gray-400">
        Failed to load this receipt.
      </div>
    );
  }
  if (isPdfFile(receipt.fileName)) {
    return <iframe title={receipt.fileName || "Receipt"} src={url} className="h-full w-full border-0 bg-white" />;
  }
  const isFit = zoom <= 1;
  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
      <img
        src={url}
        alt={receipt.fileName || "Receipt"}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          maxWidth: isFit ? "100%" : "none",
          maxHeight: isFit ? "100%" : "none",
        }}
        className={`${isFit ? "object-contain" : "max-w-none"} transition-transform duration-150 shadow-sm`}
      />
    </div>
  );
}

/**
 * Left-pane document viewer for the expense review panel. Reuses the same receipt endpoints
 * ReceiptDropzone.jsx already calls (receiptService.getAll / getViewUrl); this component just adds
 * the read-focused chrome (zoom, fit, fullscreen, multi-receipt switcher) that an approver needs
 * but the employee-facing dropzone doesn't. "Fullscreen" is an in-app fixed overlay rather than the
 * native Fullscreen API, since PDFs render in an <iframe> and cross-origin iframe fullscreen
 * permission prompts are unreliable across browsers.
 */
export default function ReceiptViewer({ lineItemId }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: receipts, isLoading } = useQuery({
    queryKey: ["expenseLineItemReceipts", lineItemId],
    queryFn: async () => {
      const res = await receiptService.getAll(lineItemId);
      return Array.isArray(res.data) ? res.data : res.data?.receipts || res.data?.content || res.data?.data || [];
    },
    enabled: !!lineItemId,
    staleTime: 60_000,
  });

  useEffect(() => {
    setActiveIndex(0);
    setZoom(1);
  }, [lineItemId]);

  const activeReceipt = receipts?.[activeIndex];

  const { data: viewUrl, isFetching: isUrlLoading } = useQuery({
    queryKey: ["expenseReceiptViewUrl", activeReceipt?.receiptId],
    queryFn: async () => {
      const res = await receiptService.getViewUrl(activeReceipt.receiptId);
      return extractUrl(res.data);
    },
    enabled: !!activeReceipt?.receiptId,
    staleTime: 5 * 60_000,
  });

  const canZoom = activeReceipt && !isPdfFile(activeReceipt.fileName);

  const body = isLoading ? (
    <div className="flex h-full items-center justify-center text-xs text-gray-400">Loading receipt…</div>
  ) : !receipts?.length ? (
    <EmptyState />
  ) : isUrlLoading ? (
    <div className="flex h-full items-center justify-center text-xs text-gray-400">Loading preview…</div>
  ) : (
    <ReceiptSurface receipt={activeReceipt} url={viewUrl} zoom={zoom} />
  );

  const controls = receipts?.length > 0 && (
    <div className="flex items-center gap-1">
      {canZoom && (
        <>
          <button
            type="button"
            title="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Reset zoom"
            onClick={() => setZoom(1)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Zoom in"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </>
      )}
      <button
        type="button"
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        onClick={() => setIsFullscreen((f) => !f)}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );

  const viewerChrome = (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-600">
          {activeReceipt && (isImageFile(activeReceipt.fileName) ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />)}
          <span className="truncate">{activeReceipt?.fileName || "Receipt"}</span>
        </div>
        {controls}
      </div>

      <div className="min-h-0 flex-1">{body}</div>

      {receipts?.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-gray-200 bg-white px-2 py-2">
          {receipts.map((r, idx) => (
            <button
              key={r.receiptId}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium ${
                idx === activeIndex ? "border-[#0A0082] bg-indigo-50 text-[#0A0082]" : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {isImageFile(r.fileName) ? "Image" : "PDF"} {idx + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/70 p-4 md:p-8">
        <div className="relative mx-auto h-full max-w-6xl rounded-xl bg-white shadow-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-gray-600 shadow hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
          {viewerChrome}
        </div>
      </div>
    );
  }

  return <div className="h-full rounded-xl border border-gray-200 overflow-hidden">{viewerChrome}</div>;
}
