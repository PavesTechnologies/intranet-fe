import { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../../../../components/Modal/modal";
import Button from "../../../../components/Button/Button";
import FormInput from "../../../../components/forms/FormInput";
import FormSelect from "../../../../components/forms/FormSelect";
import FileUpload from "../../../../components/forms/FileUpload";
import { getApiErrorMessage } from "../../utils/apiError";
import { useCreateQuotation } from "../hooks/useQuotationMutations";
import useVendorOptions from "../hooks/useVendorOptions";

const emptyForm = () => ({
  vendorId: "",
  quotationNumber: "",
  quotationDate: "",
  validUntil: "",
  totalAmount: "",
  deliveryDays: "",
  paymentTerms: "",
});

/**
 * Records a quotation for a requisition. When `rfqId` is supplied (invoked from the RFQ
 * detail page), the vendor list is restricted to that RFQ's invited vendors and the
 * quotation is linked back to the RFQ; otherwise this is the original manual/catalog
 * quotation entry, unchanged.
 */
export default function QuotationFormModal({ isOpen, onClose, prId, rfqId, invitedVendorIds }) {
  const [form, setForm] = useState(emptyForm());
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});

  const { vendorOptions: allVendorOptions, isLoading: vendorsLoading } = useVendorOptions();
  const vendorOptions = invitedVendorIds
    ? allVendorOptions.filter((opt) => invitedVendorIds.includes(opt.value))
    : allVendorOptions;
  const createQuotation = useCreateQuotation(prId);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    if (errors.file) setErrors((prev) => ({ ...prev, file: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.vendorId) nextErrors.vendorId = "Vendor is required.";
    if (!file) nextErrors.file = "A quotation document is required.";
    if (form.totalAmount !== "" && Number(form.totalAmount) < 0) nextErrors.totalAmount = "Cannot be negative.";
    if (form.deliveryDays !== "" && Number(form.deliveryDays) < 0) nextErrors.deliveryDays = "Cannot be negative.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleClose = () => {
    setForm(emptyForm());
    setFile(null);
    setErrors({});
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await createQuotation.mutateAsync({
        vendorId: Number(form.vendorId),
        quotationNumber: form.quotationNumber.trim() || undefined,
        quotationDate: form.quotationDate || undefined,
        validUntil: form.validUntil || undefined,
        totalAmount: form.totalAmount !== "" ? form.totalAmount : undefined,
        rfqId: rfqId || undefined,
        deliveryDays: form.deliveryDays !== "" ? form.deliveryDays : undefined,
        paymentTerms: form.paymentTerms.trim() || undefined,
        file,
      });
      toast.success("Quotation added.");
      handleClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to add the quotation."));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Quotation"
      subtitle="Upload a vendor quotation document for this requisition."
      size="lg"
      closeOnBackdrop={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            type="submit"
            form="quotation-form"
            variant="primary"
            className="w-full sm:w-auto"
            loading={createQuotation.isPending}
            loadingText="Uploading..."
          >
            Add Quotation
          </Button>
        </div>
      }
    >
      <form id="quotation-form" onSubmit={handleSubmit} className="space-y-4 py-2">
        <FormSelect
          label="Vendor"
          name="vendorId"
          value={form.vendorId}
          onChange={handleChange}
          options={[
            { value: "", label: vendorsLoading ? "Loading vendors..." : "Select vendor" },
            ...vendorOptions,
          ]}
          requiredMark
          error={errors.vendorId}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Quotation Number"
            name="quotationNumber"
            value={form.quotationNumber}
            onChange={handleChange}
          />
          <FormInput
            label="Total Amount"
            name="totalAmount"
            type="number"
            min="0"
            step="0.01"
            value={form.totalAmount}
            onChange={handleChange}
            error={errors.totalAmount}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Quotation Date"
            name="quotationDate"
            type="date"
            value={form.quotationDate}
            onChange={handleChange}
          />
          <FormInput
            label="Valid Until"
            name="validUntil"
            type="date"
            value={form.validUntil}
            onChange={handleChange}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Delivery Days"
            name="deliveryDays"
            type="number"
            min="0"
            step="1"
            value={form.deliveryDays}
            onChange={handleChange}
            error={errors.deliveryDays}
          />
          <FormInput
            label="Payment Terms"
            name="paymentTerms"
            placeholder="e.g. Net 30"
            value={form.paymentTerms}
            onChange={handleChange}
          />
        </div>

        <div>
          <FileUpload
            label="Quotation Document"
            name="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            required
          />
          {errors.file && <p className="mt-1 text-xs text-red-600">{errors.file}</p>}
        </div>
      </form>
    </Modal>
  );
}
