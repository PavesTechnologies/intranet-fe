import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import Button from "../../../../components/Button/Button";
import SearchInput from "../../../../components/filter/Searchbar";
import Modal from "../../../../components/Modal/modal";
import ConfirmationModal from "../../../../components/confirmation_modal/ConfirmationModal";
import FormInput from "../../../../components/forms/FormInput";
import StatusBadge from "../../../../components/status/statusbadge";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import ToggleSwitch from "./ToggleSwitch";
import { getApiErrorMessage } from "../../utils/apiError";
import useDepartments from "../hooks/useDepartments";
import { useCreateDepartment, useUpdateDepartment, useDeleteDepartment } from "../hooks/useDepartmentMutations";
import usePurchaseCategories from "../hooks/usePurchaseCategories";
import {
  useCreatePurchaseCategory,
  useUpdatePurchaseCategory,
  useDeletePurchaseCategory,
} from "../hooks/usePurchaseCategoryMutations";

const emptyDeptForm = () => ({ code: "", name: "", isActive: true });
const emptyCatForm = () => ({ code: "", name: "", isActive: true });

/**
 * Departments & Categories — a real hierarchy, not a display convention: categories are
 * grouped strictly by their own category.department_id (Backend now returns/accepts this
 * field on PurchaseCategoryDetails/Request — verified against the live OpenAPI schema).
 * Reuses the same Department/Purchase Category hooks, services and validation the former flat
 * DepartmentTab/PurchaseCategoryTab used — only the presentation is a tree instead of two
 * separate tables.
 */
