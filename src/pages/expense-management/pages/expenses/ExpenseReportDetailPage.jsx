import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Plus,
  Pencil,
  Trash2,
  Layers,
  AlertCircle,
  Briefcase,
  Landmark,
  Calendar,
  FileText,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Image as ImageIcon,
  Eye,
  Download,
  Loader2,
  Sparkles,
  Keyboard,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import { PageCard, PageCardContent } from "@/components/Cards/PageCard";
import GenericTable from "@/components/Table/table";
import Button from "@/components/Button/Button";
import SearchInput from "@/components/filter/Searchbar";
import Modal from "@/components/Modal/modal";
import ConfirmationModal from "@/components/confirmation_modal/ConfirmationModal";
import LoadingSpinner from "@/components/LoadingSpinner";
import FormSelect from "@/components/forms/FormSelect";
import { useAuth } from "@/contexts/AuthContext";
import { showStatusToast } from "@/components/toastfy/toast";
import {
  expenseReportService,
  lineItemService,
  lookupService,
  receiptService,
} from "@/pages/expense-management/api/expenseReportsApi";
import ReportFormFields from "@/pages/expense-management/components/expense-reports/ReportFormFields";
import SummaryPanel from "@/pages/expense-management/components/expense-reports/SummaryPanel";
import api from "@/api/axiosInstance";
import Select from "react-select";
import FormInput from "@/components/forms/FormInput";
import FormTextArea from "@/components/forms/FormTextArea";
import FormDatePicker from "@/components/forms/FormDatePicker";
import GstCalculationCard from "@/pages/expense-management/components/expense-reports/GstCalculationCard";
import CurrencyConversionCard from "@/pages/expense-management/components/expense-reports/CurrencyConversionCard";
import ReceiptDropzone from "@/pages/expense-management/components/expense-reports/ReceiptDropzone";
import PolicyStatusBadge, {
  PolicyResultBanner,
  derivePolicyStatus,
} from "@/pages/expense-management/components/expense-reports/PolicyStatusBadge";
import ApprovalStatusPill from "@/pages/expense-management/approval-engine/components/ApprovalStatusPill";
import { useApprovalLiveSync } from "@/pages/expense-management/approval-engine/hooks/useApprovalLiveSync";
import {
  useApprovalStatus,
  useLineItemReviews,
  useSubmitReport,
  useRecallReport,
  useCancelReport,
} from "@/pages/expense-management/approval-engine/hooks/useApprovalWorkflow";
import { useFinanceReviews } from "@/pages/expense-management/pages/finance/hooks/useFinanceVerification";

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
};

const formatAmount = (value) =>
  (Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DetailField = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
    <div className="mt-0.5 shrink-0 text-blue-700">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800 break-words">{value ?? "—"}</p>
    </div>
  </div>
);

const SORT_OPTIONS = [
  { label: "Date (Newest first)", value: "date_desc" },
  { label: "Date (Oldest first)", value: "date_asc" },
  { label: "Amount (High to Low)", value: "amount_desc" },
  { label: "Amount (Low to High)", value: "amount_asc" },
  { label: "Merchant (A-Z)", value: "merchant_asc" },
];

