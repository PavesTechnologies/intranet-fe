import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import Modal from "@/components/Modal/modal";
import Button from "@/components/Button/Button";
import FormInput from "@/components/forms/FormInput";
import FormTextArea from "@/components/forms/FormTextArea";
import FormSelect from "@/components/forms/FormSelect";
import FormDatePicker from "@/components/forms/FormDatePicker";
import { showStatusToast } from "@/components/toastfy/toast";
import { lineItemService } from "@/pages/expense-management/api/expenseReportsApi";
import GstCalculationCard from "./GstCalculationCard";
import CurrencyConversionCard from "./CurrencyConversionCard";
import ReceiptDropzone from "./ReceiptDropzone";

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

const emptyForm = (defaultCostCenterId) => ({
  categoryId: "",
  expenseDate: new Date().toISOString().split("T")[0],
  merchantName: "",
  description: "",
  amount: "",
  currencyId: "",
  taxAmount: "0",
  costCenterId: defaultCostCenterId || "",
  clientBillable: false,
});

export default function LineItemDrawer({
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

  const isEditingExisting = !!lineItem;

  useEffect(() => {
    if (!isOpen) return;
    if (lineItem) {
      setFormData({
        categoryId: lineItem.categoryId || "",
        expenseDate: lineItem.expenseDate || new Date().toISOString().split("T")[0],
        merchantName: lineItem.merchantName || "",
        description: lineItem.description || "",
        amount: lineItem.amount ?? "",
        currencyId: lineItem.currencyId || "",
        taxAmount: lineItem.taxAmount ?? "0",
        costCenterId: lineItem.costCenterId || defaultCostCenterId || "",
        clientBillable: !!lineItem.clientBillable,
      });
      setSavedLineItem(lineItem);
    } else {
      setFormData(emptyForm(defaultCostCenterId));
      setSavedLineItem(null);
    }
    setFormErrors({});
  }, [isOpen, lineItem, defaultCostCenterId]);

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

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
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
      projectId: null,
      clientBillable: !!formData.clientBillable,
    };

    try {
      setSubmitting(true);
      let res;
      if (savedLineItem) {
        res = await lineItemService.update(reportId, savedLineItem.lineItemId, payload);
        showStatusToast("Line item updated successfully!", "success");
      } else {
        res = await lineItemService.create(reportId, payload);
        showStatusToast("Line item added successfully!", "success");
      }
      setSavedLineItem(res.data || { ...payload, lineItemId: savedLineItem?.lineItemId });
      onSaved?.();
    } catch (err) {
      console.error("Error saving line item:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to save line item.";
      showStatusToast(errMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // If the categories lookup list is unavailable (e.g. the backend blocks this
  // endpoint for the current role) or simply hasn't loaded yet, still show the
  // already-saved category on an existing line item instead of a blank picker.
  const mergedCategoryOptions = useMemo(() => {
    if (!lineItem?.categoryId) return categoryOptions;
    const alreadyPresent = categoryOptions.some((o) => o.value === lineItem.categoryId);
    if (alreadyPresent) return categoryOptions;
    return [{ value: lineItem.categoryId, label: lineItem.categoryName || lineItem.categoryId }, ...categoryOptions];
  }, [categoryOptions, lineItem]);

  const selectedCurrency = currencyOptions.find((o) => o.value === formData.currencyId) || null;
  const selectedCostCenter = costCenterOptions.find((o) => o.value === formData.costCenterId) || null;
  const selectedCategory = mergedCategoryOptions.find((o) => o.value === formData.categoryId) || null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={savedLineItem ? "Edit Line Item" : "Add Line Item"}
      subtitle={
        savedLineItem
          ? "Modify this expense line item, or attach supporting receipts below."
          : "Capture a single expense with real-time currency and GST calculation."
      }
      size="2xl"
      fullScreenMobile
      closeOnBackdrop={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="w-full sm:w-auto">
            {savedLineItem ? "Done" : "Cancel"}
          </Button>
          <Button
            type="submit"
            form="line-item-form"
            variant="primary"
            loading={submitting}
            loadingText="Saving..."
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            {savedLineItem ? "Save Changes" : "Save Line Item"}
          </Button>
        </div>
      }
    >
      {savedLineItem && !isEditingExisting && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs font-medium text-green-700">
          <CheckCircle2 size={14} />
          Line item saved. You can keep editing, attach receipts, or click Done.
        </div>
      )}

      {categoryOptions.length === 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700">
          <AlertTriangle size={14} />
          Expense categories couldn't be loaded for your account — contact your administrator if this
          persists.
        </div>
      )}

      <form id="line-item-form" onSubmit={handleSubmit} className="space-y-4 py-1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Category <span className="text-red-500">*</span>
            </label>
            <Select
              options={mergedCategoryOptions}
              value={selectedCategory}
              onChange={(opt) => handleSelectChange("categoryId", opt ? opt.value : "")}
              placeholder="Select expense category..."
              isSearchable
              styles={customSelectStyles}
              isDisabled={submitting}
            />
            {formErrors.categoryId && <span className="text-xs text-red-600 block mt-1">{formErrors.categoryId}</span>}
          </div>

          <FormDatePicker
            label="Expense Date *"
            name="expenseDate"
            value={formData.expenseDate}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormInput
            label="Merchant"
            name="merchantName"
            placeholder="e.g. REDBUS"
            value={formData.merchantName}
            onChange={handleInputChange}
            requiredMark
            disabled={submitting}
            error={formErrors.merchantName}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Cost Center <span className="text-red-500">*</span>
            </label>
            <Select
              options={costCenterOptions}
              value={selectedCostCenter}
              onChange={(opt) => handleSelectChange("costCenterId", opt ? opt.value : "")}
              placeholder="Select cost center..."
              isSearchable
              styles={customSelectStyles}
              isDisabled={submitting}
            />
            {formErrors.costCenterId && <span className="text-xs text-red-600 block mt-1">{formErrors.costCenterId}</span>}
          </div>
        </div>

        <FormTextArea
          label="Description"
          name="description"
          placeholder="Optional notes about this expense..."
          value={formData.description}
          onChange={handleInputChange}
          disabled={submitting}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Currency <span className="text-red-500">*</span>
            </label>
            <Select
              options={currencyOptions}
              value={selectedCurrency}
              onChange={(opt) => handleSelectChange("currencyId", opt ? opt.value : "")}
              placeholder="Select currency..."
              isSearchable
              styles={customSelectStyles}
              isDisabled={submitting}
            />
            {formErrors.currencyId && <span className="text-xs text-red-600 block mt-1">{formErrors.currencyId}</span>}
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
          />
        </div>

        <FormSelect
          label="Client Billable?"
          name="clientBillable"
          value={formData.clientBillable}
          onChange={(e) => handleSelectChange("clientBillable", e.target.value === "true")}
          options={[
            { label: "Yes", value: true },
            { label: "No", value: false },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Receipts</label>
          <ReceiptDropzone lineItemId={savedLineItem?.lineItemId} />
        </div>
      </form>
    </Modal>
  );
}