export default function DepartmentsAndCategoriesTab() {
  const { data: departmentData, isLoading: departmentsLoading, isError: departmentsError, error: departmentsErr } =
    useDepartments();
  const { data: categoryData, isLoading: categoriesLoading, isError: categoriesError, error: categoriesErr } =
    usePurchaseCategories();

  const departments = departmentData || [];
  const categories = categoryData || [];

  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const createCategory = useCreatePurchaseCategory();
  const updateCategory = useUpdatePurchaseCategory();
  const deleteCategory = useDeletePurchaseCategory();

  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  // Expand every department by default once loaded, matching the mockup (▼ everywhere).
  useEffect(() => {
    if (departments.length > 0) {
      setExpandedIds((prev) => (prev.size > 0 ? prev : new Set(departments.map((d) => d.id))));
    }
  }, [departments]);

  const toggleExpanded = (departmentId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
  };

  // The one real relationship this whole page hangs on — grouped strictly by department_id,
  // never by code prefix or name matching.
  const categoriesByDepartmentId = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => {
      const list = map.get(c.department_id) || [];
      list.push(c);
      map.set(c.department_id, list);
    });
    return map;
  }, [categories]);

  const filteredDepartments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q));
  }, [departments, search]);

  // ── Department modal ──────────────────────────────────────────────────
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [currentDept, setCurrentDept] = useState(null);
  const [deptForm, setDeptForm] = useState(emptyDeptForm());
  const [deptErrors, setDeptErrors] = useState({});
  const [deptDeleteTarget, setDeptDeleteTarget] = useState(null);

  const openAddDepartment = () => {
    setCurrentDept(null);
    setDeptForm(emptyDeptForm());
    setDeptErrors({});
    setIsDeptModalOpen(true);
  };

  const openEditDepartment = (dept) => {
    setCurrentDept(dept);
    setDeptForm({ code: dept.code, name: dept.name, isActive: dept.is_active });
    setDeptErrors({});
    setIsDeptModalOpen(true);
  };

  const validateDept = () => {
    const next = {};
    if (!deptForm.code.trim()) next.code = "Department code is required.";
    if (!deptForm.name.trim()) next.name = "Department name is required.";
    setDeptErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    if (!validateDept()) return;

    const payload = { code: deptForm.code.trim().toUpperCase(), name: deptForm.name.trim(), is_active: deptForm.isActive };

    try {
      if (currentDept) {
        await updateDepartment.mutateAsync({ departmentId: currentDept.id, payload });
        toast.success("Department updated.");
      } else {
        await createDepartment.mutateAsync(payload);
        toast.success("Department added.");
      }
      setIsDeptModalOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save department."));
    }
  };

  const handleDeleteDeptConfirm = async () => {
    if (!deptDeleteTarget) return;
    try {
      await deleteDepartment.mutateAsync(deptDeleteTarget.id);
      toast.success("Department deleted.");
      setDeptDeleteTarget(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete department."));
    }
  };

  const isDeptSaving = createDepartment.isPending || updateDepartment.isPending;

  // ── Category modal ────────────────────────────────────────────────────
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [catModalDepartment, setCatModalDepartment] = useState(null); // locked, read-only context
  const [catForm, setCatForm] = useState(emptyCatForm());
  const [catErrors, setCatErrors] = useState({});
  const [catDeleteTarget, setCatDeleteTarget] = useState(null);

  const openAddCategory = (dept) => {
    setCurrentCategory(null);
    setCatModalDepartment(dept);
    setCatForm(emptyCatForm());
    setCatErrors({});
    setIsCatModalOpen(true);
  };

  const openEditCategory = (category) => {
    const owningDept = departments.find((d) => d.id === category.department_id) || null;
    setCurrentCategory(category);
    setCatModalDepartment(owningDept);
    setCatForm({ code: category.code, name: category.name, isActive: category.is_active });
    setCatErrors({});
    setIsCatModalOpen(true);
  };

  const validateCat = () => {
    const next = {};
    if (!catForm.code.trim()) next.code = "Category code is required.";
    if (!catForm.name.trim()) next.name = "Category name is required.";
    setCatErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveCat = async (e) => {
    e.preventDefault();
    if (!validateCat() || !catModalDepartment) return;

    const payload = {
      code: catForm.code.trim().toUpperCase(),
      name: catForm.name.trim(),
      is_active: catForm.isActive,
      department_id: catModalDepartment.id,
    };

    try {
      if (currentCategory) {
        await updateCategory.mutateAsync({ categoryId: currentCategory.id, payload });
        toast.success("Purchase category updated.");
      } else {
        await createCategory.mutateAsync(payload);
        toast.success("Purchase category added.");
      }
      setIsCatModalOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save purchase category."));
    }
  };

  const handleDeleteCatConfirm = async () => {
    if (!catDeleteTarget) return;
    try {
      await deleteCategory.mutateAsync(catDeleteTarget.id);
      toast.success("Purchase category deleted.");
      setCatDeleteTarget(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete purchase category."));
    }
  };

  const isCatSaving = createCategory.isPending || updateCategory.isPending;

  const isLoading = departmentsLoading || categoriesLoading;
  const isError = departmentsError || categoriesError;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <SearchInput onSearch={setSearch} placeholder="Search by department code or name..." />
        </div>
        <Button variant="primary" onClick={openAddDepartment} className="whitespace-nowrap">
          <Plus size={16} />
          Add Department
        </Button>
      </div>

      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getApiErrorMessage(departmentsErr || categoriesErr, "Failed to load departments and categories.")}
        </div>
      ) : isLoading ? (
        <LoadingSpinner text="Loading departments and categories..." />
      ) : filteredDepartments.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          {search ? "No departments match your search." : "No departments found."}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDepartments.map((dept) => {
            const isExpanded = expandedIds.has(dept.id);
            const deptCategories = categoriesByDepartmentId.get(dept.id) || [];

            return (
              <div key={dept.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(dept.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown size={16} className="shrink-0 text-gray-500" />
                    ) : (
                      <ChevronRight size={16} className="shrink-0 text-gray-500" />
                    )}
                    <span className="font-mono text-xs font-semibold text-gray-700">{dept.code}</span>
                    <span className="truncate font-semibold text-gray-900">{dept.name}</span>
                    <StatusBadge label={dept.is_active ? "Active" : "Inactive"} size="sm" />
                    <span className="shrink-0 text-xs text-gray-400">
                      {deptCategories.length} {deptCategories.length === 1 ? "category" : "categories"}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="outline" size="small" onClick={() => openAddCategory(dept)}>
                      <Plus size={14} /> Add Category
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      size="icon"
                      title="Edit Department"
                      className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition rounded-md"
                      onClick={() => openEditDepartment(dept)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      size="icon"
                      title="Delete Department"
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-800 transition rounded-md"
                      onClick={() => setDeptDeleteTarget(dept)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="divide-y divide-gray-100 border-t border-gray-100">
                    {deptCategories.length === 0 ? (
                      <div className="flex items-center justify-between gap-3 py-4 pl-10 pr-4">
                        <p className="text-sm text-gray-400">No purchase categories configured</p>
                        <Button variant="outline" size="small" onClick={() => openAddCategory(dept)}>
                          <Plus size={14} /> Add Category
                        </Button>
                      </div>
                    ) : (
                      deptCategories.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between gap-3 py-2.5 pl-10 pr-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-gray-300">└─</span>
                            <span className="font-mono text-xs font-semibold text-gray-600">{cat.code}</span>
                            <span className="truncate text-sm font-medium text-gray-800">{cat.name}</span>
                            <StatusBadge label={cat.is_active ? "Active" : "Inactive"} size="sm" />
                          </div>
                          <Button
                            type="button"
                            variant="link"
                            size="icon"
                            title="Edit Purchase Category"
                            className="h-8 w-8 p-0 shrink-0 text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition rounded-md"
                            onClick={() => openEditCategory(cat)}
                          >
                            <Pencil size={16} />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Department */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title={currentDept ? "Edit Department" : "Add Department"}
        subtitle="Define a department used to categorize vendors and invoices."
        size="md"
        closeOnBackdrop={false}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsDeptModalOpen(false)} className="w-full sm:w-auto" disabled={isDeptSaving}>
              Cancel
            </Button>
            <Button type="submit" form="department-form" variant="primary" className="w-full sm:w-auto" loading={isDeptSaving} loadingText="Saving...">
              Save Department
            </Button>
          </div>
        }
      >
        <form id="department-form" onSubmit={handleSaveDept} className="space-y-4 py-2">
          <FormInput
            label="Department Code"
            name="code"
            placeholder="e.g. FIN"
            value={deptForm.code}
            onChange={(e) => setDeptForm((prev) => ({ ...prev, code: e.target.value }))}
            requiredMark
            error={deptErrors.code}
          />
          <FormInput
            label="Department Name"
            name="name"
            placeholder="e.g. Finance"
            value={deptForm.name}
            onChange={(e) => setDeptForm((prev) => ({ ...prev, name: e.target.value }))}
            requiredMark
            error={deptErrors.name}
          />
          <div className="rounded-lg border border-gray-200 p-4">
            <ToggleSwitch label="Active" checked={deptForm.isActive} onChange={(val) => setDeptForm((prev) => ({ ...prev, isActive: val }))} />
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={!!deptDeleteTarget}
        title="Delete Department"
        message={`Are you sure you want to delete the department "${deptDeleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleteDepartment.isPending}
        onConfirm={handleDeleteDeptConfirm}
        onCancel={() => setDeptDeleteTarget(null)}
        variant="danger"
      />

      {/* Add / Edit Purchase Category — Department is always the clicked/owning department, read-only */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={currentCategory ? "Edit Purchase Category" : "Add Purchase Category"}
        subtitle="Define a category used to classify purchase orders and invoices."
        size="md"
        closeOnBackdrop={false}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsCatModalOpen(false)} className="w-full sm:w-auto" disabled={isCatSaving}>
              Cancel
            </Button>
            <Button type="submit" form="purchase-category-form" variant="primary" className="w-full sm:w-auto" loading={isCatSaving} loadingText="Saving...">
              Save Category
            </Button>
          </div>
        }
      >
        <form id="purchase-category-form" onSubmit={handleSaveCat} className="space-y-4 py-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
            <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
              {catModalDepartment ? `${catModalDepartment.code} — ${catModalDepartment.name}` : "—"}
            </div>
          </div>
          <FormInput
            label="Category Code"
            name="code"
            placeholder="e.g. IT_HARDWARE"
            value={catForm.code}
            onChange={(e) => setCatForm((prev) => ({ ...prev, code: e.target.value }))}
            requiredMark
            error={catErrors.code}
          />
          <FormInput
            label="Category Name"
            name="name"
            placeholder="e.g. IT Hardware"
            value={catForm.name}
            onChange={(e) => setCatForm((prev) => ({ ...prev, name: e.target.value }))}
            requiredMark
            error={catErrors.name}
          />
          <div className="rounded-lg border border-gray-200 p-4">
            <ToggleSwitch label="Active" checked={catForm.isActive} onChange={(val) => setCatForm((prev) => ({ ...prev, isActive: val }))} />
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={!!catDeleteTarget}
        title="Delete Purchase Category"
        message={`Are you sure you want to delete the purchase category "${catDeleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleteCategory.isPending}
        onConfirm={handleDeleteCatConfirm}
        onCancel={() => setCatDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
}