export default function ExpenseReportDetailPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canManage = hasRole(["General", "Manager"]);

  useApprovalLiveSync();
  const { data: approvalStatus } = useApprovalStatus(reportId);
  const { data: lineItemReviews } = useLineItemReviews(reportId);
  const { data: financeReviews } = useFinanceReviews(reportId);
  const submitReport = useSubmitReport();
  const recallReport = useRecallReport();
  const cancelReport = useCancelReport();
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState(null); // "recall" | "cancel" | null
  const isLifecycleBusy = submitReport.isPending || recallReport.isPending || cancelReport.isPending;
  const [report, setReport] = useState(null);
  const [lineItems, setLineItems] = useState([]);

  const needsCorrectionLines = (lineItemReviews || []).filter((r) => r.status === "NEEDS_CORRECTION");
  const queriedLines = (financeReviews || []).filter((r) => r.status === "QUERIED" || r.status === "QUERY_RAISED" || r.reason);
  // Mirrors the backend's ReportStatus.isEditable() set exactly (EMS/enums/ReportStatus.java) -
  // report-level Edit/Delete must stay available during AWAITING_CORRECTION (that's the whole
  // point of the correction loop), not just DRAFT.
  const isReportEditable = ["DRAFT", "POLICY_REJECTED", "QUERY_RAISED", "AWAITING_CORRECTION"].includes(report?.reportStatus);

    const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [costCenters, setCostCenters] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  const [isLineItemDrawerOpen, setIsLineItemDrawerOpen] = useState(false);
  const [selectedLineItem, setSelectedLineItem] = useState(null);
  const [lineItemToDelete, setLineItemToDelete] = useState(null);
  const [deletingLineItem, setDeletingLineItem] = useState(false);

  // Entry selection dialog states
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);
  const [selectionStep, setSelectionStep] = useState("options"); // 'options' | 'upload' | 'scanning' | 'success'
  const [scannedFile, setScannedFile] = useState(null);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [scannedResult, setScannedResult] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isOcrReviewOpen, setIsOcrReviewOpen] = useState(false);
  const [ocrReviewData, setOcrReviewData] = useState({
    categoryId: "",
    expenseDate: "",
    merchantName: "",
    description: "",
    amount: "",
    currencyId: "",
    taxAmount: "0",
    costCenterId: "",
    clientBillable: false,
    projectId: "",
    ocrReceiptId: null,
    confidenceScore: null,
  });
  const [ocrReviewErrors, setOcrReviewErrors] = useState({});
  const [ocrSubmitting, setOcrSubmitting] = useState(false);

  const [lineItemToView, setLineItemToView] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewReceipts, setViewReceipts] = useState([]);
  const [loadingViewReceipts, setLoadingViewReceipts] = useState(false);

  const [viewReceiptPreviewUrl, setViewReceiptPreviewUrl] = useState("");
  const [viewReceiptFile, setViewReceiptFile] = useState(null);
  const [viewZoom, setViewZoom] = useState(1);
  const [viewRotation, setViewRotation] = useState(0);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!isOcrReviewOpen) {
      setZoom(1);
      setRotation(0);
    }
  }, [isOcrReviewOpen]);

  useEffect(() => {
    if (!isViewModalOpen) {
      setViewZoom(1);
      setViewRotation(0);
      setViewReceiptPreviewUrl("");
      setViewReceiptFile(null);
    }
  }, [isViewModalOpen]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.5));
  const handleRotateLeft = () => setRotation((prev) => prev - 90);
  const handleRotateRight = () => setRotation((prev) => prev + 90);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
  };

  const [isEditReportOpen, setIsEditReportOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ title: "", businessPurpose: "", costCenterId: "", currencyId: "" });
  const [editFormErrors, setEditFormErrors] = useState({});
  const [savingReport, setSavingReport] = useState(false);
  const [isDeleteReportOpen, setIsDeleteReportOpen] = useState(false);
  const [deletingReport, setDeletingReport] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      const res = await expenseReportService.getById(reportId);
      setReport(res.data?.data);
    } catch (err) {
      console.error("Failed to fetch expense report:", err);
      setLoadError(true);
    }
  }, [reportId]);

  useEffect(() => {
    if (!scannedFile) {
      setReceiptPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(scannedFile);
    setReceiptPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [scannedFile]);

  const fetchLineItems = useCallback(async () => {
    try {
      const res = await lineItemService.getAll(reportId);
      const payload = res.data?.data;
      const list = Array.isArray(payload) ? payload : payload?.lineItems || payload?.content || payload?.data || [];
      setLineItems(list);
    } catch (err) {
      console.error("Failed to fetch line items:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to fetch line items.";
      showStatusToast(errMsg, "error");
    }
  }, [reportId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    await Promise.all([fetchReport(), fetchLineItems()]);
    setLoading(false);
  }, [fetchReport, fetchLineItems]);

  const fetchLookups = useCallback(async () => {
    try {
      setLookupsLoading(true);
      const [costCenterList, currencyList, categoryList, projectListResponse] = await Promise.all([
        lookupService.getActiveCostCenters(),
        lookupService.getActiveCurrencies(),
        lookupService.getActiveCategories(),
        api.get("/xms/admin/projects", {
          baseURL: window.__APP_CONFIG__?.EXPENSE_MANAGEMENT_URL || "",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }).catch((err) => {
          console.error("Failed to load projects:", err);
          return { data: { data: [] } };
        }),
      ]);
      setCostCenters(costCenterList);
      setCurrencies(currencyList);
      setCategories(categoryList);
      const pList = projectListResponse?.data?.data || projectListResponse?.data || [];
      setProjects(Array.isArray(pList) ? pList : []);
    } catch (err) {
      console.error("Failed to load lookups:", err);
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchLookups();
  }, [fetchAll, fetchLookups]);

  const costCenterOptions = useMemo(
    () => costCenters.map((c) => ({ value: c.costCenterId, label: `${c.costCenterCode} - ${c.costCenterName}` })),
    [costCenters]
  );
  const currencyOptions = useMemo(
    () => currencies.map((c) => ({ value: c.currencyId, label: `${c.currencyCode} - ${c.currencyName}`, code: c.currencyCode })),
    [currencies]
  );
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.categoryId, label: `${c.categoryCode} - ${c.categoryName}` })),
    [categories]
  );

  const filteredLineItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = !q
      ? lineItems
      : lineItems.filter((li) => {
        const merchant = (li.merchantName || "").toLowerCase();
        const category = (li.categoryName || "").toLowerCase();
        const desc = (li.description || "").toLowerCase();
        return merchant.includes(q) || category.includes(q) || desc.includes(q);
      });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return new Date(a.expenseDate || 0) - new Date(b.expenseDate || 0);
        case "amount_desc":
          return (Number(b.amount) || 0) - (Number(a.amount) || 0);
        case "amount_asc":
          return (Number(a.amount) || 0) - (Number(b.amount) || 0);
        case "merchant_asc":
          return (a.merchantName || "").localeCompare(b.merchantName || "");
        case "date_desc":
        default:
          return new Date(b.expenseDate || 0) - new Date(a.expenseDate || 0);
      }
    });

    return list;
  }, [lineItems, searchTerm, sortBy]);

  const openAddLineItem = () => {
    setIsSelectionDialogOpen(true);
    setSelectionStep("options");
    setScannedFile(null);
    setScanningProgress(0);
    setScannedResult(null);
  };

  const handleSelectManual = () => {
    setIsSelectionDialogOpen(false);
    setSelectedLineItem(null);
    setIsLineItemDrawerOpen(true);
  };

  const handleReceiptFileSelect = async (file) => {
    const allowedExtensions = ["pdf", "png", "jpg", "jpeg"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      showStatusToast("Only PDF, PNG, JPG, and JPEG files are allowed.", "error");
      return;
    }

    setScannedFile(file);
    setSelectionStep("scanning");
    setScanningProgress(5);

    try {
      const formData = new FormData();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      formData.append("file", file, safeName);

      // Upload file to the report's receipt store
      const uploadRes = await api.post(`/xms/employee/expense-reports/${reportId}/receipts`, formData, {
        baseURL: window.__APP_CONFIG__?.EXPENSE_MANAGEMENT_URL || "",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const receiptId = uploadRes.data?.data?.receiptId || uploadRes.data?.receiptId;
      if (!receiptId) {
        throw new Error("Failed to retrieve receipt ID from upload response");
      }

      setScanningProgress(20);

      // Poll status
      let pollCount = 0;
      const maxPolls = 35; // 35 seconds max
      const interval = setInterval(async () => {
        try {
          pollCount++;
          const ocrRes = await api.get(`/xms/employee/receipts/${receiptId}/ocr`, {
            baseURL: window.__APP_CONFIG__?.EXPENSE_MANAGEMENT_URL || "",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });

          // Checking if response data holds OCR result or status
          const responsePayload = ocrRes.data?.data || ocrRes.data;
          const status = responsePayload?.processingStatus || responsePayload?.ocrStatus;

          setScanningProgress(Math.min(95, 20 + Math.round((pollCount / maxPolls) * 75)));

          if (status === "OCR_COMPLETED") {
            clearInterval(interval);
            setScanningProgress(100);

            const confidence = responsePayload.confidenceScore !== undefined ? responsePayload.confidenceScore : 1.0;
            const isLowConfidence = confidence < 0.85 || (confidence > 1 && confidence < 85);

            // Clean/validate Merchant Name
            let merchantVal = isLowConfidence ? "" : (responsePayload.merchantName || "").trim();

            // Clean/validate GST
            let taxVal = responsePayload.taxAmount;
            let amountVal = responsePayload.totalAmount;

            let taxNum = Number(taxVal);
            let amountNum = Number(amountVal);

            if (isNaN(amountNum) || amountNum <= 0) {
              amountNum = 0;
            }
            if (isNaN(taxNum) || taxNum < 0) {
              taxNum = 0;
            }

            // Validate GST: GST cannot exceed the expense amount.
            if (taxNum > amountNum) {
              taxNum = 0;
            }

            // Pre-match category name if present in active categories list
            let categoryIdVal = "";
            if (responsePayload.categoryName) {
              const matchedCat = categories.find(
                (c) => c.categoryName?.toLowerCase() === responsePayload.categoryName.toLowerCase() ||
                       c.categoryCode?.toLowerCase() === responsePayload.categoryName.toLowerCase()
              );
              if (matchedCat) {
                categoryIdVal = matchedCat.categoryId;
              }
            }

            // Pre-match currency code if present in active currencies list
            let currencyIdVal = "";
            if (responsePayload.currencyCode) {
              const matchedCur = currencies.find(
                (c) => c.currencyCode?.toUpperCase() === responsePayload.currencyCode.toUpperCase()
              );
              if (matchedCur) {
                currencyIdVal = matchedCur.currencyId;
              }
            }
            if (!currencyIdVal && report?.currencyId) {
              currencyIdVal = report.currencyId;
            }

            const reviewData = {
              categoryId: categoryIdVal,
              expenseDate: isLowConfidence ? "" : (responsePayload.receiptDate || new Date().toISOString().split("T")[0]),
              merchantName: merchantVal,
              description: "",
              amount: (isLowConfidence || amountNum <= 0) ? "" : amountNum.toFixed(2),
              currencyId: currencyIdVal,
              taxAmount: isLowConfidence ? "0.00" : taxNum.toFixed(2),
              costCenterId: report?.costCenterId || "",
              clientBillable: false,
              projectId: "",
              ocrReceiptId: receiptId,
              confidenceScore: confidence,
            };

            // Close selection dialog and open the full-screen OCR review modal
            setIsSelectionDialogOpen(false);
            setOcrReviewData(reviewData);
            setOcrReviewErrors({});
            setIsOcrReviewOpen(true);

            setTimeout(() => {
              setSelectionStep("options");
              setScanningProgress(0);
              setScannedResult(null);
            }, 300);
          } else if (status === "FAILED") {
            clearInterval(interval);
            showStatusToast(`OCR failed: ${responsePayload?.failureReason || "Could not parse receipt"}`, "error");
            setSelectionStep("upload");
          } else if (pollCount >= maxPolls) {
            clearInterval(interval);
            showStatusToast("OCR processing timed out. Proceeding to manual entry.", "warning");
            handleSelectManual();
          }
        } catch (err) {
          console.error("Polling error:", err);
          if (pollCount >= maxPolls) {
            clearInterval(interval);
            showStatusToast("OCR service unavailable. Proceeding to manual entry.", "error");
            handleSelectManual();
          }
        }
      }, 1200);

    } catch (uploadErr) {
      console.error("Upload error:", uploadErr);
      const errMsg = uploadErr.response?.data?.message || uploadErr.response?.data?.detail || "Failed to upload receipt for OCR.";
      showStatusToast(errMsg, "error");
      setSelectionStep("upload");
    }
  };

  const handleContinueToDrawer = () => {
    setIsSelectionDialogOpen(false);
    setSelectedLineItem(scannedResult);
    setIsLineItemDrawerOpen(true);

    setTimeout(() => {
      setSelectionStep("options");
      setScannedFile(null);
      setScanningProgress(0);
      setScannedResult(null);
    }, 300);
  };

  const openEditLineItem = (li) => {
    setSelectedLineItem(li);
    setIsLineItemDrawerOpen(true);
  };

  const openViewLineItem = async (li) => {
    setLineItemToView(li);
    setIsViewModalOpen(true);
    setViewReceipts([]);
    setViewReceiptPreviewUrl("");
    setViewReceiptFile(null);
    setViewZoom(1);
    setViewRotation(0);

    if (li.lineItemId) {
      try {
        setLoadingViewReceipts(true);
        const res = await receiptService.getAll(li.lineItemId);
        const list = Array.isArray(res.data) ? res.data : res.data?.receipts || res.data?.content || res.data?.data || [];
        setViewReceipts(list);

        if (list.length > 0) {
          const firstReceipt = list[0];
          setViewReceiptFile(firstReceipt);
          const urlRes = await receiptService.getViewUrl(firstReceipt.receiptId);
          const url = extractUrl(urlRes.data?.data || urlRes.data);
          if (url) {
            setViewReceiptPreviewUrl(url);
          }
        }
      } catch (err) {
        console.error("Failed to fetch receipts for view:", err);
      } finally {
        setLoadingViewReceipts(false);
      }
    }
  };

  const handleSelectActiveViewReceipt = async (receipt) => {
    try {
      setViewReceiptFile(receipt);
      setViewReceiptPreviewUrl("");
      const urlRes = await receiptService.getViewUrl(receipt.receiptId);
      const url = extractUrl(urlRes.data?.data || urlRes.data);
      if (url) {
        setViewReceiptPreviewUrl(url);
      }
    } catch (err) {
      console.error("Failed to change active receipt view:", err);
    }
  };

  const handleViewReceiptForReadonly = async (receipt) => {
    try {
      if (receipt.receiptId) {
        const res = await receiptService.getViewUrl(receipt.receiptId);
        const url = extractUrl(res.data?.data || res.data);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      showStatusToast("Failed to open receipt preview.", "error");
    }
  };

  const handleDownloadReceiptForReadonly = async (receipt) => {
    try {
      if (receipt.receiptId) {
        const res = await receiptService.getDownloadUrl(receipt.receiptId);
        const url = extractUrl(res.data?.data || res.data);
        if (url) {
          const link = document.createElement("a");
          link.href = url;
          link.download = receipt.fileName || "receipt";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
      }
    } catch (err) {
      showStatusToast("Failed to download receipt.", "error");
    }
  };

  const handleLineItemSaved = () => {
    fetchLineItems();
    fetchReport();
  };

  const handleDeleteLineItemConfirm = async () => {
    if (!lineItemToDelete) return;
    try {
      setDeletingLineItem(true);
      await lineItemService.delete(reportId, lineItemToDelete.lineItemId);
      showStatusToast("Line item deleted successfully!", "success");
      setLineItemToDelete(null);
      fetchLineItems();
      fetchReport();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to delete line item.";
      showStatusToast(errMsg, "error");
    } finally {
      setDeletingLineItem(false);
    }
  };

  const openEditReport = () => {
    if (!report) return;
    setEditFormData({
      title: report.title || "",
      businessPurpose: report.businessPurpose || "",
      costCenterId: report.costCenterId || "",
      currencyId: report.currencyId || "",
    });
    setEditFormErrors({});
    setIsEditReportOpen(true);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
    if (editFormErrors[name]) setEditFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleEditSelectChange = (name, value) => {
    setEditFormData((prev) => ({ ...prev, [name]: value }));
    if (editFormErrors[name]) setEditFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateEditForm = () => {
    const errors = {};
    if (!editFormData.title.trim()) errors.title = "Report title is required.";
    if (!editFormData.costCenterId) errors.costCenterId = "Cost center is required.";
    if (!editFormData.currencyId) errors.currencyId = "Report currency is required.";
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditReportSubmit = async (e) => {
    e.preventDefault();
    if (!validateEditForm()) return;

    const payload = {
      title: editFormData.title.trim(),
      businessPurpose: editFormData.businessPurpose ? editFormData.businessPurpose.trim() : "",
      costCenterId: editFormData.costCenterId,
      currencyId: editFormData.currencyId,
    };

    try {
      setSavingReport(true);
      await expenseReportService.update(reportId, payload);
      showStatusToast("Expense report updated successfully!", "success");
      setIsEditReportOpen(false);
      fetchReport();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to update expense report.";
      showStatusToast(errMsg, "error");
    } finally {
      setSavingReport(false);
    }
  };

  const handleDeleteReportConfirm = async () => {
    try {
      setDeletingReport(true);
      await expenseReportService.delete(reportId);
      showStatusToast("Expense report deleted successfully!", "success");
      navigate("/expense-management/expenses/my");
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to delete expense report.";
      showStatusToast(errMsg, "error");
      setIsDeleteReportOpen(false);
    } finally {
      setDeletingReport(false);
    }
  };

  const handleSubmitOrResubmit = () => {
    submitReport.mutate(reportId, {
      onSuccess: () => {
        showStatusToast(["AWAITING_CORRECTION", "QUERY_RAISED"].includes(report.reportStatus) ? "Report resubmitted" : "Report submitted for approval", "success");
        fetchReport();
      },
      onError: (err) => showStatusToast(err.response?.data?.message || "Failed to submit report", "error"),
    });
  };

  const handleLifecycleConfirm = () => {
    const mutation = pendingLifecycleAction === "recall" ? recallReport : cancelReport;
    mutation.mutate(reportId, {
      onSuccess: () => {
        showStatusToast(pendingLifecycleAction === "recall" ? "Report recalled to Draft" : "Report cancelled", "success");
        setPendingLifecycleAction(null);
        fetchReport();
      },
      onError: (err) => {
        showStatusToast(err.response?.data?.message || "Action failed", "error");
        setPendingLifecycleAction(null);
      },
    });
  };

  const breadcrumbs = [
    { label: "Expense Management", to: "/expense-management/dashboard" },
    { label: "Expenses", to: "/expense-management/expenses/my" },
    { label: "My Expenses", to: "/expense-management/expenses/my" },
    { label: report?.title || "Report Details" },
  ];

  const headers = canManage
    ? ["Category", "Merchant", "Date", "Amount", "Policy", "GST", "Net Amount", "Base Amount", "Billable", "Actions"]
    : ["Category", "Merchant", "Date", "Amount", "Policy", "GST", "Net Amount", "Base Amount", "Billable"];
  const columns = canManage
    ? ["category", "merchant", "date", "amount", "policy", "gst", "net", "base", "billable", "actions"]
    : ["category", "merchant", "date", "amount", "policy", "gst", "net", "base", "billable"];

  const tableRows = filteredLineItems.map((li) => {
    const showCurrency = li.currencyCode && (li.currencyCode === "EUR" || li.currencyCode !== li.baseCurrencyCode);
    const rowObj = {
      category: <span className="font-medium text-gray-800">{li.categoryName || "—"}</span>,
      merchant: (
        <div className="text-left">
          <p className="font-medium text-gray-900">{li.merchantName || "—"}</p>
          {li.description && <p className="text-xs text-gray-400 truncate max-w-[180px]">{li.description}</p>}
        </div>
      ),
      date: formatDate(li.expenseDate),
      amount: (
        <span className="font-mono font-semibold text-gray-900">
          {formatAmount(li.amount)} <span className="text-xs text-gray-400">{li.currencyCode}</span>
        </span>
      ),
      policy: <PolicyStatusBadge lineStatus={li.lineStatus} policyWarnings={li.policyWarnings} />,
      gst: (
        <span className="font-mono text-amber-600">
          {formatAmount(li.taxAmount)} {showCurrency && <span className="text-xs text-gray-400">{li.currencyCode}</span>}
        </span>
      ),
      net: (
        <span className="font-mono font-semibold text-emerald-700">
          {formatAmount(li.netAmount)} {showCurrency && <span className="text-xs text-gray-400">{li.currencyCode}</span>}
        </span>
      ),
      base: (
        <span className="font-mono text-[#0A0082] font-semibold">
          {formatAmount(li.baseAmount)} <span className="text-xs text-gray-400">{li.baseCurrencyCode}</span>
        </span>
      ),
      billable: li.clientBillable ? (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Yes</span>
      ) : (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200">No</span>
      ),
    };

    if (canManage) {
      rowObj.actions = (
        <div className="flex items-center gap-1 justify-center">
          <Button
            type="button"
            variant="link"
            size="icon"
            title="View Line Item"
            className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 transition rounded-md"
            onClick={() => openViewLineItem(li)}
          >
            <Eye size={16} />
          </Button>
          <Button
            type="button"
            variant="link"
            size="icon"
            title="Edit Line Item"
            className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition rounded-md"
            onClick={() => openEditLineItem(li)}
          >
            <Pencil size={16} />
          </Button>
          <Button
            type="button"
            variant="link"
            size="icon"
            title="Delete Line Item"
            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-800 transition rounded-md"
            onClick={() => setLineItemToDelete(li)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      );
    }

    return rowObj;
  });

  const handleOcrInputChange = (e) => {
    const { name, value } = e.target;
    setOcrReviewData((prev) => ({ ...prev, [name]: value }));
    if (ocrReviewErrors[name]) setOcrReviewErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleOcrSelectChange = (name, value) => {
    setOcrReviewData((prev) => ({ ...prev, [name]: value }));
    if (ocrReviewErrors[name]) setOcrReviewErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateOcrForm = () => {
    const errors = {};
    const amountNum = Number(ocrReviewData.amount);
    const gstNum = Number(ocrReviewData.taxAmount);

    if (!ocrReviewData.amount || amountNum <= 0) {
      errors.amount = "Amount is required and must be greater than 0.";
    }
    if (ocrReviewData.taxAmount === "" || gstNum < 0) {
      errors.taxAmount = "GST must be zero or a positive number.";
    } else if (amountNum > 0 && gstNum > amountNum) {
      errors.taxAmount = "GST cannot exceed the expense amount.";
    }
    if (!ocrReviewData.merchantName.trim()) errors.merchantName = "Merchant is required.";
    if (!ocrReviewData.currencyId) errors.currencyId = "Currency is required.";
    if (!ocrReviewData.categoryId) errors.categoryId = "Category is required.";
    if (!ocrReviewData.costCenterId) errors.costCenterId = "Cost center is required.";
    if (!ocrReviewData.expenseDate) errors.expenseDate = "Expense date is required.";
    if (ocrReviewData.clientBillable && !ocrReviewData.projectId) {
      errors.projectId = "Project is required when billable.";
    }

    setOcrReviewErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOcrSubmit = async (e) => {
    e.preventDefault();
    if (!validateOcrForm()) return;

    const payload = {
      categoryId: ocrReviewData.categoryId,
      expenseDate: ocrReviewData.expenseDate,
      merchantName: ocrReviewData.merchantName.trim(),
      description: ocrReviewData.description ? ocrReviewData.description.trim() : "",
      amount: Number(ocrReviewData.amount),
      currencyId: ocrReviewData.currencyId,
      taxAmount: Number(ocrReviewData.taxAmount),
      costCenterId: ocrReviewData.costCenterId,
      projectId: ocrReviewData.clientBillable ? (ocrReviewData.projectId || null) : null,
      clientBillable: !!ocrReviewData.clientBillable,
    };

    try {
      setOcrSubmitting(true);
      await api.post(`/xms/employee/receipts/${ocrReviewData.ocrReceiptId}/confirm`, {
        ...payload,
        lineItemId: null
      }, {
        baseURL: window.__APP_CONFIG__?.EXPENSE_MANAGEMENT_URL || "",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        }
      });

      showStatusToast("Line item created and receipt confirmed successfully!", "success");
      fetchLineItems();
      fetchReport();
      setIsOcrReviewOpen(false);
      setScannedFile(null);
    } catch (err) {
      console.error("Error confirming OCR receipt:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to confirm line item.";
      showStatusToast(errMsg, "error");
    } finally {
      setOcrSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={breadcrumbs} />
        <div className="py-24">
          <LoadingSpinner text="Loading expense report..." />
        </div>
      </div>
    );
  }

  if (loadError || !report) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={breadcrumbs} />
        <PageCard>
          <PageCardContent className="flex flex-col items-center justify-center text-center py-16">
            <AlertCircle className="h-10 w-10 text-red-300 mb-3" />
            <h2 className="text-sm font-semibold text-gray-700">Failed to load this expense report</h2>
            <Button variant="outline" size="small" className="mt-4" onClick={fetchAll}>
              Retry
            </Button>
          </PageCardContent>
        </PageCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumb items={breadcrumbs} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Report Information */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-[#0a174e]">{report.title}</h1>
                  <ApprovalStatusPill
                    status={report.reportStatus || "DRAFT"}
                    label={
                      report.reportStatus === "PENDING_APPROVAL" && approvalStatus?.currentLevelDisplayName
                        ? `Pending ${approvalStatus.currentLevelDisplayName}`
                        : undefined
                    }
                  />
                </div>
                <p className="text-xs text-gray-400 font-mono mt-1">{report.reportNumber}</p>
              </div>

              {canManage && (
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {report.reportStatus === "DRAFT" && (
                    <Button
                      variant="primary"
                      size="small"
                      loading={submitReport.isPending}
                      loadingText="Submitting..."
                      onClick={handleSubmitOrResubmit}
                      disabled={report.reportStatus !== "DRAFT" || lineItems.length === 0 || isLifecycleBusy}
                      className={lineItems.length === 0 ? "!pointer-events-auto cursor-not-allowed" : ""}
                    >
                      Submit for Approval
                    </Button>
                  )}
                  {report.reportStatus === "AWAITING_CORRECTION" && (
                    <Button variant="primary" size="small" loading={submitReport.isPending} loadingText="Resubmitting..." onClick={handleSubmitOrResubmit}>
                      Resubmit
                    </Button>
                  )}
                  {report.reportStatus === "QUERY_RAISED" && (
                    <Button variant="primary" size="small" loading={submitReport.isPending} loadingText="Resubmitting..." onClick={handleSubmitOrResubmit}>
                      Resubmit
                    </Button>
                  )}
                  {approvalStatus?.canRecall && (
                    <Button variant="outline" size="small" disabled={isLifecycleBusy} onClick={() => setPendingLifecycleAction("recall")}>
                      Recall to Draft
                    </Button>
                  )}
                  {report.reportStatus !== "DRAFT" && approvalStatus?.canCancel && (
                    <Button variant="outline" size="small" disabled={isLifecycleBusy} onClick={() => setPendingLifecycleAction("cancel")}>
                      Cancel
                    </Button>
                  )}
                  {isReportEditable && (
                    <Button variant="outline" size="small" onClick={openEditReport}>
                      <Pencil size={14} />
                      Edit
                    </Button>
                  )}
                  {report.reportStatus === "DRAFT" && (
                    <Button variant="danger" size="small" onClick={() => setIsDeleteReportOpen(true)}>
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>

            {report.reportStatus === "AWAITING_CORRECTION" && needsCorrectionLines.length > 0 && (
              <div className="mt-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3">
                <p className="text-sm font-semibold text-orange-800">
                  {needsCorrectionLines.length} line item{needsCorrectionLines.length > 1 ? "s" : ""} need correction
                </p>
                <ul className="mt-2 space-y-1.5">
                  {needsCorrectionLines.map((r) => (
                    <li key={r.lineItemId} className="text-sm text-orange-700">
                      <span className="font-medium">{lineItems.find((li) => li.lineItemId === r.lineItemId)?.merchantName || "Line item"}:</span>{" "}
                      {r.comment}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-orange-600">Fix the flagged line(s) below, then click Resubmit above.</p>
              </div>
            )}

            {report.reportStatus === "QUERY_RAISED" && queriedLines.length > 0 && (
              <div className="mt-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3">
                <p className="text-sm font-semibold text-orange-800">
                  Finance Executive requested correction on {queriedLines.length} line item{queriedLines.length > 1 ? "s" : ""}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {queriedLines.map((r) => (
                    <li key={r.lineItemId} className="text-sm text-orange-700">
                      <span className="font-medium">{lineItems.find((li) => li.lineItemId === r.lineItemId)?.merchantName || "Line item"}:</span>{" "}
                      {r.reason || r.comment || "Correction requested"}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-orange-600">Fix the flagged line(s) below, then click Resubmit above.</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField icon={<FileText size={16} />} label="Business Purpose" value={report.businessPurpose || "—"} />
              <DetailField icon={<Briefcase size={16} />} label="Cost Center" value={report.costCenterName || "—"} />
              <DetailField icon={<Landmark size={16} />} label="Report Currency" value={report.currencyCode || "—"} />
              <DetailField icon={<Calendar size={16} />} label="Created" value={formatDate(report.createdAt)} />
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-[#0A0082]">
                  <Receipt size={16} />
                </div>
                <h2 className="text-base font-bold text-gray-900">Line Items</h2>
              </div>
              {canManage && (
                <Button variant="primary" size="small" onClick={openAddLineItem} className="shadow-sm">
                  <Plus size={14} />
                  Add Line Item
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
              <div className="sm:col-span-2">
                <SearchInput value={searchTerm} onSearch={setSearchTerm} placeholder="Search by merchant, category, description..." />
              </div>
              <FormSelect name="sortBy" value={sortBy} onChange={(e) => setSortBy(e.target.value)} options={SORT_OPTIONS} />
            </div>

            {filteredLineItems.length === 0 ? (
              <PageCard>
                <PageCardContent className="flex flex-col items-center justify-center text-center py-16">
                  <Layers className="h-10 w-10 text-gray-300 mb-3" />
                  <h2 className="text-sm font-semibold text-gray-700">No Line Items Yet</h2>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm">
                    {searchTerm
                      ? "No line items match your search."
                      : "Add your first expense line item — currency conversion and GST are calculated automatically."}
                  </p>
                </PageCardContent>
              </PageCard>
            ) : (
              <div className="w-full overflow-x-auto rounded-lg">
                <GenericTable headers={headers} rows={tableRows} columns={columns} />
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-1">
          <SummaryPanel report={{ ...report, status: report?.reportStatus }} lineItems={lineItems} />
        </div>
      </div>

      <LineItemDrawer
        isOpen={isLineItemDrawerOpen}
        onClose={() => setIsLineItemDrawerOpen(false)}
        reportId={reportId}
        lineItem={selectedLineItem}
        defaultCostCenterId={report.costCenterId}
        categoryOptions={categoryOptions}
        costCenterOptions={costCenterOptions}
        currencyOptions={currencyOptions}
        onSaved={handleLineItemSaved}
      />

      <Modal
        isOpen={isSelectionDialogOpen}
        onClose={() => {
          if (selectionStep !== "scanning") {
            setIsSelectionDialogOpen(false);
          }
        }}
        title="Add Line Item"
        subtitle={
          selectionStep === "options"
            ? "Choose how you'd like to add this expense line item."
            : selectionStep === "upload"
              ? "Upload a receipt to scan and auto-fill line item details."
              : selectionStep === "scanning"
                ? "Our AI is reading your receipt metadata. Please wait..."
                : "Review the extracted information below."
        }
        size={selectionStep === "options" ? "xl" : "lg"}
        fullScreenMobile
        closeOnBackdrop={selectionStep !== "scanning"}
        showCloseButton={selectionStep !== "scanning"}
      >
        {selectionStep === "options" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-4">
            {/* Manual Entry */}
            <button
              type="button"
              onClick={handleSelectManual}
              className="flex flex-col items-center justify-between p-6 rounded-2xl border border-gray-200 bg-white hover:border-indigo-600 hover:shadow-lg transition-all duration-300 group text-center"
            >
              <div className="flex flex-col items-center">
                <div className="p-4 rounded-full bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100 transition-colors mb-4">
                  <Keyboard size={28} />
                </div>
                <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  Manual Entry
                </h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  Fill out merchant, amount, category, date, and project information yourself. Best for quick entries.
                </p>
              </div>
              <div className="mt-6 text-xs font-semibold text-indigo-700 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                Start typing &rarr;
              </div>
            </button>

            {/* Automatic Scan */}
            <button
              type="button"
              onClick={() => setSelectionStep("upload")}
              className="flex flex-col items-center justify-between p-6 rounded-2xl border border-gray-200 bg-white hover:border-indigo-600 hover:shadow-lg transition-all duration-300 group text-center relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                AUTOMATIC
              </div>

              <div className="flex flex-col items-center">
                <div className="p-4 rounded-full bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100 transition-colors mb-4">
                  <Sparkles size={28} className="animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  Automatic (AI Scan)
                </h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  Upload a receipt. Our AI automatically extracts merchant, date, amount, and GST calculations in seconds.
                </p>
              </div>
              <div className="mt-6 text-xs font-semibold text-indigo-700 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                Scan receipt &rarr;
              </div>
            </button>
          </div>
        )}

        {selectionStep === "upload" && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setSelectionStep("options")}
                className="text-xs font-medium text-gray-500 hover:text-gray-900 transition flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-gray-100"
              >
                &larr; Back
              </button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                if (e.dataTransfer.files?.length) {
                  handleReceiptFileSelect(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 ${isDraggingFile
                ? "border-indigo-500 bg-indigo-50/50 scale-[0.99]"
                : "border-gray-200 hover:border-indigo-500 bg-gray-50/50"
                }`}
            >
              <input
                type="file"
                id="ocr-receipt-upload"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleReceiptFileSelect(e.target.files[0]);
                  }
                }}
              />
              <label
                htmlFor="ocr-receipt-upload"
                className="cursor-pointer flex flex-col items-center justify-center space-y-4 w-full h-full"
              >
                <div className="p-3 rounded-full bg-white shadow-md text-indigo-600">
                  <UploadCloud size={32} className="animate-bounce" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-800">
                    Drag and drop your receipt here
                  </p>
                  <p className="text-xs text-gray-500">
                    or <span className="text-indigo-600 font-bold hover:underline">browse files</span>
                  </p>
                </div>
                <div className="text-[10px] text-gray-400 border border-gray-200/60 rounded-full px-2.5 py-0.5 bg-white font-medium">
                  Supports PDF, PNG, JPG up to 10MB
                </div>
              </label>
            </div>
          </div>
        )}

        {selectionStep === "scanning" && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative w-20 h-28 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
              <FileText size={40} className="text-gray-400" />
              <div
                className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse"
                style={{
                  top: `${scanningProgress}%`,
                  transition: 'top 0.2s linear'
                }}
              />
            </div>

            <div className="space-y-2 w-full max-w-xs">
              <p className="text-sm font-semibold text-gray-800">
                {scanningProgress < 30 && "Initializing scanner..."}
                {scanningProgress >= 30 && scanningProgress < 75 && "Extracting receipt data..."}
                {scanningProgress >= 75 && scanningProgress < 100 && "Analyzing taxes & currency..."}
                {scanningProgress === 100 && "Scan complete!"}
              </p>

              <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-indigo-600 h-1 rounded-full transition-all duration-200"
                  style={{ width: `${scanningProgress}%` }}
                />
              </div>

              <p className="text-[10px] text-gray-400 font-mono">
                {scanningProgress}% complete
              </p>
            </div>
          </div>
        )}

        {selectionStep === "success" && scannedResult && (
          <div className="py-4 space-y-5">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-2.5 rounded-full bg-green-50 text-green-600">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-base font-bold text-gray-900">Scan Complete!</h3>
              <p className="text-xs text-gray-500">
                Extracted details from <span className="font-semibold text-gray-700">{scannedFile?.name}</span>.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3 shadow-inner">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 block uppercase font-semibold tracking-wider text-[9px]">Merchant</span>
                  <span className="text-gray-900 font-semibold text-sm">{scannedResult.merchantName}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase font-semibold tracking-wider text-[9px]">Date</span>
                  <span className="text-gray-900 font-semibold text-sm">{formatDate(scannedResult.expenseDate)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase font-semibold tracking-wider text-[9px]">Amount</span>
                  <span className="text-[#0A0082] font-mono font-bold text-sm">
                    {formatAmount(scannedResult.amount)} <span className="text-xs text-gray-500">{currencies.find(c => c.currencyId === scannedResult.currencyId)?.currencyCode || ""}</span>
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase font-semibold tracking-wider text-[9px]">GST</span>
                  <span className="text-amber-600 font-mono font-semibold text-sm">{formatAmount(scannedResult.taxAmount)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectionStep("upload");
                  setScannedFile(null);
                  setScannedResult(null);
                }}
                className="w-full sm:w-auto"
              >
                Scan Again
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleContinueToDrawer}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 border-none"
              >
                Continue to Form
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={!!lineItemToDelete}
        title="Delete Line Item"
        message={`Are you sure you want to delete the line item "${lineItemToDelete?.merchantName}"? This action cannot be undone.`}
        confirmText="Delete Line Item"
        cancelText="Cancel"
        onConfirm={handleDeleteLineItemConfirm}
        onCancel={() => setLineItemToDelete(null)}
        isLoading={deletingLineItem}
        variant="danger"
      />

      {isEditReportOpen && createPortal(
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] animate-in fade-in duration-200"
            onClick={() => setIsEditReportOpen(false)}
          />
          {/* Drawer Panel */}
          <div 
            className="fixed inset-y-0 right-0 z-[10000] w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900">Edit Expense Report</h2>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Modify this expense report's properties.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditReportOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <form id="detail-report-edit-form" onSubmit={handleEditReportSubmit} className="py-2">
                <ReportFormFields
                  formData={editFormData}
                  formErrors={editFormErrors}
                  onInputChange={handleEditInputChange}
                  onSelectChange={handleEditSelectChange}
                  costCenterOptions={costCenterOptions}
                  currencyOptions={currencyOptions}
                  disabled={savingReport}
                  lookupsLoading={lookupsLoading}
                />
              </form>
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsEditReportOpen(false)} disabled={savingReport} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" form="detail-report-edit-form" variant="primary" loading={savingReport} loadingText="Saving..." className="w-full sm:w-auto">
                Save Changes
              </Button>
            </div>
          </div>
        </>,
        document.body
      )}

      <ConfirmationModal
        isOpen={isDeleteReportOpen}
        title="Delete Expense Report"
        message={`Are you sure you want to delete "${report.title}"? This will remove all its line items and receipts. This action cannot be undone.`}
        confirmText="Delete Report"
        cancelText="Cancel"
        onConfirm={handleDeleteReportConfirm}
        onCancel={() => setIsDeleteReportOpen(false)}
        isLoading={deletingReport}
        variant="danger"
      />

      {isViewModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-[#f8fafc] flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 shadow-sm">
                <Eye size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">View Line Item</h2>
                <p className="text-xs text-gray-500 font-medium">Detailed read-only information for this expense line item.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsViewModalOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body - 50% / 50% split */}
          <div className="flex-1 flex min-h-0">
            {/* Left Column (50%): Receipt Preview */}
            <div className="w-1/2 bg-[#0b0f19] flex items-center justify-center border-r border-gray-100 min-w-0 h-full overflow-hidden relative group">
              {loadingViewReceipts ? (
                <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
                  <Loader2 size={24} className="animate-spin text-indigo-500" />
                  <span>Loading receipt preview...</span>
                </div>
              ) : viewReceiptPreviewUrl ? (
                viewReceiptFile?.fileName?.toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={viewReceiptPreviewUrl}
                    className="w-full h-full border-0"
                    title="Receipt PDF Preview"
                  />
                ) : (
                  <>
                    <img
                      src={viewReceiptPreviewUrl}
                      style={{
                        transform: `scale(${viewZoom}) rotate(${viewRotation}deg)`,
                        transition: "transform 0.2s ease-in-out",
                      }}
                      className="w-full h-full object-contain"
                      alt="Receipt Image Preview"
                    />
                    <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-slate-700/50 shadow-lg text-white z-10 select-none">
                      <button
                        type="button"
                        onClick={() => setViewZoom((prev) => Math.max(prev - 0.2, 0.5))}
                        className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                        title="Zoom Out (-)"
                      >
                        <ZoomOut size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewZoom((prev) => Math.min(prev + 0.2, 3))}
                        className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                        title="Zoom In (+)"
                      >
                        <ZoomIn size={15} />
                      </button>
                      <div className="w-[1px] h-3 bg-slate-700/50 mx-0.5" />
                      <button
                        type="button"
                        onClick={() => setViewRotation((prev) => prev - 90)}
                        className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                        title="Rotate Left (↺)"
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewRotation((prev) => prev + 90)}
                        className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                        title="Rotate Right (↻)"
                      >
                        <RotateCw size={15} />
                      </button>
                      <div className="w-[1px] h-3 bg-slate-700/50 mx-0.5" />
                      <button
                        type="button"
                        onClick={() => {
                          setViewZoom(1);
                          setViewRotation(0);
                        }}
                        className="px-2 py-0.5 text-[10px] font-bold hover:bg-slate-800 rounded-md transition text-slate-300 hover:text-white"
                        title="Reset"
                      >
                        Reset
                      </button>
                    </div>
                  </>
                )
              ) : (
                <div className="text-sm text-gray-400">No receipt preview available</div>
              )}
            </div>

            {/* Right Column (50%): Form/Details */}
            <div className="w-1/2 bg-white flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {lineItemToView && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailField icon={<Layers size={15} />} label="Category" value={lineItemToView.categoryName || "—"} />
                      <DetailField icon={<Calendar size={15} />} label="Expense Date" value={formatDate(lineItemToView.expenseDate)} />
                      <DetailField icon={<Briefcase size={15} />} label="Merchant" value={lineItemToView.merchantName || "—"} />
                      <DetailField icon={<Briefcase size={15} />} label="Cost Center" value={lineItemToView.costCenterName || "—"} />

                      <div className="col-span-2 grid grid-cols-3 gap-3 bg-gray-50/50 p-3.5 rounded-xl border border-gray-100">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Amount</span>
                          <span className="text-sm font-semibold font-mono text-gray-800">
                            {formatAmount(lineItemToView.amount)} {lineItemToView.currencyCode}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">GST (Tax)</span>
                          <span className="text-sm font-semibold font-mono text-amber-600">
                            {formatAmount(lineItemToView.taxAmount)} {lineItemToView.currencyCode}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Net Amount</span>
                          <span className="text-sm font-semibold font-mono text-emerald-700">
                            {formatAmount(lineItemToView.netAmount)} {lineItemToView.currencyCode}
                          </span>
                        </div>
                      </div>

                      <DetailField icon={<Landmark size={15} />} label="Base Amount" value={`${formatAmount(lineItemToView.baseAmount)} ${lineItemToView.baseCurrencyCode}`} />
                      <DetailField icon={<Briefcase size={15} />} label="Client Billable?" value={lineItemToView.clientBillable ? "Yes" : "No"} />
                      {lineItemToView.clientBillable && (
                        <div className="col-span-2">
                          <DetailField icon={<Briefcase size={15} />} label="Project" value={lineItemToView.projectName || "—"} />
                        </div>
                      )}
                      <div className="col-span-2">
                        <DetailField icon={<FileText size={15} />} label="Description" value={lineItemToView.description || "—"} />
                      </div>
                    </div>

                    {/* Attached Receipts list */}
                    <div className="border-t border-gray-100 pt-4 space-y-2">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Attached Receipts</h3>
                      {loadingViewReceipts ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Loader2 size={14} className="animate-spin text-indigo-500" />
                          <span>Loading receipts list...</span>
                        </div>
                      ) : viewReceipts.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No receipts attached to this line item.</p>
                      ) : (
                        <div className="space-y-2">
                          {viewReceipts.map((r) => {
                            const isActive = viewReceiptFile?.receiptId === r.receiptId;
                            return (
                              <div
                                key={r.receiptId}
                                className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                                  isActive
                                    ? "border-indigo-500 bg-indigo-50/20"
                                    : "border-gray-200/80 bg-white hover:border-indigo-300"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText size={16} className="text-indigo-500 shrink-0" />
                                  <span className="text-xs font-medium text-gray-700 truncate" title={r.fileName}>
                                    {r.fileName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectActiveViewReceipt(r)}
                                    className={`p-1 rounded transition ${
                                      isActive
                                        ? "bg-indigo-100 text-indigo-700"
                                        : "hover:bg-gray-100 text-gray-500 hover:text-indigo-600"
                                    }`}
                                    title="View receipt in panel"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadReceiptForReadonly(r)}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-indigo-600 transition"
                                    title="Download Receipt"
                                  >
                                    <Download size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Footer Actions */}
              <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-3 flex items-center justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsViewModalOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isOcrReviewOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-[#f8fafc] flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 shadow-sm">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Review AI Scanned Receipt</h2>
                <p className="text-xs text-gray-500 font-medium">Verify or edit the extracted details below before saving.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOcrReviewOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body - 50% / 50% split */}
          <div className="flex-1 flex min-h-0">
            {/* Left Column (50%): Receipt Preview */}
            <div className="w-1/2 bg-[#0b0f19] flex items-center justify-center border-r border-gray-100 min-w-0 h-full overflow-hidden relative group">
              {receiptPreviewUrl ? (
                scannedFile?.type === "application/pdf" ? (
                  <iframe
                    src={receiptPreviewUrl}
                    className="w-full h-full border-0"
                    title="Receipt PDF Preview"
                  />
                ) : (
                  <>
                    <img
                      src={receiptPreviewUrl}
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        transition: "transform 0.2s ease-in-out",
                      }}
                      className="w-full h-full object-contain"
                      alt="Receipt Image Preview"
                    />
                    <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-slate-700/50 shadow-lg text-white z-10 select-none">
                      <button
                        type="button"
                        onClick={handleZoomOut}
                        className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                        title="Zoom Out (-)"
                      >
                        <ZoomOut size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomIn}
                        className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                        title="Zoom In (+)"
                      >
                        <ZoomIn size={15} />
                      </button>
                      <div className="w-[1px] h-3 bg-slate-700/50 mx-0.5" />
                      <button
                        type="button"
                        onClick={handleRotateLeft}
                        className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                        title="Rotate Left (↺)"
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={handleRotateRight}
                        className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                        title="Rotate Right (↻)"
                      >
                        <RotateCw size={15} />
                      </button>
                      <div className="w-[1px] h-3 bg-slate-700/50 mx-0.5" />
                      <button
                        type="button"
                        onClick={handleResetView}
                        className="px-2 py-0.5 text-[10px] font-bold hover:bg-slate-800 rounded-md transition text-slate-300 hover:text-white"
                        title="Reset"
                      >
                        Reset
                      </button>
                    </div>
                  </>
                )
              ) : (
                <div className="text-sm text-gray-400">No receipt preview available</div>
              )}
            </div>

            {/* Right Column (50%): Form */}
            <div className="w-1/2 bg-white flex flex-col min-h-0">
              <form onSubmit={handleOcrSubmit} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Category */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-600">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <Select
                        options={categoryOptions}
                        value={categoryOptions.find((o) => o.value === ocrReviewData.categoryId) || null}
                        onChange={(opt) => handleOcrSelectChange("categoryId", opt ? opt.value : "")}
                        placeholder="Select expense category..."
                        isSearchable
                        styles={compactSelectStyles}
                        isDisabled={ocrSubmitting}
                      />
                      {ocrReviewErrors.categoryId && (
                        <span className="text-[11px] text-red-600 block mt-0.5">{ocrReviewErrors.categoryId}</span>
                      )}
                    </div>

                    {/* Merchant */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-600">
                        Merchant <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="merchantName"
                        placeholder="e.g. REDBUS"
                        value={ocrReviewData.merchantName}
                        onChange={handleOcrInputChange}
                        disabled={ocrSubmitting}
                        className={`w-full px-2.5 py-1.5 rounded-md border text-xs transition focus:outline-none focus:ring-2 ${
                          ocrReviewErrors.merchantName
                            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                            : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/20"
                        }`}
                      />
                      {ocrReviewErrors.merchantName && (
                        <span className="text-[11px] text-red-600 block mt-0.5">{ocrReviewErrors.merchantName}</span>
                      )}
                    </div>

                    {/* Expense Date */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-600">
                        Expense Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="expenseDate"
                        value={ocrReviewData.expenseDate}
                        onChange={handleOcrInputChange}
                        disabled={ocrSubmitting}
                        className={`w-full px-2.5 py-1.5 rounded-md border text-xs transition focus:outline-none focus:ring-2 ${
                          ocrReviewErrors.expenseDate
                            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                            : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/20"
                        }`}
                      />
                      {ocrReviewErrors.expenseDate && (
                        <span className="text-[11px] text-red-600 block mt-0.5">{ocrReviewErrors.expenseDate}</span>
                      )}
                    </div>

                    {/* Cost Center */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-600">
                        Cost Center <span className="text-red-500">*</span>
                      </label>
                      <Select
                        options={costCenterOptions}
                        value={costCenterOptions.find((o) => o.value === ocrReviewData.costCenterId) || null}
                        onChange={(opt) => handleOcrSelectChange("costCenterId", opt ? opt.value : "")}
                        placeholder="Select cost center..."
                        isSearchable
                        styles={compactSelectStyles}
                        isDisabled={ocrSubmitting}
                      />
                      {ocrReviewErrors.costCenterId && (
                        <span className="text-[11px] text-red-600 block mt-0.5">{ocrReviewErrors.costCenterId}</span>
                      )}
                    </div>

                    {/* Amount, Currency, and GST in a 3-column sub-grid */}
                    <div className="col-span-2 grid grid-cols-3 gap-3">
                      {/* Amount */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-600">
                          Amount <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          name="amount"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={ocrReviewData.amount}
                          onChange={handleOcrInputChange}
                          disabled={ocrSubmitting}
                          className={`w-full px-2.5 py-1.5 rounded-md border text-xs transition focus:outline-none focus:ring-2 ${
                            ocrReviewErrors.amount
                              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                              : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/20"
                          }`}
                        />
                        {ocrReviewErrors.amount && (
                          <span className="text-[11px] text-red-600 block mt-0.5">{ocrReviewErrors.amount}</span>
                        )}
                      </div>

                      {/* Currency */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-600">
                          Currency <span className="text-red-500">*</span>
                        </label>
                        <Select
                          options={currencyOptions}
                          value={currencyOptions.find((o) => o.value === ocrReviewData.currencyId) || null}
                          onChange={(opt) => handleOcrSelectChange("currencyId", opt ? opt.value : "")}
                          placeholder="Select currency..."
                          isSearchable
                          styles={compactSelectStyles}
                          isDisabled={ocrSubmitting}
                        />
                        {ocrReviewErrors.currencyId && (
                          <span className="text-[11px] text-red-600 block mt-0.5">{ocrReviewErrors.currencyId}</span>
                        )}
                      </div>

                      {/* GST */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-gray-600">
                          GST <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          name="taxAmount"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={ocrReviewData.taxAmount}
                          onChange={handleOcrInputChange}
                          disabled={ocrSubmitting}
                          className={`w-full px-2.5 py-1.5 rounded-md border text-xs transition focus:outline-none focus:ring-2 ${
                            ocrReviewErrors.taxAmount
                              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                              : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/20"
                        }`}
                        />
                        {ocrReviewErrors.taxAmount && (
                          <span className="text-[11px] text-red-600 block mt-0.5">{ocrReviewErrors.taxAmount}</span>
                        )}
                      </div>
                    </div>

                    {/* Client Billable & Project */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-600">Client Billable?</label>
                      <select
                        name="clientBillable"
                        value={ocrReviewData.clientBillable.toString()}
                        onChange={(e) => handleOcrSelectChange("clientBillable", e.target.value === "true")}
                        disabled={ocrSubmitting}
                        className="w-full px-2.5 py-1.5 h-[32px] rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white animate-none"
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-600">
                        Project {ocrReviewData.clientBillable && <span className="text-red-500">*</span>}
                      </label>
                      <Select
                        options={projects
                          .filter((p) => (p.status || "").toString().toUpperCase() === "ACTIVE")
                          .map((p) => ({ value: p.projectId, label: `${p.projectCode} - ${p.projectName}` }))}
                        value={projects
                          .filter((p) => (p.status || "").toString().toUpperCase() === "ACTIVE")
                          .map((p) => ({ value: p.projectId, label: `${p.projectCode} - ${p.projectName}` }))
                          .find((o) => o.value === ocrReviewData.projectId) || null}
                        onChange={(opt) => handleOcrSelectChange("projectId", opt ? opt.value : "")}
                        placeholder="Select project..."
                        isSearchable
                        styles={compactSelectStyles}
                        isDisabled={ocrSubmitting || !ocrReviewData.clientBillable}
                      />
                      {ocrReviewErrors.projectId && (
                        <span className="text-[11px] text-red-600 block mt-0.5">{ocrReviewErrors.projectId}</span>
                      )}
                    </div>

                    {/* Description */}
                    <div className="col-span-2 space-y-1">
                      <label className="block text-xs font-semibold text-gray-600">Description</label>
                      <input
                        type="text"
                        name="description"
                        placeholder="Optional notes about this expense..."
                        value={ocrReviewData.description}
                        onChange={handleOcrInputChange}
                        disabled={ocrSubmitting}
                        className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Real-time Cards */}
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <GstCalculationCard amount={ocrReviewData.amount} gst={ocrReviewData.taxAmount} />
                    <CurrencyConversionCard
                      amount={ocrReviewData.amount}
                      currencyCode={currencyOptions.find((o) => o.value === ocrReviewData.currencyId)?.code}
                      pending={true}
                    />
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-3 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOcrReviewOpen(false)}
                    disabled={ocrSubmitting}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={ocrSubmitting}
                    loadingText="Saving..."
                    disabled={ocrSubmitting}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 border-none"
                  >
                    Save & Confirm
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: "0.5rem",
    borderColor: state.isFocused ? "#3b82f6" : "#d1d5db",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(59, 130, 246, 0.5)" : "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    padding: "0.125rem 0.25rem",
    minHeight: "42px",
    backgroundColor: "#ffffff",
    "&:hover": { borderColor: state.isFocused ? "#3b82f6" : "#d1d5db" },
  }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

const compactSelectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: "0.375rem",
    borderColor: state.isFocused ? "#3b82f6" : "#d1d5db",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(59, 130, 246, 0.5)" : "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    padding: "0px 4px",
    minHeight: "32px",
    height: "32px",
    backgroundColor: "#ffffff",
    "&:hover": { borderColor: state.isFocused ? "#3b82f6" : "#d1d5db" },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0px 6px",
    height: "30px",
  }),
  input: (base) => ({
    ...base,
    margin: "0px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: "30px",
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: "4px",
  }),
  clearIndicator: (base) => ({
    ...base,
    padding: "4px",
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: "0.75rem",
  }),
  placeholder: (base) => ({
    ...base,
    fontSize: "0.75rem",
  }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

const emptyForm = (defaultCostCenterId) => ({
  categoryId: "",
  expenseDate: "",
  merchantName: "",
  description: "",
  amount: "",
  currencyId: "",
  taxAmount: "0",
  costCenterId: defaultCostCenterId || "",
  clientBillable: false,
  projectId: "",
});

function LineItemDrawer({
  isOpen,
  onClose,
  reportId,
  lineItem,
  defaultCostCenterId,
  categoryOptions = [],
  costCenterOptions = [],
  currencyOptions = [],
  onSaved,
}) {
  const [formData, setFormData] = useState(emptyForm(defaultCostCenterId));
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [savedLineItem, setSavedLineItem] = useState(null);
  const [ocrReceiptId, setOcrReceiptId] = useState(null);
  const [projects, setProjects] = useState([]);

  const [editActiveReceiptUrl, setEditActiveReceiptUrl] = useState("");
  const [editActiveReceiptFile, setEditActiveReceiptFile] = useState(null);
  const [editZoom, setEditZoom] = useState(1);
  const [editRotation, setEditRotation] = useState(0);

  const [receipts, setReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]); // [{ id, file, name, size }]
  const [receiptToDelete, setReceiptToDelete] = useState(null);
  const [deletingReceipt, setDeletingReceipt] = useState(false);
  const inputRef = useRef(null);

  const isEditingExisting = !!lineItem;

  const fetchReceipts = useCallback(async () => {
    const idToFetch = lineItem?.lineItemId || savedLineItem?.lineItemId;
    if (!idToFetch) return;
    try {
      setLoadingReceipts(true);
      const res = await receiptService.getAll(idToFetch);
      const list = Array.isArray(res.data) ? res.data : res.data?.receipts || res.data?.content || res.data?.data || [];
      setReceipts(list);
    } catch (err) {
      console.error("Failed to fetch receipts:", err);
    } finally {
      setLoadingReceipts(false);
    }
  }, [lineItem?.lineItemId, savedLineItem?.lineItemId]);

  useEffect(() => {
    if (isOpen && (lineItem?.lineItemId || savedLineItem?.lineItemId)) {
      fetchReceipts();
    }
  }, [isOpen, lineItem?.lineItemId, savedLineItem?.lineItemId, fetchReceipts]);

  useEffect(() => {
    if (!isOpen) {
      setSavedLineItem(null);
      setPendingFiles([]);
      setReceipts([]);
      setOcrReceiptId(null);
      return;
    }

    const loadProjects = async () => {
      try {
        const res = await api.get("/xms/admin/projects", {
          baseURL: window.__APP_CONFIG__?.EXPENSE_MANAGEMENT_URL || "",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const list = res.data?.data || res.data || [];
        setProjects(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    };
    loadProjects();

    if (lineItem) {
      if (!savedLineItem ||
        lineItem.lineItemId !== savedLineItem.lineItemId ||
        lineItem.ocrReceiptId !== savedLineItem.ocrReceiptId) {
        const isOcr = !!lineItem.ocrReceiptId && !lineItem.lineItemId;
        setFormData({
          categoryId: lineItem.categoryId || "",
          expenseDate: lineItem.expenseDate || new Date().toISOString().split("T")[0],
          merchantName: lineItem.merchantName || "",
          description: lineItem.description || "",
          amount: lineItem.amount ?? "",
          currencyId: lineItem.currencyId || "",
          taxAmount: lineItem.taxAmount ?? "0",
          costCenterId: isOcr ? "" : (lineItem.costCenterId || defaultCostCenterId || ""),
          clientBillable: !!lineItem.clientBillable,
          projectId: lineItem.projectId || "",
        });
        setSavedLineItem(lineItem);
        setOcrReceiptId(lineItem.ocrReceiptId || null);
        if (lineItem.scannedFile) {
          setPendingFiles([
            {
              id: Math.random().toString(36).substring(2, 9),
              file: lineItem.scannedFile,
              name: lineItem.scannedFile.name,
              size: lineItem.scannedFile.size,
            },
          ]);
        }
      }
    } else {
      setFormData(emptyForm(defaultCostCenterId));
      setSavedLineItem(null);
      setOcrReceiptId(null);
    }
    setFormErrors({});
  }, [isOpen, lineItem, defaultCostCenterId]);

  // Set the first receipt as active when receipts load or pending files change
  useEffect(() => {
    const loadFirstReceiptUrl = async () => {
      // If we have uploaded receipts and haven't selected one yet, select the first
      if (receipts.length > 0) {
        if (!editActiveReceiptFile || !receipts.some(r => r.receiptId === editActiveReceiptFile.receiptId)) {
          const first = receipts[0];
          setEditActiveReceiptFile(first);
          try {
            const res = await receiptService.getViewUrl(first.receiptId);
            const url = extractUrl(res.data?.data || res.data);
            if (url) setEditActiveReceiptUrl(url);
          } catch (err) {
            console.error("Failed to load edit active receipt url:", err);
          }
        }
      } 
      // If no uploaded receipts, check pending files
      else if (pendingFiles.length > 0) {
        if (!editActiveReceiptFile || !pendingFiles.some(pf => pf.id === editActiveReceiptFile.id)) {
          const first = pendingFiles[0];
          setEditActiveReceiptFile(first);
          if (first.file) {
            const url = URL.createObjectURL(first.file);
            setEditActiveReceiptUrl(url);
          }
        }
      }
      // If nothing is present, clear active
      else {
        setEditActiveReceiptFile(null);
        setEditActiveReceiptUrl("");
      }
    };
    loadFirstReceiptUrl();
  }, [receipts, pendingFiles]);

  // Clean up object URLs to prevent leaks
  useEffect(() => {
    return () => {
      if (editActiveReceiptUrl && editActiveReceiptUrl.startsWith("blob:")) {
        URL.revokeObjectURL(editActiveReceiptUrl);
      }
    };
  }, [editActiveReceiptUrl]);

  // Reset viewer when modal closes/opens
  useEffect(() => {
    if (!isOpen) {
      setEditActiveReceiptUrl("");
      setEditActiveReceiptFile(null);
      setEditZoom(1);
      setEditRotation(0);
    }
  }, [isOpen]);

  const handleSelectEditReceipt = async (receipt) => {
    try {
      setEditActiveReceiptFile(receipt);
      setEditActiveReceiptUrl("");
      if (receipt.receiptId) {
        const res = await receiptService.getViewUrl(receipt.receiptId);
        const url = extractUrl(res.data?.data || res.data);
        if (url) setEditActiveReceiptUrl(url);
      } else if (receipt.file) {
        const url = URL.createObjectURL(receipt.file);
        setEditActiveReceiptUrl(url);
      }
    } catch (err) {
      console.error("Failed to select edit receipt:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileChange = (files) => {
    if (!files?.length) return;
    const newFiles = [];
    let hasDuplicate = false;

    const allowedExtensions = ["pdf", "png", "jpg", "jpeg"];

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        showStatusToast("Only PDF, PNG, JPG, and JPEG files are allowed.", "error");
        continue;
      }

      const isPendingDuplicate = pendingFiles.some(
        (pf) => pf.name === file.name && pf.size === file.size
      );
      const isUploadedDuplicate = receipts.some(
        (r) => r.fileName === file.name && r.fileSize === file.size
      );

      if (isPendingDuplicate || isUploadedDuplicate) {
        hasDuplicate = true;
      } else {
        newFiles.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          size: file.size,
        });
      }
    }

    if (hasDuplicate) {
      showStatusToast("This receipt has already been uploaded.", "error");
    }

    if (newFiles.length > 0) {
      setPendingFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleViewReceipt = async (receipt) => {
    try {
      if (receipt.receiptId) {
        const res = await receiptService.getViewUrl(receipt.receiptId);
        const url = extractUrl(res.data?.data || res.data);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      } else if (receipt.file) {
        const url = URL.createObjectURL(receipt.file);
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      showStatusToast("Failed to open receipt preview.", "error");
    }
  };

  const handleDownloadReceipt = async (receipt) => {
    try {
      const res = await receiptService.getDownloadUrl(receipt.receiptId);
      const url = extractUrl(res.data?.data || res.data);
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

  const handleDeleteReceiptConfirm = async () => {
    if (!receiptToDelete) return;
    try {
      setDeletingReceipt(true);
      await receiptService.delete(receiptToDelete.receiptId);
      showStatusToast("Receipt deleted successfully!", "success");
      setReceiptToDelete(null);
      fetchReceipts();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to delete receipt.";
      showStatusToast(errMsg, "error");
    } finally {
      setDeletingReceipt(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    const amountNum = Number(formData.amount);
    const gstNum = Number(formData.taxAmount);

    if (!formData.amount || amountNum <= 0) {
      errors.amount = "Amount is required and must be greater than 0.";
    }
    if (formData.taxAmount === "" || gstNum < 0) {
      errors.taxAmount = "GST must be zero or a positive number.";
    } else if (amountNum > 0 && gstNum > amountNum) {
      errors.taxAmount = "GST cannot exceed the expense amount.";
    }
    if (!formData.merchantName.trim()) errors.merchantName = "Merchant is required.";
    if (!formData.currencyId) errors.currencyId = "Currency is required.";
    if (!formData.categoryId) errors.categoryId = "Category is required.";
    if (!formData.costCenterId) errors.costCenterId = "Cost center is required.";
    if (!formData.expenseDate) errors.expenseDate = "Expense date is required.";
    if (formData.clientBillable && !formData.projectId) {
      errors.projectId = "Project is required when billable.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Enforcement (not severity) decides the outcome — see PolicyStatusBadge.
  // BLOCKED keeps the drawer open (with the violation banner visible) rather
  // than closing behind a misleading success toast; WARNING still follows
  // the normal save-and-close flow but surfaces the warning via toast.
  const finalizeLineItemSave = (savedItem, successMessage, { closeOnSuccess = false } = {}) => {
    const { status, warnings } = derivePolicyStatus(savedItem?.lineStatus, savedItem?.policyWarnings);
    setSavedLineItem(savedItem);

    if (status === "BLOCKED") {
      const firstMsg = warnings[0]?.message;
      showStatusToast(
        firstMsg ? `Saved, but blocked by policy: ${firstMsg}` : "Saved, but this line item is blocked by policy.",
        "error"
      );
      onSaved?.();
      return;
    }

    if (status === "WARNING") {
      const firstMsg = warnings[0]?.message;
      showStatusToast(
        firstMsg ? `${successMessage} Policy warning: ${firstMsg}` : `${successMessage} (Policy warning)`,
        "warning"
      );
    } else {
      showStatusToast(successMessage, "success");
    }

    onSaved?.();
    if (closeOnSuccess) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      categoryId: formData.categoryId,
      expenseDate: formData.expenseDate,
      merchantName: formData.merchantName.trim(),
      description: formData.description ? formData.description.trim() : "",
      amount: Number(formData.amount),
      currencyId: formData.currencyId,
      taxAmount: Number(formData.taxAmount),
      costCenterId: formData.costCenterId,
      projectId: formData.clientBillable ? (formData.projectId || null) : null,
      clientBillable: !!formData.clientBillable,
    };

    try {
      setSubmitting(true);
      let res;
      if (savedLineItem && savedLineItem.lineItemId) {
        res = await lineItemService.update(reportId, savedLineItem.lineItemId, payload);
        const lineItemId = savedLineItem.lineItemId;

        if (lineItemId && pendingFiles.length > 0) {
          for (const pf of pendingFiles) {
            const formDataUpload = new FormData();
            const safeName = pf.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            formDataUpload.append("file", pf.file, safeName);
            try {
              await receiptService.upload(lineItemId, formDataUpload);
            } catch (uploadErr) {
              console.error(`Failed to upload ${pf.name}:`, uploadErr);
              showStatusToast(`Failed to upload ${pf.name}`, "error");
            }
          }
          setPendingFiles([]);
        }

        const updatedItem = res.data?.data || res.data || { ...payload, lineItemId };
        fetchReceipts();
        finalizeLineItemSave(updatedItem, "Line item updated successfully!");
      } else if (ocrReceiptId) {
        // OCR Confirm flow
        res = await api.post(`/xms/employee/receipts/${ocrReceiptId}/confirm`, {
          ...payload,
          lineItemId: null
        }, {
          baseURL: window.__APP_CONFIG__?.EXPENSE_MANAGEMENT_URL || "",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          }
        });
        const createdItem = res.data?.data || res.data;
        finalizeLineItemSave(createdItem, "Line item created and receipt confirmed successfully!", { closeOnSuccess: true });
      } else {
        res = await lineItemService.create(reportId, payload);
        const createdItem = res.data?.data || res.data;
        const lineItemId = createdItem?.lineItemId;

        if (lineItemId && pendingFiles.length > 0) {
          for (const pf of pendingFiles) {
            const formDataUpload = new FormData();
            const safeName = pf.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            formDataUpload.append("file", pf.file, safeName);
            try {
              await receiptService.upload(lineItemId, formDataUpload);
            } catch (uploadErr) {
              console.error(`Failed to upload ${pf.name}:`, uploadErr);
              showStatusToast(`Failed to upload ${pf.name}`, "error");
            }
          }
        }

        finalizeLineItemSave(createdItem, "Line item added successfully!", { closeOnSuccess: true });
      }
    } catch (err) {
      console.error("Error saving line item:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to save line item.";
      showStatusToast(errMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const mergedCategoryOptions = useMemo(() => {
    if (!lineItem?.categoryId) return categoryOptions;
    const alreadyPresent = categoryOptions.some((o) => o.value === lineItem.categoryId);
    if (alreadyPresent) return categoryOptions;
    return [{ value: lineItem.categoryId, label: lineItem.categoryName || lineItem.categoryId }, ...categoryOptions];
  }, [categoryOptions, lineItem]);

  const projectOptions = useMemo(() => {
    return projects
      .filter((p) => (p.status || "").toString().toUpperCase() === "ACTIVE")
      .map((p) => ({
        value: p.projectId,
        label: `${p.projectCode} - ${p.projectName}`,
      }));
  }, [projects]);

  const selectedCurrency = currencyOptions.find((o) => o.value === formData.currencyId) || null;
  const selectedCostCenter = costCenterOptions.find((o) => o.value === formData.costCenterId) || null;
  const selectedCategory = mergedCategoryOptions.find((o) => o.value === formData.categoryId) || null;

  const renderFormFields = () => {
    return (
      <div className="space-y-3 py-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-0.5">
            <label className="block text-xs font-semibold text-gray-600">
              Category <span className="text-red-500">*</span>
            </label>
            <Select
              options={mergedCategoryOptions}
              value={selectedCategory}
              onChange={(opt) => handleSelectChange("categoryId", opt ? opt.value : "")}
              placeholder="Select expense category..."
              isSearchable
              styles={compactSelectStyles}
              isDisabled={submitting}
            />
            {formErrors.categoryId && <span className="text-[11px] text-red-600 block mt-0.5">{formErrors.categoryId}</span>}
          </div>

          <FormInput
            label="Expense Date *"
            name="expenseDate"
            type="date"
            value={formData.expenseDate}
            onChange={handleInputChange}
            className="space-y-0.5"
            labelClassName="block text-xs font-semibold text-gray-600"
            inputClassName="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm h-8"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormInput
            label="Merchant"
            name="merchantName"
            placeholder="e.g. REDBUS"
            value={formData.merchantName}
            onChange={handleInputChange}
            requiredMark
            disabled={submitting}
            error={formErrors.merchantName}
            className="space-y-0.5"
            labelClassName="block text-xs font-semibold text-gray-600"
            inputClassName="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm h-8"
          />

          <div className="space-y-0.5">
            <label className="block text-xs font-semibold text-gray-600">
              Cost Center <span className="text-red-500">*</span>
            </label>
            <Select
              options={costCenterOptions}
              value={selectedCostCenter}
              onChange={(opt) => handleSelectChange("costCenterId", opt ? opt.value : "")}
              placeholder="Select cost center..."
              isSearchable
              styles={compactSelectStyles}
              isDisabled={submitting}
            />
            {formErrors.costCenterId && <span className="text-[11px] text-red-600 block mt-0.5">{formErrors.costCenterId}</span>}
          </div>
        </div>

        <div className="space-y-0.5">
          <label htmlFor="description" className="block text-xs font-semibold text-gray-600">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Optional notes about this expense..."
            rows={2}
            disabled={submitting}
            className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs shadow-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormInput
            label="Amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.amount}
            onChange={handleInputChange}
            requiredMark
            disabled={submitting}
            error={formErrors.amount}
            className="space-y-0.5"
            labelClassName="block text-xs font-semibold text-gray-600"
            inputClassName="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm h-8"
          />

          <div className="space-y-0.5">
            <label className="block text-xs font-semibold text-gray-600">
              Currency <span className="text-red-500">*</span>
            </label>
            <Select
              options={currencyOptions}
              value={selectedCurrency}
              onChange={(opt) => handleSelectChange("currencyId", opt ? opt.value : "")}
              placeholder="Select currency..."
              isSearchable
              styles={compactSelectStyles}
              isDisabled={submitting}
            />
            {formErrors.currencyId && <span className="text-[11px] text-red-600 block mt-0.5">{formErrors.currencyId}</span>}
          </div>

          <FormInput
            label="GST"
            name="taxAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.taxAmount}
            onChange={handleInputChange}
            requiredMark
            disabled={submitting}
            error={formErrors.taxAmount}
            className="space-y-0.5"
            labelClassName="block text-xs font-semibold text-gray-600"
            inputClassName="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm h-8"
          />
        </div>

        <div className="space-y-0.5">
          <label className="block text-xs font-semibold text-gray-600">
            Client Billable?
          </label>
          <select
            name="clientBillable"
            value={formData.clientBillable.toString()}
            onChange={(e) => handleSelectChange("clientBillable", e.target.value === "true")}
            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm h-8"
            disabled={submitting}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        {formData.clientBillable && (
          <div className="space-y-0.5">
            <label className="block text-xs font-semibold text-gray-600">
              Project <span className="text-red-500">*</span>
            </label>
            <Select
              options={projectOptions}
              value={projectOptions.find((o) => o.value === formData.projectId) || null}
              onChange={(opt) => handleSelectChange("projectId", opt ? opt.value : "")}
              placeholder="Select project..."
              isSearchable
              styles={compactSelectStyles}
              isDisabled={submitting}
            />
            {formErrors.projectId && <span className="text-[11px] text-red-600 block mt-0.5">{formErrors.projectId}</span>}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GstCalculationCard amount={formData.amount} gst={formData.taxAmount} />
          <CurrencyConversionCard
            amount={formData.amount}
            currencyCode={selectedCurrency?.code}
            exchangeRate={savedLineItem?.exchangeRate}
            baseAmount={savedLineItem?.baseAmount}
            baseCurrencyCode={savedLineItem?.baseCurrencyCode}
            pending={!savedLineItem}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-600">Receipts</label>
          {isEditingExisting ? (
            <div className="space-y-2">
              {loadingReceipts ? (
                <div className="flex items-center justify-center py-4 text-gray-400">
                  <Loader2 className="animate-spin" size={16} />
                </div>
              ) : receipts.length === 0 ? (
                <p className="text-center text-[11px] text-gray-400 py-1">No receipts uploaded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {receipts.map((r) => {
                    const isActive = editActiveReceiptFile?.receiptId === r.receiptId;
                    return (
                      <div
                        key={r.receiptId}
                        className={`flex items-center gap-2 rounded-lg border p-2 transition ${
                          isActive
                            ? "border-indigo-500 bg-indigo-50/20"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="shrink-0 p-1.5 rounded-lg bg-blue-50 text-blue-600">
                          {isImageFile(r.fileName) ? <ImageIcon size={14} /> : <FileText size={14} />}
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
                            className={`h-6 w-6 p-0 rounded-md transition ${
                              isActive ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-100"
                            }`}
                            onClick={() => handleSelectEditReceipt(r)}
                          >
                            <Eye size={12} />
                          </Button>
                          <Button
                            type="button"
                            variant="link"
                            size="icon"
                            title="Download Receipt"
                            className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-50 rounded-md"
                            onClick={() => handleDownloadReceipt(r)}
                          >
                            <Download size={12} />
                          </Button>
                          <Button
                            type="button"
                            variant="link"
                            size="icon"
                            title="Delete Receipt"
                            className="h-6 w-6 p-0 text-red-600 hover:bg-red-50 rounded-md"
                            onClick={() => setReceiptToDelete(r)}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add More Receipts Section */}
              <div className="mt-2 space-y-1.5">
                <p className="text-xs font-semibold text-gray-700">Add More Receipts</p>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFileChange(e.dataTransfer.files);
                  }}
                  onClick={() => inputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-3 text-center cursor-pointer transition ${isDragging ? "border-[#0A0082] bg-indigo-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    }`}
                >
                  <UploadCloud className={isDragging ? "text-[#0A0082]" : "text-gray-400"} size={18} />
                  <p className="text-[11px] font-medium text-gray-600">
                    Drag &amp; drop a receipt, or <span className="text-[#0A0082] font-semibold">browse</span>
                  </p>
                  <p className="text-[9px] text-gray-400">PDF, PNG, JPG up to 10MB</p>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      handleFileChange(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>

                {pendingFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {pendingFiles.map((pf) => {
                      const isActive = editActiveReceiptFile?.id === pf.id;
                      return (
                        <div
                          key={pf.id}
                          className={`flex items-center gap-2 rounded-lg border p-2 transition ${
                            isActive
                              ? "border-indigo-500 bg-indigo-50/20"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="shrink-0 p-1.5 rounded-lg bg-blue-50 text-blue-600">
                            {isImageFile(pf.name) ? <ImageIcon size={14} /> : <FileText size={14} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-800 truncate">{pf.name}</p>
                            <p className="text-[10px] text-gray-400">
                              {formatFileSize(pf.size)}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              type="button"
                              variant="link"
                              size="icon"
                              title="View Receipt"
                              className={`h-6 w-6 p-0 rounded-md transition ${
                                isActive ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-100"
                              }`}
                              onClick={() => handleSelectEditReceipt(pf)}
                            >
                              <Eye size={12} />
                            </Button>
                            <Button
                              type="button"
                              variant="link"
                              size="icon"
                              title="Remove File"
                              className="h-6 w-6 p-0 text-red-600 hover:bg-red-50 rounded-md"
                              onClick={() => {
                                setPendingFiles((prev) => prev.filter((item) => item.id !== pf.id));
                                if (editActiveReceiptFile?.id === pf.id) {
                                  setEditActiveReceiptFile(null);
                                  setEditActiveReceiptUrl("");
                                }
                              }}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFileChange(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition ${isDragging ? "border-[#0A0082] bg-indigo-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                  }`}
              >
                <UploadCloud className={isDragging ? "text-[#0A0082]" : "text-gray-400"} size={20} />
                <p className="text-[11px] font-medium text-gray-600">
                  Drag &amp; drop a receipt, or <span className="text-[#0A0082] font-semibold">browse</span>
                </p>
                <p className="text-[9px] text-gray-400">PDF, PNG, JPG up to 10MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                  className="hidden"
                  onChange={(e) => {
                    handleFileChange(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {pendingFiles.length > 0 && (
                <div className="space-y-1.5">
                  {pendingFiles.map((pf) => (
                    <div
                      key={pf.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 hover:border-gray-300 transition"
                    >
                      <div className="shrink-0 p-1.5 rounded-lg bg-blue-50 text-blue-600">
                        {isImageFile(pf.name) ? <ImageIcon size={14} /> : <FileText size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-800 truncate">{pf.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {formatFileSize(pf.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          type="button"
                          variant="link"
                          size="icon"
                          title="View Receipt"
                          className="h-6 w-6 p-0 text-gray-600 hover:bg-gray-100 rounded-md"
                          onClick={() => handleViewReceipt(pf)}
                        >
                          <Eye size={12} />
                        </Button>
                        <Button
                          type="button"
                          variant="link"
                          size="icon"
                          title="Remove File"
                          className="h-6 w-6 p-0 text-red-600 hover:bg-red-50 rounded-md"
                          onClick={() => setPendingFiles((prev) => prev.filter((item) => item.id !== pf.id))}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-[#f8fafc] flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 shadow-sm">
            {savedLineItem ? <Pencil size={20} /> : <Plus size={20} />}
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {savedLineItem ? "Edit Line Item" : "Add Line Item"}
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              {savedLineItem
                ? "Modify this expense line item, or attach supporting receipts below."
                : "Capture a single expense with real-time currency and GST calculation."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body - 50% / 50% split */}
      <div className="flex-1 flex min-h-0">
        {/* Left Column (50%): Receipt Preview */}
        <div className="w-1/2 bg-[#0b0f19] flex items-center justify-center border-r border-gray-100 min-w-0 h-full overflow-hidden relative group">
          {loadingReceipts ? (
            <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
              <span>Loading receipt...</span>
            </div>
          ) : editActiveReceiptUrl ? (
            editActiveReceiptFile?.fileName?.toLowerCase().endsWith(".pdf") || 
            editActiveReceiptFile?.name?.toLowerCase().endsWith(".pdf") ? (
              <iframe
                src={editActiveReceiptUrl}
                className="w-full h-full border-0"
                title="Receipt PDF Preview"
              />
            ) : (
              <>
                <img
                  src={editActiveReceiptUrl}
                  style={{
                    transform: `scale(${editZoom}) rotate(${editRotation}deg)`,
                    transition: "transform 0.2s ease-in-out",
                  }}
                  className="w-full h-full object-contain"
                  alt="Receipt Image Preview"
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-slate-700/50 shadow-lg text-white z-10 select-none">
                  <button
                    type="button"
                    onClick={() => setEditZoom((prev) => Math.max(prev - 0.2, 0.5))}
                    className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditZoom((prev) => Math.min(prev + 0.2, 3))}
                    className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                    title="Zoom In (+)"
                  >
                    <ZoomIn size={15} />
                  </button>
                  <div className="w-[1px] h-3 bg-slate-700/50 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setEditRotation((prev) => prev - 90)}
                    className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                    title="Rotate Left (↺)"
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditRotation((prev) => prev + 90)}
                    className="p-1 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white"
                    title="Rotate Right (↻)"
                  >
                    <RotateCw size={15} />
                  </button>
                  <div className="w-[1px] h-3 bg-slate-700/50 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => {
                      setEditZoom(1);
                      setEditRotation(0);
                    }}
                    className="px-2 py-0.5 text-[10px] font-bold hover:bg-slate-800 rounded-md transition text-slate-300 hover:text-white"
                    title="Reset"
                  >
                    Reset
                  </button>
                </div>
              </>
            )
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400 select-none">
              <UploadCloud size={32} className="text-slate-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-400">No receipt preview available</span>
              <span className="text-[10px] text-slate-500 max-w-[220px] text-center leading-relaxed">Please upload a receipt on the right side to preview it here.</span>
            </div>
          )}
        </div>

        {/* Right Column (50%): Form Fields */}
        <div className="w-1/2 flex flex-col min-h-0 bg-white">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {ocrReceiptId && (
              <div className="mb-4 flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-200 px-3.5 py-2.5 text-xs font-medium text-indigo-700 shadow-sm">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-indigo-500 animate-pulse shrink-0" />
                  <span>AI Scanned: We've pre-filled fields using OCR with {lineItem?.confidenceScore ? `${Math.round(lineItem.confidenceScore <= 1 ? lineItem.confidenceScore * 100 : lineItem.confidenceScore)}%` : "100%"} confidence.</span>
                </div>
              </div>
            )}

            {categoryOptions.length === 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700">
                <AlertTriangle size={14} />
                Expense categories couldn't be loaded for your account.
              </div>
            )}

            <form id="line-item-form" onSubmit={handleSubmit} className="space-y-4">
              {renderFormFields()}
            </form>
          </div>

          {/* Footer Action Bar */}
          <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-3 flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="submit"
              form="line-item-form"
              variant="primary"
              loading={submitting}
              loadingText="Saving..."
              disabled={submitting}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 border-none"
            >
              {savedLineItem ? "Save Changes" : "Save Line Item"}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!receiptToDelete}
        title="Delete Receipt"
        message={`Are you sure you want to delete the receipt "${receiptToDelete?.fileName}"? This action cannot be undone.`}
        confirmText="Delete Receipt"
        cancelText="Cancel"
        onConfirm={handleDeleteReceiptConfirm}
        onCancel={() => setReceiptToDelete(null)}
        isLoading={deletingReceipt}
        variant="danger"
      />
    </div>,
    document.body
  );
}

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageFile = (fileName = "") => /\.(png|jpe?g|gif|webp|heic)$/i.test(fileName);

const extractUrl = (data) => {
  if (!data) return null;
  if (typeof data === "string") return data;
  return data.url || data.viewUrl || data.downloadUrl || data.presignedUrl || null;
};
