import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Sparkles,
  Briefcase,
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Eye,
  X,
  Receipt,
  Layers,
  Calendar,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import Button from "@/components/Button/Button";
import { showStatusToast } from "@/components/toastfy/toast";
import {
  expenseReportService,
  lookupService,
  lineItemService,
  receiptService,
} from "@/pages/expense-management/api/expenseReportsApi";
import Select from "react-select";
import FormInput from "@/components/forms/FormInput";
import FormTextArea from "@/components/forms/FormTextArea";
import WizardStepper from "@/pages/account_receivable/components/common/WizardStepper";
import GenericTable from "@/components/Table/table";
import SearchInput from "@/components/filter/Searchbar";
import PolicyStatusBadge from "@/pages/expense-management/components/expense-reports/PolicyStatusBadge";
import SummaryPanel from "@/pages/expense-management/components/expense-reports/SummaryPanel";
import { useSubmitReport } from "@/pages/expense-management/approval-engine/hooks/useApprovalWorkflow";
import api from "@/api/axiosInstance";
import ConfirmationModal from "@/components/confirmation_modal/ConfirmationModal";

const breadcrumbs = [
  { label: "Expense Management", to: "/expense-management/dashboard" },
  { label: "Expenses", to: "/expense-management/expenses/my" },
  { label: "Create Expense" },
];

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
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-xs font-semibold text-gray-800 break-words">{value ?? "—"}</p>
    </div>
  </div>
);

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
    minHeight: "36px",
    backgroundColor: "#ffffff",
    "&:hover": { borderColor: state.isFocused ? "#3b82f6" : "#d1d5db" },
  }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

