// src/pages/accounts-payable/invoice/pages/InvoiceUploadPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { UploadCloud, FileText, X } from "lucide-react";
import PageHeader from "../../../../components/ui/PageHeader";
import Button from "../../../../components/Button/Button";
import { PageCard, PageCardContent } from "../../../../components/Cards/PageCard";
import {
  useExtractInvoiceFieldsMutation,
  useValidateInvoiceFieldsMutation,
  useCreateInvoiceMutation,
} from "../hooks/useInvoiceMutations";
import { useInvoiceValidationProgress, isValidationTerminal } from "../hooks/useInvoiceValidationProgress";
import InvoiceProcessingPipeline, { VALIDATION_STAGES } from "../components/InvoiceProcessingPipeline";
import Stage1ReviewSection from "../components/stage1/Stage1ReviewSection";
import { AP_ROUTES } from "../../constants/routes";
import { getApiErrorMessage } from "../../utils/apiError";

const ACCEPTED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Only the job id + display metadata needed to resume the pipeline UI after a refresh — never
// the source document or extracted invoice fields.
const VALIDATION_SESSION_KEY = "ap.invoiceUpload.validationJob";

function getExtension(fileName) {
  const index = fileName.lastIndexOf(".");
  return index === -1 ? "" : fileName.slice(index).toLowerCase();
}

function validateFile(file) {
  const extension = getExtension(file.name);
  if (!ACCEPTED_MIME_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.includes(extension)) {
    return "Unsupported file type. Please upload a PDF, PNG, JPG, or JPEG file.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File is too large. Maximum size is 10MB.";
  }
  return "";
}

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
}

