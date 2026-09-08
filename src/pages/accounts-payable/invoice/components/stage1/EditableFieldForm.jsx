import { useState } from "react";
import { toast } from "react-toastify";
import Button from "../../../../../components/Button/Button";
import FormInput from "../../../../../components/forms/FormInput";
import { getApiErrorMessage } from "../../../utils/apiError";

/**
 * Plain editable form for manually correcting extracted fields — no confidence scores, match/
 * mismatch badges, or select-a-row-then-edit-elsewhere flow. Every field is directly editable;
 * only fields the user actually changed are sent in the save patch. Used wherever a stage was
 * skipped/failed and there's nothing real to compare the extraction against yet.
 *
 * @param {Object} props
 * @param {Array<{name: string, label: string, value: string|number|null, type?: string,
 *   rawKey?: string, hasLocation?: boolean}>} props.fields
 * @param {(rawKey: string|null) => void} [props.onFieldFocus] - called with a field's rawKey on
 *   focus (only for fields with hasLocation) so the parent can highlight it in the document;
 *   called with null on blur to clear the highlight.
 * @param {(patch: Object) => Promise<Object>} props.onSave - called with only the changed fields
 * @param {(response: Object) => void} props.onSaved
 * @param {string} [props.saveLabel]
 * @param {string} [props.savingLabel]
 */
export default function EditableFieldForm({
  fields,
  onFieldFocus,
  onSave,
  onSaved,
  saveLabel = "Save Changes",
  savingLabel = "Saving...",
}) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, f.value ?? ""])));
  const [submitting, setSubmitting] = useState(false);

  const isDirty = fields.some((f) => String(values[f.name] ?? "") !== String(f.value ?? ""));

  const handleChange = (name) => (e) => setValues((prev) => ({ ...prev, [name]: e.target.value }));

  const handleSave = async () => {
    const changed = fields.filter((f) => String(values[f.name] ?? "") !== String(f.value ?? ""));
    if (changed.length === 0) return;

    setSubmitting(true);
    try {
      const patch = Object.fromEntries(
        changed.map((f) => {
          const raw = values[f.name];
          return [f.name, f.type === "number" ? (raw === "" ? null : Number(raw)) : raw === "" ? null : raw];
        }),
      );
      const response = await onSave(patch);
      toast.success(changed.length === 1 ? `${changed[0].label} updated.` : `${changed.length} fields updated.`);
      onSaved(response);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save the correction."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <FormInput
            key={field.name}
            type={field.type || "text"}
            label={field.label}
            name={field.name}
            value={values[field.name]}
            onChange={handleChange(field.name)}
            onFocus={field.hasLocation ? () => onFieldFocus?.(field.rawKey) : undefined}
            onBlur={field.hasLocation ? () => onFieldFocus?.(null) : undefined}
          />
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="primary" size="small" onClick={handleSave} disabled={!isDirty} loading={submitting} loadingText={savingLabel}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
