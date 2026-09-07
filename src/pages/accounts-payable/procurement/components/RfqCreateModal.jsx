import { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../../../../components/Modal/modal";
import Button from "../../../../components/Button/Button";
import FormInput from "../../../../components/forms/FormInput";
import { getApiErrorMessage } from "../../utils/apiError";
import { useCreateRfq } from "../hooks/useRfqMutations";

export default function RfqCreateModal({ isOpen, onClose, prId, onCreated }) {
  const [dueDate, setDueDate] = useState("");
  const createRfq = useCreateRfq(prId);

  const handleClose = () => {
    setDueDate("");
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await createRfq.mutateAsync(dueDate || undefined);
      toast.success("RFQ created.");
      handleClose();
      onCreated?.(result.id);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to create the RFQ."));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create RFQ"
      subtitle="Open a request for quotation for this requisition, then invite vendors."
      size="sm"
      closeOnBackdrop={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            type="submit"
            form="rfq-create-form"
            variant="primary"
            className="w-full sm:w-auto"
            loading={createRfq.isPending}
            loadingText="Creating..."
          >
            Create RFQ
          </Button>
        </div>
      }
    >
      <form id="rfq-create-form" onSubmit={handleSubmit} className="space-y-4 py-2">
        <FormInput
          label="Due Date (optional)"
          name="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </form>
    </Modal>
  );
}