function readStoredValidationJob() {
  try {
    const raw = sessionStorage.getItem(VALIDATION_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredValidationJob(job) {
  try {
    sessionStorage.setItem(VALIDATION_SESSION_KEY, JSON.stringify(job));
  } catch {
    // best-effort only (private browsing / quota) — resume-on-refresh just won't work this time
  }
}

function clearStoredValidationJob() {
  try {
    sessionStorage.removeItem(VALIDATION_SESSION_KEY);
  } catch {
    // ignore
  }
}

/**
 * Names the first failed stage (in pipeline order) and its issue for the failure toast — the
 * panel already lists every stage's issues in full, so this only needs to be a pointer, not a
 * duplicate of the whole detail. Falls back to the job's top-level issues if no single stage was
 * marked FAILED (e.g. a global engine-level failure with current_stage: null).
 */
function describeValidationFailure(data) {
  const stages = data?.stages || {};
  const failedStage = VALIDATION_STAGES.find((stage) => stages[stage.key]?.status === "FAILED");
  const issues = (failedStage ? stages[failedStage.key]?.issues : null) || data?.issues || [];
  const stageLabel = failedStage?.label;

  if (issues.length === 0) {
    return stageLabel ? `${stageLabel} failed.` : "Invoice validation failed.";
  }

  const detail =
    issues.length > 1
      ? `${issues[0]} (+${issues.length - 1} more issue${issues.length > 2 ? "s" : ""})`
      : issues[0];
  return stageLabel ? `${stageLabel} failed: ${detail}` : detail;
}

/** True while a submission is in flight and the upload form should stay hidden/disabled. */
function isPipelineActive(pipeline) {
  if (!pipeline) return false;
  if (pipeline.extraction.status === "RUNNING") return true;
  if (pipeline.extraction.status === "FAILED") return false;
  if (!pipeline.validation) return true; // extracted, about to queue validation
  return !isValidationTerminal(pipeline.validation.status);
}

/** Route: /accounts-payable/invoices/upload */
export default function InvoiceUploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [pipeline, setPipeline] = useState(null);
  // Guards against toasting the same job's failure more than once (polling stops once terminal,
  // but effects can still re-run on unrelated re-renders while the same failed data is cached).
  const failureToastedJobIdRef = useRef(null);

  const extractFields = useExtractInvoiceFieldsMutation();
  const validateFields = useValidateInvoiceFieldsMutation();
  const createInvoice = useCreateInvoiceMutation();
  const validationQuery = useInvoiceValidationProgress(pipeline?.jobId ?? null, {
    enabled: Boolean(pipeline?.jobId),
  });

  // There's no backend endpoint to preview the source document before the invoice is saved (the
  // only "view invoice" route needs a DB-persisted inbound_document_id that doesn't exist yet at
  // this stage), so the Stage 1 document viewer renders the file the user already selected.
  const fileUrl = useMemo(() => (selectedFile ? URL.createObjectURL(selectedFile) : null), [selectedFile]);
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  // Resume-on-refresh: if a validation job was mid-flight when the page unloaded, pick the
  // pipeline UI back up from its job id instead of silently losing the user's place.
  useEffect(() => {
    const stored = readStoredValidationJob();
    if (!stored?.jobId) return;
    setPipeline({
      fileName: stored.fileName || "Invoice",
      extraction: { status: "SUCCESS", durationMs: stored.extractionDurationMs ?? null, errorMessage: null },
      jobId: stored.jobId,
      validation: { status: "RUNNING", stages: {}, isValid: undefined, requiresManualReview: undefined, issues: [], pollUnavailable: false },
      // The extracted payload itself is never persisted to sessionStorage, so a resumed session
      // can't call Save Invoice until the user re-uploads — see the disabled-Save fallback below.
      extractionResult: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Merge real polling status into the pipeline view, exactly as the backend reports it.
  useEffect(() => {
    if (!pipeline?.jobId) return;

    if (validationQuery.data) {
      const data = validationQuery.data;
      setPipeline((prev) =>
        prev
          ? {
              ...prev,
              validation: {
                status: data.status,
                stages: data.stages || {},
                isValid: data.is_valid,
                requiresManualReview: data.requires_manual_review,
                issues: data.issues || [],
                pollUnavailable: false,
              },
            }
          : prev,
      );

      if (isValidationTerminal(data.status)) {
        clearStoredValidationJob();
      }

      if (data.status === "FAILED" && failureToastedJobIdRef.current !== pipeline.jobId) {
        failureToastedJobIdRef.current = pipeline.jobId;
        toast.error(describeValidationFailure(data));
      }
      return;
    }

    if (validationQuery.isError) {
      if (validationQuery.error?.status === 404) {
        setPipeline((prev) =>
          prev
            ? {
                ...prev,
                validation: {
                  ...(prev.validation || { stages: {}, issues: [] }),
                  status: "FAILED",
                  errorMessage: "This validation job could not be found. It may have expired.",
                  pollUnavailable: false,
                },
              }
            : prev,
        );
        clearStoredValidationJob();
      } else {
        setPipeline((prev) =>
          prev && prev.validation ? { ...prev, validation: { ...prev.validation, pollUnavailable: true } } : prev,
        );
      }
    }
  }, [validationQuery.data, validationQuery.isError, validationQuery.error, pipeline?.jobId]);

  const handleFileSelected = (file) => {
    if (!file) return;

    const isDuplicate =
      selectedFile &&
      selectedFile.name === file.name &&
      selectedFile.size === file.size &&
      selectedFile.lastModified === file.lastModified;
    if (isDuplicate) {
      toast.info("This file is already selected.");
      return;
    }

    const error = validateFile(file);
    setValidationError(error);
    setSelectedFile(error ? null : file);
  };

  const handleInputChange = (e) => {
    handleFileSelected(e.target.files?.[0]);
    e.target.value = ""; // allows re-selecting the same file after Cancel
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelected(e.dataTransfer.files?.[0]);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setValidationError("");
    setPipeline(null);
    clearStoredValidationJob();
  };

  /**
   * Queues a validation job for the given payload (either the raw extraction result on first
   * upload, or { extraction_id } to revalidate against corrected cache data) and seeds a fresh
   * `pipeline.validation` so InvoiceProcessingPipeline/Stage1ReviewSection re-render from scratch
   * against the new job's polling status.
   */
  const runValidation = async (payload, sessionMeta) => {
    try {
      const queued = await validateFields.mutateAsync(payload);
      const jobId = queued?.job_id;
      if (!jobId) throw new Error("Validation did not return a job id.");

      setPipeline((prev) =>
        prev
          ? {
              ...prev,
              jobId,
              validation: {
                status: queued.status || "QUEUED",
                stages: {},
                isValid: undefined,
                requiresManualReview: undefined,
                issues: [],
                pollUnavailable: false,
              },
            }
          : prev,
      );

      writeStoredValidationJob({ jobId, fileName: sessionMeta.fileName, extractionDurationMs: sessionMeta.extractionDurationMs });
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to start invoice validation.");
      setPipeline((prev) =>
        prev
          ? {
              ...prev,
              validation: {
                status: "FAILED",
                stages: {},
                isValid: undefined,
                requiresManualReview: undefined,
                issues: [],
                pollUnavailable: false,
                errorMessage: message,
              },
            }
          : prev,
      );
      toast.error(message);
    }
  };

  /** Re-runs validation against the corrected extraction cache after a Stage 1 field correction. */
  const handleRevalidate = async (extractionId) => {
    await runValidation(
      { extraction_id: extractionId },
      { fileName: pipeline?.fileName, extractionDurationMs: pipeline?.extraction?.durationMs ?? null },
    );
  };

  /**
   * Called by Stage1ReviewSection after a Vendor/Buyer/Tax/Amounts correction succeeds. Merges the
   * backend's updated section into local state (the extracted payload itself is never persisted
   * anywhere else, so this is the only place it can be refreshed from) and re-triggers validation
   * so the stepper reflects the corrected data.
   */
  const handleFieldCorrected = (section, updatedSection) => {
    setPipeline((prev) => {
      if (!prev?.extractionResult) return prev;
      return {
        ...prev,
        extractionResult: {
          ...prev.extractionResult,
          extracted_invoice: {
            ...prev.extractionResult.extracted_invoice,
            [section]: { ...prev.extractionResult.extracted_invoice[section], ...updatedSection },
          },
        },
      };
    });

    const extractionId = pipeline?.extractionResult?.extraction_id;
    if (extractionId) handleRevalidate(extractionId);
  };

  /**
   * Called by InvoiceDetailsPanel/InvoiceAmountsSection (Invoice Number/Date/Due Date/PO Number/
   * Payment Terms/Currency/Amounts) on every field change — unlike handleFieldCorrected, this
   * never triggers revalidation: none of these fields has a backend validation stage or
   * correction endpoint of its own, so there's nothing to re-check and no reason to interrupt the
   * user with a fresh validation run mid-edit. The single page-level Save Invoice button sends
   * whatever ends up in local state.
   */
  const handleFieldChange = (section, field, value) => {
    setPipeline((prev) =>
      prev?.extractionResult
        ? {
            ...prev,
            extractionResult: {
              ...prev.extractionResult,
              extracted_invoice: {
                ...prev.extractionResult.extracted_invoice,
                [section]: { ...prev.extractionResult.extracted_invoice[section], [field]: value },
              },
            },
          }
        : prev,
    );
  };

  /** Called by InvoiceLineItemsSection on every cell change — same local-only semantics as
   * handleFieldChange, just addressing one array entry instead of one section. */
  const handleLineChange = (index, field, value) => {
    setPipeline((prev) => {
      if (!prev?.extractionResult) return prev;
      const lines = prev.extractionResult.extracted_invoice.invoice_lines || [];
      const nextLines = lines.map((line, i) => (i === index ? { ...line, [field]: value } : line));
      return {
        ...prev,
        extractionResult: {
          ...prev.extractionResult,
          extracted_invoice: { ...prev.extractionResult.extracted_invoice, invoice_lines: nextLines },
        },
      };
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setValidationError("Please select a file to upload.");
      return;
    }
    if (isPipelineActive(pipeline)) return; // guard against duplicate submission

    const fileName = selectedFile.name;
    setPipeline({
      fileName,
      extraction: { status: "RUNNING", durationMs: null, errorMessage: null },
      jobId: null,
      validation: null,
      extractionResult: null,
    });

    const startedAt = performance.now();
    let extracted;
    try {
      extracted = await extractFields.mutateAsync(selectedFile);
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to extract invoice data.");
      setPipeline((prev) => (prev ? { ...prev, extraction: { status: "FAILED", durationMs: null, errorMessage: message } } : prev));
      toast.error(message);
      return;
    }

    const extractionDurationMs = performance.now() - startedAt;

    setPipeline((prev) =>
      prev
        ? {
            ...prev,
            extraction: { status: "SUCCESS", durationMs: extractionDurationMs, errorMessage: null },
            extractionResult: extracted,
          }
        : prev,
    );

    await runValidation(extracted, { fileName, extractionDurationMs });
  };

  const handleSaveInvoice = async () => {
    if (!pipeline?.extractionResult) {
      toast.error("The extracted invoice data is no longer available. Please upload the file again.");
      return;
    }

    try {
      const created = await createInvoice.mutateAsync(pipeline.extractionResult);
      toast.success(created?.invoice_number ? `Invoice ${created.invoice_number} saved successfully.` : "Invoice saved successfully.");
      navigate(AP_ROUTES.INVOICE_LIST);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save the invoice. Please try again."));
    }
  };

  const validationDone = pipeline?.validation && isValidationTerminal(pipeline.validation.status);
  const extractionFailed = pipeline?.extraction.status === "FAILED";

  const inReview = Boolean(pipeline?.extractionResult);

  return (
    <div className="p-6">
      {!inReview && <PageHeader title="Upload Invoice" subtitle="Upload a vendor invoice document for OCR processing" />}

      <div className={inReview ? "w-full" : "mx-auto max-w-2xl"}>
        {pipeline ? (
          <>
            {!inReview && (
              <InvoiceProcessingPipeline fileName={pipeline.fileName} extraction={pipeline.extraction} validation={pipeline.validation} />
            )}

            {inReview && (
              <Stage1ReviewSection
                extractedInvoice={pipeline.extractionResult.extracted_invoice}
                stages={pipeline.validation?.stages}
                extractionId={pipeline.extractionResult.extraction_id}
                fileUrl={fileUrl}
                originalFilename={pipeline.fileName}
                onCorrected={handleFieldCorrected}
                onFieldChange={handleFieldChange}
                onLineChange={handleLineChange}
              />
            )}

            {(extractionFailed || validationDone) && (
              <div className="mt-4">
                {/* The user can skip resolving any stage — saving is no longer blocked on
                    pipeline.validation.isValid, only on extractionResult actually being
                    available. The backend persists the invoice regardless and reports back
                    whatever status_code reflects its outstanding issues (see createInvoice's
                    response shape), so this is just an honest heads-up, not a hard gate. */}
                {validationDone && pipeline.extractionResult && !pipeline.validation?.isValid && (
                  <p className="mb-2 text-right text-xs text-amber-600">
                    This invoice has unresolved validation issues — saving now will store it for manual review.
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  {extractionFailed && (
                    <>
                      <Button variant="outline" onClick={handleReset}>
                        Choose a Different File
                      </Button>
                      <Button variant="primary" onClick={handleUpload}>
                        Try Again
                      </Button>
                    </>
                  )}
                  {validationDone && (
                    <>
                      <Button variant="outline" onClick={handleReset} disabled={createInvoice.isPending}>
                        Upload Another Invoice
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleSaveInvoice}
                        disabled={!pipeline.extractionResult}
                        loading={createInvoice.isPending}
                        loadingText="Saving..."
                        title={
                          !pipeline.extractionResult
                            ? "Extracted data isn't available after a refresh — please upload the file again."
                            : undefined
                        }
                      >
                        {pipeline.validation?.isValid ? "Save Invoice" : "Save for Manual Review"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <PageCard>
            <PageCardContent>
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
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                  isDragging ? "border-[#0A0082] bg-[#0A0082]/5" : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <UploadCloud className="h-10 w-10 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">Drag &amp; drop your invoice here, or click to browse</p>
                <p className="text-xs text-gray-500">Supported: PDF, PNG, JPG, JPEG · Max 10MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS.join(",")}
                  className="hidden"
                  onChange={handleInputChange}
                />
              </div>

              {validationError && <p className="mt-2 text-sm text-red-600">{validationError}</p>}

              {selectedFile && !validationError && (
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
                    onClick={handleReset}
                    className="shrink-0 text-gray-400 hover:text-gray-600"
                    aria-label="Remove selected file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={handleReset} disabled={!selectedFile}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleUpload} disabled={!selectedFile || Boolean(validationError)}>
                  Upload Invoice
                </Button>
              </div>
            </PageCardContent>
          </PageCard>
        )}
      </div>
    </div>
  );
}
