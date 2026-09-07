import { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../../../../components/Modal/modal";
import Button from "../../../../components/Button/Button";
import FormInput from "../../../../components/forms/FormInput";
import FormSelect from "../../../../components/forms/FormSelect";
import FormTextArea from "../../../../components/forms/FormTextArea";
import { getApiErrorMessage } from "../../utils/apiError";
import { PR_PRIORITY_OPTIONS } from "../constants/procurementStatus";
import { useCreatePurchaseRequisition } from "../hooks/usePurchaseRequisitionMutations";
import useDepartments from "../../system-configuration/hooks/useDepartments";
import { usePurchaseCategoriesByDepartment } from "../../system-configuration/hooks/usePurchaseCategories";

const emptyForm = () => ({
  departmentId: "",
  purchaseCategoryId: "",
  priority: "NORMAL",
  requiredBy: "",
  deliveryLocation: "",
  justification: "",
});

/**
 * Creates a PR header only (lines default to []) — lines are added on the PR detail page
 * while the PR is still DRAFT, matching how PurchaseRequisitionCreateRequest/add_line are
 * two separate backend operations.
 */
export default function PrCreateModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});

  const { data: departments = [] } = useDepartments();
  const createMutation = useCreatePurchaseRequisition();

  // Purchase Category is dependent on Department (category.department_id) — fetched only
  // once a department is chosen, scoped server-side via the existing department_id filter on
  // GET /master/purchase-categories, never by fetching everything and filtering client-side.
  const selectedDepartmentId = form.departmentId ? Number(form.departmentId) : undefined;
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = usePurchaseCategoriesByDepartment(selectedDepartmentId);

  const departmentOptions = departments
    .filter((d) => d.is_active)
    .map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }));
  const categoryOptions = categories
    .filter((c) => c.is_active)
    .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }));

  const categoryDisabled = !selectedDepartmentId || categoriesLoading || categoriesError || categoryOptions.length === 0;
  const categoryPlaceholder = !selectedDepartmentId
    ? "Select department first"
    : categoriesLoading
      ? "Loading categories..."
      : categoriesError
        ? "Unable to load purchase categories."
        : categoryOptions.length === 0
          ? "No purchase categories available for this department."
          : "Select category";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      // Changing the department invalidates whichever category was picked for the old one.
      ...(name === "departmentId" ? { purchaseCategoryId: "" } : {}),
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.departmentId) nextErrors.departmentId = "Department is required.";
    if (!form.purchaseCategoryId) nextErrors.purchaseCategoryId = "Purchase category is required.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleClose = () => {
    setForm(emptyForm());
    setErrors({});
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      department_id: Number(form.departmentId),
      purchase_category_id: Number(form.purchaseCategoryId),
      priority: form.priority,
      required_by: form.requiredBy || null,
      delivery_location: form.deliveryLocation.trim() || null,
      justification: form.justification.trim() || null,
      lines: [],
    };

    try {
      const result = await createMutation.mutateAsync(payload);
      toast.success("Purchase requisition created.");
      handleClose();
      onCreated?.(result.id);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to create purchase requisition."));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Purchase Requisition"
      subtitle="Create the requisition header, then add line items on the next screen."
      size="lg"
      closeOnBackdrop={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            type="submit"
            form="pr-create-form"
            variant="primary"
            className="w-full sm:w-auto"
            loading={createMutation.isPending}
            loadingText="Creating..."
          >
            Create Requisition
          </Button>
        </div>
      }
    >
      <form id="pr-create-form" onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <FormSelect
            label="Department"
            name="departmentId"
            value={form.departmentId}
            onChange={handleChange}
            options={[{ value: "", label: "Select department" }, ...departmentOptions]}
            requiredMark
            error={errors.departmentId}
          />
          <div>
            <FormSelect
              label="Purchase Category"
              name="purchaseCategoryId"
              value={form.purchaseCategoryId}
              onChange={handleChange}
              options={categoryOptions}
              placeholder={categoryPlaceholder}
              disabled={categoryDisabled}
              requiredMark
              error={errors.purchaseCategoryId}
            />
            {categoriesError && (
              <p className="mt-1 text-xs text-red-500">Unable to load purchase categories.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormSelect
            label="Priority"
            name="priority"
            value={form.priority}
            onChange={handleChange}
            options={PR_PRIORITY_OPTIONS}
          />
          <FormInput
            label="Required By"
            name="requiredBy"
            type="date"
            value={form.requiredBy}
            onChange={handleChange}
          />
        </div>

        <FormInput
          label="Delivery Location"
          name="deliveryLocation"
          placeholder="e.g. Hyderabad HQ, 4th Floor"
          value={form.deliveryLocation}
          onChange={handleChange}
        />

        <FormTextArea
          label="Justification"
          name="justification"
          placeholder="Why is this purchase needed?"
          value={form.justification}
          onChange={handleChange}
          rows={3}
        />
      </form>
    </Modal>
  );
}
