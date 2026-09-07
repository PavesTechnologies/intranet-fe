import { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../../../../../components/Modal/modal";
import Button from "../../../../../components/Button/Button";
import FormInput from "../../../../../components/forms/FormInput";
import { getApiErrorMessage } from "../../../utils/apiError";

const TEXT_FIELDS = [
  { name: "place_of_supply", label: "Place of Supply" },
  { name: "tax_type", label: "Tax Type" },
  { name: "hsn_sac", label: "HSN / SAC" },
];

const RATE_FIELDS = [
  { name: "cgst_rate", label: "CGST Rate (%)" },
  { name: "sgst_rate", label: "SGST Rate (%)" },
  { name: "igst_rate", label: "IGST Rate (%)" },
  { name: "ugst_rate", label: "UGST Rate (%)" },
  { name: "cess_rate", label: "Cess Rate (%)" },
];

/**
 * Correction modal for GST tax-rate/type/classification fields (TaxCorrectionRequest). Amount
 * fields (cgst_amount, total_tax, etc.) belong to the separate AmountsCorrectionModal — the
 * backend splits rates/type from amounts across two distinct PATCH endpoints.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {Object} props.currentValues - current extracted_invoice.tax
 * @param {(patch: Object) => Promise<Object>} props.onSubmit
 * @param {(response: Object) => void} props.onCorrected
 */
export default function TaxCorrectionModal({ isOpen, onClose, currentValues, onSubmit, onCorrected }) {
  const [values, setValues] = useState(() => ({
    place_of_supply: currentValues?.place_of_supply ?? "",
    tax_type: currentValues?.tax_type ?? "",
    hsn_sac: currentValues?.hsn_sac ?? "",
    reverse_charge: Boolean(currentValues?.reverse_charge),
    cgst_rate: currentValues?.cgst_rate ?? "",
    sgst_rate: currentValues?.sgst_rate ?? "",
    igst_rate: currentValues?.igst_rate ?? "",
    ugst_rate: currentValues?.ugst_rate ?? "",
    cess_rate: currentValues?.cess_rate ?? "",
  }));
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (name) => (e) => setValues((prev) => ({ ...prev, [name]: e.target.value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const patch = {
        ...values,
        cgst_rate: values.cgst_rate === "" ? null : Number(values.cgst_rate),
        sgst_rate: values.sgst_rate === "" ? null : Number(values.sgst_rate),
        igst_rate: values.igst_rate === "" ? null : Number(values.igst_rate),
        ugst_rate: values.ugst_rate === "" ? null : Number(values.ugst_rate),
        cess_rate: values.cess_rate === "" ? null : Number(values.cess_rate),
      };
      const response = await onSubmit(patch);
      toast.success("Tax details updated.");
      onCorrected(response);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update tax details."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Correct GST Tax Details" size="2xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map((field) => (
          <FormInput key={field.name} label={field.label} name={field.name} value={values[field.name]} onChange={handleChange(field.name)} />
        ))}
        {RATE_FIELDS.map((field) => (
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

      <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={values.reverse_charge}
          onChange={(e) => setValues((prev) => ({ ...prev, reverse_charge: e.target.checked }))}
          className="h-4 w-4 rounded border-gray-300 text-[#0A0082] focus:ring-[#0A0082]/20"
        />
        Reverse Charge
      </label>

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
