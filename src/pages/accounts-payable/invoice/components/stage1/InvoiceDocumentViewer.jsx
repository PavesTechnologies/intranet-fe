import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Minus,
  Plus,
  RotateCw,
  Maximize2,
} from "lucide-react";

// Same CDN worker setup already used by the only other react-pdf consumer in this codebase
// (src/pages/airs/candidates/CandidateScore/tabs/Resume/components/ResumePreview.jsx).
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const BASE_PAGE_WIDTH = 620;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.15;

function downloadBlobUrl(url, fileName) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "invoice.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Shared Stage 1 document viewer (Vendor / Buyer / GST Tax Validation). There is no backend
 * endpoint to preview the source file before the invoice is saved (the only "view invoice" route
 * requires a DB-persisted inbound_document_id, which doesn't exist yet at this stage) — so
 * `fileUrl` is a local blob URL built from the file the user just selected. When it's unavailable
 * (e.g. the upload session was resumed after a page refresh), this renders a filename-only
 * fallback instead of fabricating a preview.
 *
 * @param {Object} props
 * @param {string|null} props.fileUrl
 * @param {string} [props.originalFilename]
 * @param {number} [props.page] - page to jump to (e.g. when a field with a known location is selected)
 * @param {Array<{left:number, top:number, width:number, height:number}>} [props.highlights] - 0-1 fractions
 * @param {React.Ref} [props.highlightRef] - attached to the first highlight's DOM node, used by
 *   FieldDocumentConnector to anchor the arrow to it
 * @param {string|null} [props.noteMessage] - e.g. "No document location available for this field."
 * @param {string} [props.title="Original Invoice"] - header label prefix; Stage 2 reuses this
 *   viewer for the PO document pane with a different label instead of duplicating the component.
 */
export default function InvoiceDocumentViewer({
  fileUrl,
  originalFilename,
  page,
  highlights = [],
  highlightRef,
  noteMessage = null,
  title = "Original Invoice",
}) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loadError, setLoadError] = useState(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setNumPages(null);
    setPageNumber(1);
    setLoadError(null);
    setScale(1);
    setRotation(0);
  }, [fileUrl]);

  useEffect(() => {
    if (page && page >= 1) setPageNumber(page);
  }, [page]);

  const visibleHighlights = page && page === pageNumber ? highlights : [];
  const pageWidth = BASE_PAGE_WIDTH * scale;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="truncate text-sm font-semibold text-gray-800">
          {title}
          {originalFilename ? `: ${originalFilename}` : ""}
        </h3>
      </div>

      {noteMessage && (
        <p className="flex items-center gap-1.5 bg-amber-50 px-4 py-1.5 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {noteMessage}
        </p>
      )}

      {fileUrl && !loadError && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-800 px-3 py-2 text-gray-200">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="rounded p-1 hover:bg-white/10 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[52px] text-center text-xs font-medium">
              {pageNumber} / {numPages || "-"}
            </span>
            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.min(numPages || p, p + 1))}
              disabled={!numPages || pageNumber >= numPages}
              className="rounded p-1 hover:bg-white/10 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)))}
              className="rounded p-1 hover:bg-white/10"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-11 text-center text-xs font-medium">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)))}
              className="rounded p-1 hover:bg-white/10"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setScale(1)} className="rounded p-1 hover:bg-white/10" aria-label="Reset zoom" title="Reset zoom">
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="rounded p-1 hover:bg-white/10"
              aria-label="Rotate"
              title="Rotate"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => downloadBlobUrl(fileUrl, originalFilename)}
              className="rounded p-1 hover:bg-white/10"
              aria-label="Download"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 items-start justify-center overflow-auto bg-gray-100 p-4">
        {!fileUrl && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-gray-400">
            <FileText className="h-10 w-10" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-600">Preview unavailable</p>
            {originalFilename && <p className="max-w-[240px] truncate text-xs text-gray-400">{originalFilename}</p>}
          </div>
        )}

        {fileUrl && loadError && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-gray-400">
            <AlertTriangle className="h-8 w-8 text-red-400" aria-hidden="true" />
            <p className="text-sm font-medium text-red-600">Unable to preview this document</p>
          </div>
        )}

        {fileUrl && !loadError && (
          <div className="relative shadow-sm" style={{ width: pageWidth }}>
            <Document
              file={fileUrl}
              loading={
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-[#0A0082]" aria-hidden="true" />
                </div>
              }
              onLoadSuccess={({ numPages: total }) => setNumPages(total)}
              onLoadError={() => setLoadError("Unable to load PDF")}
            >
              <Page pageNumber={pageNumber} width={pageWidth} rotate={rotation} renderTextLayer={false} renderAnnotationLayer={false} />
            </Document>

            {visibleHighlights.map((box, index) => (
              <div
                key={index}
                ref={index === 0 ? highlightRef : undefined}
                className="pointer-events-none absolute rounded-[3px] border-2 border-blue-500 bg-blue-400/15"
                style={{
                  left: `${box.left * 100}%`,
                  top: `${box.top * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
