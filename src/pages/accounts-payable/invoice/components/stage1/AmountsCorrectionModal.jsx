import { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../../../../../components/Modal/modal";
import Button from "../../../../../components/Button/Button";
import FormInput from "../../../../../components/forms/FormInput";
import { getApiErrorMessage } from "../../../utils/apiError";

const AMOUNT_FIELDS = [
  { name: "subtotal", label: "Subtotal" },
  { name: "taxable_amount", label: "Taxable Amount" },
  { name: "discount", label: "Discount" },
  { name: "cgst_amount", label: "CGST Amount" },
  { name: "sgst_amount", label: "SGST Amount" },
  { name: "igst_amount", label: "IGST Amount" },
  { name: "ugst_amount", label: "UGST Amount" },
  { name: "cess_amount", label: "Cess Amount" },
  { name: "total_tax", label: "Total Tax" },
  { name: "grand_total", label: "Grand Total" },
];

/**
 * Correction modal for invoice amount fields (AmountsCorrectionRequest) — used from the GST Tax
 * Validation panel for *_amount / total_tax mismatches (rate/type mismatches go through the
 * separate TaxCorrectionModal, matching the backend's two distinct PATCH endpoints).
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {Object} props.currentValues - current extracted_invoice.amounts
 * @param {(patch: Object) => Promise<Object>} props.onSubmit
 * @param {(response: Object) => void} props.onCorrected
 */
export default function AmountsCorrectionModal({ isOpen, onClose, currentValues, onSubmit, onCorrected }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(AMOUNT_FIELDS.map((f) => [f.name, currentValues?.[f.name] ?? ""])),
  );
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (name) => (e) => setValues((prev) => ({ ...prev, [name]: e.target.value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const patch = Object.fromEntries(
        AMOUNT_FIELDS.map((f) => [f.name, values[f.name] === "" ? null : Number(values[f.name])]),
      );
      const response = await onSubmit(patch);
      toast.success("Invoice amounts updated.");
      onCorrected(response);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update invoice amounts."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Correct Invoice Amounts" size="2xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {AMOUNT_FIELDS.map((field) => (
          <FormInput
            key={field.name}
            type="number"
            label={field.label}
            name={field.name}
            value={values[field.name]}
            onChange={handleChange(field.name)}
          />
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} loading={submitting} loadingText="Saving...">
          Save Correction
        </Button>
      </div>
    </Modal>
  );
}