export default function CreateExpensePage() {
  const navigate = useNavigate();
  const submitMutation = useSubmitReport();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [reportId, setReportId] = useState(null);
  const [createdReport, setCreatedReport] = useState(null);
  const [lineItems, setLineItems] = useState([]);

  const steps = [
    { id: 1, label: "Report Details" },
    { id: 2, label: "Line Items" },
    { id: 3, label: "Review & Submit" },
  ];

  // Lookups and forms state
  const [costCenters, setCostCenters] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: "",
    businessPurpose: "",
    costCenterId: "",
    currencyId: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Line item modal & drawer states
  const [isLineItemDrawerOpen, setIsLineItemDrawerOpen] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState(null);
  const [lineItemFormData, setLineItemFormData] = useState({
    categoryId: "",
    expenseDate: new Date().toISOString().split("T")[0],
    merchantName: "",
    description: "",
    amount: "",
    currencyId: "",
    taxAmount: "0",
    clientBillable: false,
    projectId: "",
  });
  const [lineItemErrors, setLineItemErrors] = useState({});
  const [receiptFile, setReceiptFile] = useState(null);
  const [savingLineItem, setSavingLineItem] = useState(false);

  // View line item state
  const [lineItemToView, setLineItemToView] = useState(null);

  // Delete line item states
  const [lineItemToDelete, setLineItemToDelete] = useState(null);
  const [deletingLineItem, setDeletingLineItem] = useState(false);

  // Step 2 filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  useEffect(() => {
    const loadLookups = async () => {
      try {
        setLookupsLoading(true);
        const [costCenterList, currencyList] = await Promise.all([
          lookupService.getActiveCostCenters(),
          lookupService.getActiveCurrencies(),
        ]);
        setCostCenters(costCenterList);
        setCurrencies(currencyList);
      } catch (err) {
        console.error("Failed to load lookups:", err);
        showStatusToast("Failed to load cost centers / currencies.", "error");
      } finally {
        setLookupsLoading(false);
      }
    };
    loadLookups();
  }, []);

  // Fetch Step 2 & 3 lookups dynamically when transitioning
  useEffect(() => {
    if (currentStep > 1 && categories.length === 0) {
      const loadStep2Lookups = async () => {
        try {
          const [catList, projListResponse] = await Promise.all([
            lookupService.getActiveCategories(),
            api.get("/xms/admin/projects", {
              baseURL: window.__APP_CONFIG__?.EXPENSE_MANAGEMENT_URL || "",
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            }).catch(() => ({ data: { data: [] } })),
          ]);
          setCategories(catList);
          const pList = projListResponse?.data?.data || projListResponse?.data || [];
          setProjects(Array.isArray(pList) ? pList : []);
        } catch (err) {
          console.error("Failed to load categories/projects lookups:", err);
        }
      };
      loadStep2Lookups();
    }
  }, [currentStep, categories.length]);

  const costCenterOptions = costCenters.map((c) => ({
    value: c.costCenterId,
    label: `${c.costCenterCode} - ${c.costCenterName}`,
  }));
  const currencyOptions = currencies.map((c) => ({
    value: c.currencyId,
    label: `${c.currencyCode} - ${c.currencyName}`,
  }));
  const categoryOptions = categories.map((c) => ({
    value: c.categoryId,
    label: `${c.categoryCode} - ${c.categoryName}`,
  }));

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) {
      errors.title = "Report title is required.";
    } else if (formData.title.trim().length < 3) {
      errors.title = "Title must be at least 3 characters.";
    }
    if (!formData.costCenterId) errors.costCenterId = "Cost center is required.";
    if (!formData.currencyId) errors.currencyId = "Report currency is required.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 1: Handle submission & draft saving
  const handleNextFromStep1 = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      title: formData.title.trim(),
      businessPurpose: formData.businessPurpose.trim(),
      costCenterId: formData.costCenterId,
      currencyId: formData.currencyId,
    };

    try {
      setSubmitting(true);
      let res;
      if (reportId) {
        res = await expenseReportService.update(reportId, payload);
        showStatusToast("Expense report details updated successfully!", "success");
      } else {
        res = await expenseReportService.create(payload);
        showStatusToast("Expense report details saved successfully!", "success");
      }

      const newReportId = res.data?.data?.reportId || res.data?.reportId || res.data?.data?.id || res.data?.id;
      if (newReportId) {
        navigate(`/expense-management/expenses/reports/${newReportId}`);
      } else {
        showStatusToast("Failed to retrieve report ID.", "error");
      }
    } catch (err) {
      console.error("Error creating/updating report:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to save report details.";
      showStatusToast(errMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Stepper Header click handler
  const handleStepClick = (stepId) => {
    if (stepId < currentStep) {
      setFormErrors({});
      setCurrentStep(stepId);
    }
  };

  // Step 2: Line items list calculations, filters and sort
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

  // Line Item Drawer Form Actions
  const handleLineItemInputChange = (e) => {
    const { name, value } = e.target;
    setLineItemFormData((prev) => ({ ...prev, [name]: value }));
    if (lineItemErrors[name]) setLineItemErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleLineItemSelectChange = (name, value) => {
    setLineItemFormData((prev) => ({ ...prev, [name]: value }));
    if (lineItemErrors[name]) setLineItemErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateLineItemForm = () => {
    const errors = {};
    if (!lineItemFormData.categoryId) errors.categoryId = "Category is required.";
    if (!lineItemFormData.expenseDate) errors.expenseDate = "Date is required.";
    if (!lineItemFormData.merchantName.trim()) errors.merchantName = "Merchant is required.";
    if (!lineItemFormData.amount || Number(lineItemFormData.amount) <= 0) {
      errors.amount = "Amount must be greater than 0.";
    }
    if (!lineItemFormData.currencyId) errors.currencyId = "Currency is required.";
    if (Number(lineItemFormData.taxAmount) < 0) {
      errors.taxAmount = "GST cannot be negative.";
    } else if (Number(lineItemFormData.taxAmount) > (Number(lineItemFormData.amount) || 0)) {
      errors.taxAmount = "GST cannot exceed total amount.";
    }
    if (lineItemFormData.clientBillable && !lineItemFormData.projectId) {
      errors.projectId = "Project is required for billable expenses.";
    }
    setLineItemErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveLineItem = async (e) => {
    e.preventDefault();
    if (!validateLineItemForm()) return;

    try {
      setSavingLineItem(true);
      const payload = {
        categoryId: lineItemFormData.categoryId,
        expenseDate: lineItemFormData.expenseDate,
        merchantName: lineItemFormData.merchantName.trim(),
        description: lineItemFormData.description.trim(),
        amount: Number(lineItemFormData.amount),
        currencyId: lineItemFormData.currencyId,
        taxAmount: Number(lineItemFormData.taxAmount) || 0,
        costCenterId: createdReport?.costCenterId || formData.costCenterId,
        clientBillable: !!lineItemFormData.clientBillable,
        projectId: lineItemFormData.clientBillable ? lineItemFormData.projectId : "",
      };

      let res;
      if (editingLineItem) {
        res = await lineItemService.update(reportId, editingLineItem.lineItemId, payload);
        showStatusToast("Line item updated successfully!", "success");
      } else {
        res = await lineItemService.create(reportId, payload);
        showStatusToast("Line item added successfully!", "success");
      }

      const savedItem = res.data?.data || res.data;
      const savedId = savedItem?.lineItemId || editingLineItem?.lineItemId;

      if (savedId && receiptFile) {
        const uploadData = new FormData();
        const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        uploadData.append("file", receiptFile, safeName);
        await receiptService.upload(savedId, uploadData);
        showStatusToast("Receipt file uploaded successfully!", "success");
      }

      setIsLineItemDrawerOpen(false);
      
      // Refresh items list
      const itemsRes = await lineItemService.getAll(reportId);
      const payloadItems = itemsRes.data?.data;
      const list = Array.isArray(payloadItems) ? payloadItems : payloadItems?.lineItems || payloadItems?.content || payloadItems?.data || [];
      setLineItems(list);
    } catch (err) {
      console.error("Error saving line item:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to save line item.";
      showStatusToast(errMsg, "error");
    } finally {
      setSavingLineItem(false);
    }
  };

  const handleDeleteLineItemConfirm = async () => {
    if (!lineItemToDelete || !reportId) return;
    try {
      setDeletingLineItem(true);
      await lineItemService.delete(reportId, lineItemToDelete.lineItemId);
      showStatusToast("Line item deleted successfully!", "success");
      setLineItemToDelete(null);
      
      // Refresh list
      const itemsRes = await lineItemService.getAll(reportId);
      const payloadItems = itemsRes.data?.data;
      const list = Array.isArray(payloadItems) ? payloadItems : payloadItems?.lineItems || payloadItems?.content || payloadItems?.data || [];
      setLineItems(list);
    } catch (err) {
      console.error("Error deleting line item:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to delete line item.";
      showStatusToast(errMsg, "error");
    } finally {
      setDeletingLineItem(false);
    }
  };

  // Step 3: Handle Final Submission for Approval
  const handleSubmitReport = async () => {
    if (!reportId) return;
    try {
      submitMutation.mutate(reportId, {
        onSuccess: () => {
          showStatusToast("Expense report submitted for approval successfully!", "success");
          navigate(`/expense-management/expenses/reports/${reportId}`);
        },
        onError: (err) => {
          const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to submit expense report.";
          showStatusToast(errMsg, "error", 4000);
        },
      });
    } catch (err) {
      console.error("Error final submitting report:", err);
    }
  };

  // Setup GenericTable configurations for Step 2
  const headers = ["Category", "Merchant", "Date", "Amount", "Policy", "GST", "Net Amount", "Base Amount", "Billable", "Actions"];
  const columns = ["category", "merchant", "date", "amount", "policy", "gst", "net", "base", "billable", "actions"];
  const tableRows = filteredLineItems.map((li) => {
    const showCurrency = li.currencyCode && (li.currencyCode === "EUR" || li.currencyCode !== li.baseCurrencyCode);
    return {
      category: <span className="font-medium text-gray-800 text-xs">{li.categoryName || "—"}</span>,
      merchant: (
        <div className="text-left text-xs">
          <p className="font-medium text-gray-900">{li.merchantName || "—"}</p>
          {li.description && <p className="text-[10px] text-gray-400 truncate max-w-[150px]">{li.description}</p>}
        </div>
      ),
      date: <span className="text-xs">{formatDate(li.expenseDate)}</span>,
      amount: (
        <span className="font-mono font-semibold text-xs text-gray-900">
          {formatAmount(li.amount)} <span className="text-[10px] text-gray-400">{li.currencyCode}</span>
        </span>
      ),
      policy: <PolicyStatusBadge lineStatus={li.lineStatus} policyWarnings={li.policyWarnings} />,
      gst: (
        <span className="font-mono text-xs text-amber-600">
          {formatAmount(li.taxAmount)} {showCurrency && <span className="text-[10px] text-gray-400">{li.currencyCode}</span>}
        </span>
      ),
      net: (
        <span className="font-mono font-semibold text-xs text-emerald-700">
          {formatAmount(li.netAmount)} {showCurrency && <span className="text-[10px] text-gray-400">{li.currencyCode}</span>}
        </span>
      ),
      base: (
        <span className="font-mono text-[#0A0082] font-semibold text-xs">
          {formatAmount(li.baseAmount)} <span className="text-[10px] text-gray-400">{li.baseCurrencyCode}</span>
        </span>
      ),
      billable: li.clientBillable ? (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Yes</span>
      ) : (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-500 border border-gray-200">No</span>
      ),
      actions: (
        <div className="flex items-center gap-1 justify-center">
          <Button
            type="button"
            variant="link"
            size="icon"
            className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 transition rounded-md"
            onClick={() => setLineItemToView(li)}
          >
            <Eye size={13} />
          </Button>
          <Button
            type="button"
            variant="link"
            size="icon"
            className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition rounded-md"
            onClick={() => {
              setEditingLineItem(li);
              setLineItemFormData({
                categoryId: li.categoryId || "",
                expenseDate: li.expenseDate || new Date().toISOString().split("T")[0],
                merchantName: li.merchantName || "",
                description: li.description || "",
                amount: li.amount || "",
                currencyId: li.currencyId || "",
                taxAmount: li.taxAmount || "0",
                clientBillable: !!li.clientBillable,
                projectId: li.projectId || "",
              });
              setReceiptFile(null);
              setLineItemErrors({});
              setIsLineItemDrawerOpen(true);
            }}
          >
            <Pencil size={13} />
          </Button>
          <Button
            type="button"
            variant="link"
            size="icon"
            className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-800 transition rounded-md"
            onClick={() => setLineItemToDelete(li)}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ),
    };
  });

  const sortOptions = [
    { label: "Date (Newest first)", value: "date_desc" },
    { label: "Date (Oldest first)", value: "date_asc" },
    { label: "Amount (High to Low)", value: "amount_desc" },
    { label: "Amount (Low to High)", value: "amount_asc" },
    { label: "Merchant (A-Z)", value: "merchant_asc" },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumb items={breadcrumbs} />

      {/* Page Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-[#0A0082]">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0a174e]">Create Expense Report</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Start a new expense report, then add individual line items with receipts.
            </p>
          </div>
        </div>
      </div>

      {/* Stepper Card */}
      <div className="mx-auto max-w-5xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 space-y-6">

        {/* STEP 1: REPORT DETAILS */}
        {currentStep === 1 && (
          <form onSubmit={handleNextFromStep1} className="space-y-5 max-w-2xl mx-auto">
            <FormInput
              label="Report Title"
              name="title"
              placeholder="e.g. US Business Trip"
              value={formData.title}
              onChange={handleInputChange}
              requiredMark
              disabled={submitting}
              error={formErrors.title}
            />

            <FormTextArea
              label="Business Purpose"
              name="businessPurpose"
              placeholder="e.g. Client meeting with acquisition prospects"
              value={formData.businessPurpose}
              onChange={handleInputChange}
              disabled={submitting}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <Briefcase size={14} className="text-gray-400" />
                  Cost Center <span className="text-red-500">*</span>
                </label>
                <Select
                  options={costCenterOptions}
                  value={costCenterOptions.find((o) => o.value === formData.costCenterId) || null}
                  onChange={(opt) => handleSelectChange("costCenterId", opt ? opt.value : "")}
                  placeholder="Search and select cost center..."
                  isSearchable
                  isLoading={lookupsLoading}
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  styles={{
                    ...customSelectStyles,
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  }}
                  isDisabled={submitting}
                />
                {formErrors.costCenterId && <span className="text-xs text-red-600 block mt-1">{formErrors.costCenterId}</span>}
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <Landmark size={14} className="text-gray-400" />
                  Report Currency <span className="text-red-500">*</span>
                </label>
                <Select
                  options={currencyOptions}
                  value={currencyOptions.find((o) => o.value === formData.currencyId) || null}
                  onChange={(opt) => handleSelectChange("currencyId", opt ? opt.value : "")}
                  placeholder="Select report currency..."
                  isSearchable
                  isLoading={lookupsLoading}
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  styles={{
                    ...customSelectStyles,
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  }}
                  isDisabled={submitting}
                />
                {formErrors.currencyId && <span className="text-xs text-red-600 block mt-1">{formErrors.currencyId}</span>}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3">
              <FileText size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                After creating the report, you'll be able to add individual line items — each with its own
                currency, GST, and receipts.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 mt-5 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/expense-management/expenses/my")}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting} loadingText="Saving...">
                Create Expense Report
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: LINE ITEMS */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-[#0A0082]">
                  <Receipt size={16} />
                </div>
                <h2 className="text-base font-bold text-gray-900">Line Items</h2>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setEditingLineItem(null);
                  setLineItemFormData({
                    categoryId: "",
                    expenseDate: new Date().toISOString().split("T")[0],
                    merchantName: "",
                    description: "",
                    amount: "",
                    currencyId: createdReport?.currencyId || formData.currencyId || "",
                    taxAmount: "0",
                    clientBillable: false,
                    projectId: "",
                  });
                  setReceiptFile(null);
                  setLineItemErrors({});
                  setIsLineItemDrawerOpen(true);
                }}
                className="shadow-sm"
              >
                <Plus size={14} />
                Add Line Item
              </Button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-2">
              <div className="sm:col-span-2">
                <SearchInput
                  value={searchTerm}
                  onSearch={setSearchTerm}
                  placeholder="Search by merchant, category, description..."
                />
              </div>
              <div>
                <select
                  name="sortBy"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line items list */}
            {filteredLineItems.length === 0 ? (
              <div className="py-12 border border-gray-200 border-dashed rounded-xl flex flex-col items-center justify-center text-center">
                <Layers className="h-10 w-10 text-gray-300 mb-3" />
                <h3 className="text-sm font-semibold text-gray-700">No Line Items Added</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  {searchTerm
                    ? "No line items match your search criteria."
                    : "Add line items to this expense report to see them here."}
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-lg">
                <GenericTable headers={headers} rows={tableRows} columns={columns} />
              </div>
            )}

            <div className="flex justify-between items-center border-t border-gray-100 pt-4 mt-5">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => navigate("/expense-management/expenses/my")}>
                  Cancel
                </Button>
                <Button type="button" variant="primary" onClick={() => setCurrentStep(3)}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW & SUBMIT */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
              {/* Left Column (2/3 width) */}
              <div className="lg:col-span-2 space-y-5">
                {/* Report Information Card */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                    Report Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailField icon={<FileText size={16} />} label="Report Title" value={createdReport?.title} />
                    <DetailField
                      icon={<FileText size={16} />}
                      label="Business Purpose"
                      value={createdReport?.businessPurpose || "—"}
                    />
                    <DetailField
                      icon={<Briefcase size={16} />}
                      label="Cost Center"
                      value={createdReport?.costCenterName}
                    />
                    <DetailField
                      icon={<Landmark size={16} />}
                      label="Report Currency"
                      value={createdReport?.currencyCode}
                    />
                    <DetailField
                      icon={<Calendar size={16} />}
                      label="Created Date"
                      value={formatDate(createdReport?.createdAt)}
                    />
                    <DetailField icon={<FileText size={16} />} label="Status" value="DRAFT" />
                    <DetailField
                      icon={<FileText size={16} />}
                      label="Report ID"
                      value={createdReport?.reportNumber || reportId}
                    />
                  </div>
                </div>

                {/* Line Items Card */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                    Line Items ({lineItems.length})
                  </h3>
                  {lineItems.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No line items added to this report.</p>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase tracking-wider">
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3">Merchant</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((li) => (
                            <tr key={li.lineItemId} className="border-b border-gray-100 last:border-b-0">
                              <td className="py-2.5 px-3 font-medium text-gray-800">{li.categoryName}</td>
                              <td className="py-2.5 px-3 text-gray-600">{li.merchantName}</td>
                              <td className="py-2.5 px-3 text-gray-500">{formatDate(li.expenseDate)}</td>
                              <td className="py-2.5 px-3 text-right font-semibold font-mono text-gray-900">
                                {formatAmount(li.amount)} {li.currencyCode}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column (1/3 width) - Summary Panel */}
              <div className="lg:col-span-1">
                <SummaryPanel report={{ ...createdReport, status: "DRAFT" }} lineItems={lineItems} />
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-gray-100 pt-4 mt-5">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => navigate("/expense-management/expenses/my")}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={submitMutation.isPending}
                  loadingText="Submitting..."
                  onClick={handleSubmitReport}
                  className="bg-[#0A0082] hover:bg-[#080066] border-none"
                >
                  Submit for Approval
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LINE ITEM DRAWERS & MODALS */}

      {/* Add / Edit Line Item Modal */}
      {isLineItemDrawerOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-bold text-gray-900">
                {editingLineItem ? "Edit Line Item" : "Add Line Item"}
              </h2>
              <button
                type="button"
                onClick={() => setIsLineItemDrawerOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <form id="line-item-drawer-form" onSubmit={handleSaveLineItem} className="space-y-4">
                {/* Category */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <Select
                    options={categoryOptions}
                    value={categoryOptions.find((o) => o.value === lineItemFormData.categoryId) || null}
                    onChange={(opt) => handleLineItemSelectChange("categoryId", opt ? opt.value : "")}
                    placeholder="Select category..."
                    isSearchable
                    styles={compactSelectStyles}
                    isDisabled={savingLineItem}
                  />
                  {lineItemErrors.categoryId && (
                    <span className="text-[11px] text-red-600 block mt-0.5">{lineItemErrors.categoryId}</span>
                  )}
                </div>

                {/* Expense Date & Merchant Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      Expense Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="expenseDate"
                      value={lineItemFormData.expenseDate}
                      onChange={handleLineItemInputChange}
                      disabled={savingLineItem}
                      className={`w-full px-2.5 py-1.5 h-[38px] rounded-md border text-xs focus:outline-none focus:ring-2 ${
                        lineItemErrors.expenseDate
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                          : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                      }`}
                    />
                    {lineItemErrors.expenseDate && (
                      <span className="text-[11px] text-red-600 block mt-0.5">{lineItemErrors.expenseDate}</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      Merchant Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="merchantName"
                      placeholder="e.g. Uber, Restaurant Name"
                      value={lineItemFormData.merchantName}
                      onChange={handleLineItemInputChange}
                      disabled={savingLineItem}
                      className={`w-full px-2.5 py-1.5 h-[38px] rounded-md border text-xs focus:outline-none focus:ring-2 ${
                        lineItemErrors.merchantName
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                          : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                      }`}
                    />
                    {lineItemErrors.merchantName && (
                      <span className="text-[11px] text-red-600 block mt-0.5">{lineItemErrors.merchantName}</span>
                    )}
                  </div>
                </div>

                {/* Amount, Currency & GST */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={lineItemFormData.amount}
                      onChange={handleLineItemInputChange}
                      disabled={savingLineItem}
                      className={`w-full px-2.5 py-1.5 h-[38px] rounded-md border text-xs focus:outline-none focus:ring-2 ${
                        lineItemErrors.amount
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                          : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                      }`}
                    />
                    {lineItemErrors.amount && (
                      <span className="text-[11px] text-red-600 block mt-0.5">{lineItemErrors.amount}</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      Currency <span className="text-red-500">*</span>
                    </label>
                    <Select
                      options={currencyOptions}
                      value={currencyOptions.find((o) => o.value === lineItemFormData.currencyId) || null}
                      onChange={(opt) => handleLineItemSelectChange("currencyId", opt ? opt.value : "")}
                      placeholder="Currency"
                      isSearchable
                      styles={compactSelectStyles}
                      isDisabled={savingLineItem}
                    />
                    {lineItemErrors.currencyId && (
                      <span className="text-[11px] text-red-600 block mt-0.5">{lineItemErrors.currencyId}</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      GST (Tax) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="taxAmount"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={lineItemFormData.taxAmount}
                      onChange={handleLineItemInputChange}
                      disabled={savingLineItem}
                      className={`w-full px-2.5 py-1.5 h-[38px] rounded-md border text-xs focus:outline-none focus:ring-2 ${
                        lineItemErrors.taxAmount
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                          : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                      }`}
                    />
                    {lineItemErrors.taxAmount && (
                      <span className="text-[11px] text-red-600 block mt-0.5">{lineItemErrors.taxAmount}</span>
                    )}
                  </div>
                </div>

                {/* Client Billable & Project */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Client Billable?</label>
                    <select
                      name="clientBillable"
                      value={lineItemFormData.clientBillable.toString()}
                      onChange={(e) => handleLineItemSelectChange("clientBillable", e.target.value === "true")}
                      disabled={savingLineItem}
                      className="w-full px-2.5 py-1.5 h-[38px] rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      Project {lineItemFormData.clientBillable && <span className="text-red-500">*</span>}
                    </label>
                    <Select
                      options={projects
                        .filter((p) => (p.status || "").toString().toUpperCase() === "ACTIVE")
                        .map((p) => ({ value: p.projectId, label: `${p.projectCode} - ${p.projectName}` }))}
                      value={projects
                        .filter((p) => (p.status || "").toString().toUpperCase() === "ACTIVE")
                        .map((p) => ({ value: p.projectId, label: `${p.projectCode} - ${p.projectName}` }))
                        .find((o) => o.value === lineItemFormData.projectId) || null}
                      onChange={(opt) => handleLineItemSelectChange("projectId", opt ? opt.value : "")}
                      placeholder="Select project..."
                      isSearchable
                      styles={compactSelectStyles}
                      isDisabled={savingLineItem || !lineItemFormData.clientBillable}
                    />
                    {lineItemErrors.projectId && (
                      <span className="text-[11px] text-red-600 block mt-0.5">{lineItemErrors.projectId}</span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">Description</label>
                  <input
                    type="text"
                    name="description"
                    placeholder="Optional notes about this expense..."
                    value={lineItemFormData.description}
                    onChange={handleLineItemInputChange}
                    disabled={savingLineItem}
                    className="w-full px-2.5 py-1.5 h-[38px] rounded-md border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Receipt Upload */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">Receipt Attachment (Optional)</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    disabled={savingLineItem}
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        setReceiptFile(e.target.files[0]);
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md p-1 bg-white text-xs"
                  />
                  {receiptFile && <p className="text-[10px] text-indigo-600 font-semibold mt-1">File chosen: {receiptFile.name}</p>}
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLineItemDrawerOpen(false)}
                disabled={savingLineItem}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="line-item-drawer-form"
                variant="primary"
                loading={savingLineItem}
                loadingText="Saving..."
                disabled={savingLineItem}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Line Item Modal */}
      {lineItemToView && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-bold text-gray-900">Line Item Details</h2>
              <button
                type="button"
                onClick={() => setLineItemToView(null)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Read-only details */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <DetailField icon={<Layers size={15} />} label="Category" value={lineItemToView.categoryName} />
                <DetailField icon={<Calendar size={15} />} label="Expense Date" value={formatDate(lineItemToView.expenseDate)} />
                <DetailField icon={<Briefcase size={15} />} label="Merchant" value={lineItemToView.merchantName} />
                <DetailField icon={<Briefcase size={15} />} label="Cost Center" value={lineItemToView.costCenterName} />

                <div className="col-span-2 grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
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

                <DetailField
                  icon={<Landmark size={15} />}
                  label="Base Amount"
                  value={`${formatAmount(lineItemToView.baseAmount)} ${lineItemToView.baseCurrencyCode}`}
                />
                <DetailField
                  icon={<Briefcase size={15} />}
                  label="Client Billable?"
                  value={lineItemToView.clientBillable ? "Yes" : "No"}
                />
                {lineItemToView.clientBillable && (
                  <div className="col-span-2">
                    <DetailField icon={<Briefcase size={15} />} label="Project" value={lineItemToView.projectName} />
                  </div>
                )}
                <div className="col-span-2">
                  <DetailField icon={<FileText size={15} />} label="Description" value={lineItemToView.description} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end shrink-0">
              <Button type="button" variant="outline" onClick={() => setLineItemToView(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmationModal
        isOpen={!!lineItemToDelete}
        title="Delete Line Item"
        message={`Are you sure you want to delete the line item from "${lineItemToDelete?.merchantName || "this merchant"}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteLineItemConfirm}
        onCancel={() => setLineItemToDelete(null)}
        isLoading={deletingLineItem}
        variant="danger"
      />
    </div>
  );
}
